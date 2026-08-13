import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_SETTINGS,
  computeDay,
  type AttendanceSettings,
} from "./attendance-rules";

export const ROTATE_SECONDS = 30;

export async function getSettings(client: SupabaseClient): Promise<AttendanceSettings> {
  const { data } = await client.from("settings").select("*").eq("id", 1).maybeSingle();
  return { ...DEFAULT_SETTINGS, ...(data ?? {}) } as AttendanceSettings;
}

function b64url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return b64url(sig).slice(0, 22);
}

export function currentCounter(): number {
  return Math.floor(Date.now() / 1000 / ROTATE_SECONDS);
}

export async function buildPayload(secret: string, workDate: string, counter: number) {
  const sig = await sign(secret, `${workDate}.${counter}`);
  return `CD1.${workDate}.${counter}.${sig}`;
}

export async function verifyPayload(
  secret: string,
  payload: string,
  workDate: string,
): Promise<{ ok: boolean; reason?: string }> {
  const parts = payload.trim().split(".");
  if (parts.length !== 4 || parts[0] !== "CD1") {
    return { ok: false, reason: "This is not a ChronoDesk code." };
  }
  const [, date, counterRaw, sig] = parts;
  if (date !== workDate) {
    return {
      ok: false,
      reason: `This code is for ${date}. Ask your admin for today's code.`,
    };
  }
  const counter = parseInt(counterRaw as string, 10);
  const now = currentCounter();
  if (!Number.isFinite(counter) || Math.abs(now - counter) > 1) {
    return { ok: false, reason: "This code has expired. Scan the code on screen again." };
  }
  const expected = await sign(secret, `${date}.${counter}`);
  if (expected !== sig) return { ok: false, reason: "This code is not valid." };
  return { ok: true };
}

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return b64url(bytes.buffer as ArrayBuffer);
}

/** Idempotent daily token creation (FR-8). */
export async function ensureToken(admin: SupabaseClient, workDate: string) {
  const { data: existing } = await admin
    .from("qr_tokens")
    .select("*")
    .eq("work_date", workDate)
    .maybeSingle();
  if (existing && !existing.revoked) return existing;
  if (existing?.revoked) {
    const { data } = await admin
      .from("qr_tokens")
      .update({ secret: randomSecret(), revoked: false })
      .eq("work_date", workDate)
      .select()
      .single();
    return data;
  }
  const { data, error } = await admin
    .from("qr_tokens")
    .insert({ work_date: workDate, secret: randomSecret() })
    .select()
    .single();
  if (error) {
    const { data: retry } = await admin
      .from("qr_tokens")
      .select("*")
      .eq("work_date", workDate)
      .single();
    return retry;
  }
  return data;
}

export async function rotateToken(admin: SupabaseClient, workDate: string) {
  await admin.from("qr_tokens").upsert(
    { work_date: workDate, secret: randomSecret(), revoked: false },
    { onConflict: "work_date" },
  );
}

/** Recompute and persist the daily summary from append-only events (R10). */
export async function recomputeDay(
  admin: SupabaseClient,
  userId: string,
  workDate: string,
  settings: AttendanceSettings,
) {
  const { data: events } = await admin
    .from("attendance_events")
    .select("*")
    .eq("user_id", userId)
    .eq("work_date", workDate)
    .order("effective_at", { ascending: true });

  const list = events ?? [];
  const ins = list.filter((e) => e.kind === "check_in");
  const outs = list.filter((e) => e.kind === "check_out");
  const first = ins[0];
  const last = outs[outs.length - 1];

  const checkIn = first ? new Date(first.effective_at) : null;
  const checkOut = last ? new Date(last.effective_at) : null;
  const totals = computeDay(checkIn, checkOut, settings);

  const row = {
    user_id: userId,
    work_date: workDate,
    check_in_at: checkIn?.toISOString() ?? null,
    check_out_at: checkOut?.toISOString() ?? null,
    raw_check_in_at: first?.raw_at ?? null,
    gross_minutes: totals.gross_minutes,
    break_minutes: totals.break_minutes,
    net_minutes: totals.net_minutes,
    late_minutes: totals.late_minutes,
    overtime_minutes: totals.overtime_minutes,
    undertime_minutes: totals.undertime_minutes,
    status: (checkIn && checkOut ? "present" : "incomplete") as "present" | "incomplete",
    updated_at: new Date().toISOString(),
  };

  await admin.from("attendance_days").upsert(row, { onConflict: "user_id,work_date" });
  return { ...row, totals };
}

export async function audit(
  admin: SupabaseClient,
  entry: {
    actor_id?: string | null;
    actor_email?: string | null;
    action: string;
    entity: string;
    entity_id?: string | null;
    reason?: string | null;
    payload?: unknown;
  },
) {
  await admin.from("audit_log").insert({
    ...entry,
    payload: (entry.payload ?? null) as never,
  });
}