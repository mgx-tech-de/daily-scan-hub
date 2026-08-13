import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { clampCheckIn, parseHm, zoned } from "./attendance-rules";
import { can, type Permission } from "./permissions";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function loadServer() {
  const [{ supabaseAdmin }, helpers] = await Promise.all([
    import("@/integrations/supabase/client.server"),
    import("./chrono.server"),
  ]);
  return { admin: supabaseAdmin, ...helpers };
}

async function rolesOf(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  return ((data ?? []) as Array<{ role: string }>).map((r) => r.role);
}

/** Server-side permission gate — the browser UI is only a convenience layer. */
async function requirePermission(
  context: { supabase: any; userId: string },
  permission: Permission,
) {
  const roles = await rolesOf(context);
  if (!can(roles, permission)) {
    throw new Error("Forbidden: you do not have permission to perform this action.");
  }
  return roles;
}

/** Bootstrap: the first signed-in user may claim the admin role. */
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ first_name: z.string().default("Admin"), last_name: z.string().default("") })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { admin, audit } = await loadServer();
    const { count } = await admin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("An administrator already exists.");
    const { data: authUser } = await admin.auth.admin.getUserById(context.userId);
    await admin.from("profiles").upsert({
      id: context.userId,
      email: authUser.user?.email ?? "",
      first_name: data.first_name,
      last_name: data.last_name,
      status: "active",
    });
    await admin.from("user_roles").insert({ user_id: context.userId, role: "admin" });
    await audit(admin, {
      actor_id: context.userId,
      action: "claim_first_admin",
      entity: "user_roles",
      entity_id: context.userId,
    });
    return { ok: true };
  });

export const getKiosk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePermission(context as never, "qr.view");
    const { admin, getSettings, ensureToken, buildPayload, currentCounter, ROTATE_SECONDS } =
      await loadServer();
    const settings = await getSettings(admin);
    const workDate = zoned(new Date(), settings.timezone).date;
    const token = await ensureToken(admin, workDate);
    const counter = currentCounter();
    const payload = await buildPayload(token!.secret, workDate, counter);
    return {
      payload,
      workDate,
      rotateSeconds: ROTATE_SECONDS,
      timezone: settings.timezone,
      windowFrom: settings.qr_open,
      windowTo: settings.daily_cutoff,
    };
  });

export const rotateQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePermission(context as never, "qr.rotate");
    const { admin, getSettings, rotateToken, audit } = await loadServer();
    const settings = await getSettings(admin);
    const workDate = zoned(new Date(), settings.timezone).date;
    await rotateToken(admin, workDate);
    await audit(admin, {
      actor_id: context.userId,
      action: "rotate_qr",
      entity: "qr_tokens",
      entity_id: workDate,
    });
    return { ok: true };
  });

/** Public wall-display code: the landing page acts as the workplace kiosk. */
export const getPublicKiosk = createServerFn({ method: "GET" }).handler(async () => {
  const { admin, getSettings, ensureToken, buildPayload, currentCounter, ROTATE_SECONDS } =
    await loadServer();
  const settings = await getSettings(admin);
  const workDate = zoned(new Date(), settings.timezone).date;
  const token = await ensureToken(admin, workDate);
  const payload = await buildPayload(token!.secret, workDate, currentCounter());
  return {
    payload,
    workDate,
    rotateSeconds: ROTATE_SECONDS,
    timezone: settings.timezone,
    orgName: settings.org_name,
    windowFrom: settings.qr_open,
    windowTo: settings.daily_cutoff,
  };
});

/** Public kiosk feed: the last few scans of today, for the wall display. */
export const getRecentScans = createServerFn({ method: "GET" }).handler(async () => {
  const { admin, getSettings } = await loadServer();
  const settings = await getSettings(admin);
  const workDate = zoned(new Date(), settings.timezone).date;
  const { data: events } = await admin
    .from("attendance_events")
    .select("id,user_id,kind,effective_at,work_date")
    .eq("work_date", workDate)
    .order("raw_at", { ascending: false })
    .limit(6);
  const list = events ?? [];
  const ids = [...new Set(list.map((e) => e.user_id))];
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id,first_name,last_name,department").in("id", ids)
    : { data: [] as Array<{ id: string; first_name: string; last_name: string; department: string | null }> };
  const { data: days } = ids.length
    ? await admin
        .from("attendance_days")
        .select("user_id,net_minutes,check_in_at,check_out_at")
        .eq("work_date", workDate)
        .in("user_id", ids)
    : { data: [] as Array<{ user_id: string; net_minutes: number; check_in_at: string | null; check_out_at: string | null }> };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const dayById = new Map((days ?? []).map((d) => [d.user_id, d]));
  return {
    workDate,
    timezone: settings.timezone,
    scans: list.map((e) => {
      const p = byId.get(e.user_id);
      const d = dayById.get(e.user_id);
      return {
        id: e.id,
        kind: e.kind as "check_in" | "check_out",
        at: e.effective_at as string,
        name: p ? `${p.first_name} ${p.last_name}`.trim() : "Employee",
        department: p?.department ?? null,
        netMinutes: d?.net_minutes ?? 0,
      };
    }),
  };
});

const _rotateQrLegacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePermission(context as never, "qr.rotate");
    const { admin, getSettings, rotateToken, audit } = await loadServer();
    const settings = await getSettings(admin);
    const workDate = zoned(new Date(), settings.timezone).date;
    await rotateToken(admin, workDate);
    await audit(admin, {
      actor_id: context.userId,
      action: "rotate_qr",
      entity: "qr_tokens",
      entity_id: workDate,
    });
    return { ok: true };
  });

/** FR-14 to FR-21 — the scan endpoint. The server owns the timestamp. */
export const scanQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ payload: z.string().min(4), clientTime: z.string().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { admin, getSettings, ensureToken, verifyPayload, recomputeDay, audit } =
      await loadServer();
    const settings = await getSettings(admin);
    const now = new Date();
    const z1 = zoned(now, settings.timezone);
    const workDate = z1.date;

    if (z1.minutes < parseHm(settings.qr_open) || z1.minutes > parseHm(settings.daily_cutoff)) {
      return {
        ok: false as const,
        message: `Scanning is only open between ${settings.qr_open} and ${settings.daily_cutoff}.`,
      };
    }

    const token = await ensureToken(admin, workDate);
    const check = await verifyPayload(token!.secret, data.payload, workDate);
    if (!check.ok) return { ok: false as const, message: check.reason! };

    const { data: profile } = await admin
      .from("profiles")
      .select("first_name,last_name,status")
      .eq("id", context.userId)
      .maybeSingle();
    if (profile && profile.status !== "active") {
      return { ok: false as const, message: "Your account is not active. Contact HR." };
    }

    const { data: events } = await admin
      .from("attendance_events")
      .select("*")
      .eq("user_id", context.userId)
      .eq("work_date", workDate)
      .order("raw_at", { ascending: true });
    const list = events ?? [];
    const hasIn = list.some((e) => e.kind === "check_in");
    const hasOut = list.some((e) => e.kind === "check_out");

    if (hasIn && hasOut) {
      const out = list.filter((e) => e.kind === "check_out").pop()!;
      return {
        ok: false as const,
        message: `You already checked out at ${zoned(new Date(out.effective_at), settings.timezone).hm}.`,
      };
    }

    const kind = hasIn ? "check_out" : "check_in";

    if (kind === "check_out") {
      const lastIn = list.filter((e) => e.kind === "check_in").pop()!;
      const dwell = (now.getTime() - new Date(lastIn.raw_at).getTime()) / 1000;
      if (dwell < settings.min_dwell_seconds) {
        return {
          ok: false as const,
          message: `You just checked in. Wait ${Math.ceil(settings.min_dwell_seconds - dwell)}s before checking out.`,
        };
      }
    }

    const effective =
      kind === "check_in" ? clampCheckIn(now, workDate, settings) : now;

    await admin.from("attendance_events").insert({
      user_id: context.userId,
      work_date: workDate,
      kind,
      raw_at: now.toISOString(),
      effective_at: effective.toISOString(),
      source: "qr_scan",
      created_by: context.userId,
    });

    const day = await recomputeDay(admin, context.userId, workDate, settings);
    await audit(admin, {
      actor_id: context.userId,
      action: kind,
      entity: "attendance_events",
      entity_id: workDate,
      payload: { clientTime: data.clientTime ?? null },
    });

    return {
      ok: true as const,
      kind,
      workDate,
      time: zoned(effective, settings.timezone).hm,
      rawTime: zoned(now, settings.timezone).hm,
      name: `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim(),
      totals: {
        gross: day.gross_minutes,
        break: day.break_minutes,
        net: day.net_minutes,
        late: day.late_minutes,
      },
    };
  });

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(10),
        first_name: z.string().min(1),
        last_name: z.string().min(1),
        employee_code: z.string().optional(),
        phone: z.string().optional(),
        department: z.string().optional(),
        position: z.string().optional(),
        hire_date: z.string().optional(),
        role: z.enum(["employee", "manager", "admin"]).default("employee"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requirePermission(context as never, "employees.manage");
    const { admin, audit } = await loadServer();
    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { must_change_password: true },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the account.");

    const { error: pErr } = await admin.from("profiles").insert({
      id: created.user.id,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      employee_code: data.employee_code || null,
      phone: data.phone || null,
      department: data.department || null,
      position: data.position || null,
      hire_date: data.hire_date || null,
      status: "active",
    });
    if (pErr) throw new Error(pErr.message);
    await admin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    await audit(admin, {
      actor_id: context.userId,
      action: "create_employee",
      entity: "profiles",
      entity_id: created.user.id,
      payload: { email: data.email, role: data.role },
    });
    return { ok: true, id: created.user.id };
  });

export const updateEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        employee_code: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        department: z.string().nullable().optional(),
        position: z.string().nullable().optional(),
        hire_date: z.string().nullable().optional(),
        status: z.enum(["active", "suspended", "archived"]).optional(),
        notes: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requirePermission(context as never, "employees.manage");
    const { admin, audit } = await loadServer();
    const { id, ...patch } = data;
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    ) as Record<string, never>;
    const { error } = await admin
      .from("profiles")
      .update({ ...clean, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    if (patch.status && patch.status !== "active") {
      await admin.auth.admin.signOut(id).catch(() => undefined);
    }
    await audit(admin, {
      actor_id: context.userId,
      action: "update_employee",
      entity: "profiles",
      entity_id: id,
      payload: patch,
    });
    return { ok: true };
  });

export const setEmployeePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), password: z.string().min(10) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requirePermission(context as never, "employees.reset_password");
    const { admin, audit } = await loadServer();
    const { error } = await admin.auth.admin.updateUserById(data.id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    await audit(admin, {
      actor_id: context.userId,
      action: "reset_password",
      entity: "auth.users",
      entity_id: data.id,
    });
    return { ok: true };
  });

/** FR-30 — manual correction. Append-only event + mandatory reason. */
export const manualCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        user_id: z.string().uuid(),
        work_date: z.string(),
        check_in: z.string().nullable().optional(),
        check_out: z.string().nullable().optional(),
        reason: z.string().min(3),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requirePermission(context as never, "records.correct");
    const { admin, getSettings, recomputeDay, audit } = await loadServer();
    const { instantAt } = await import("./attendance-rules");
    const settings = await getSettings(admin);

    const before = await admin
      .from("attendance_days")
      .select("*")
      .eq("user_id", data.user_id)
      .eq("work_date", data.work_date)
      .maybeSingle();

    const rows: Array<Record<string, unknown>> = [];
    const now = new Date().toISOString();
    if (data.check_in) {
      const at = instantAt(data.work_date, parseHm(data.check_in), settings.timezone);
      rows.push({
        user_id: data.user_id,
        work_date: data.work_date,
        kind: "check_in",
        raw_at: now,
        effective_at: at.toISOString(),
        source: "admin_manual",
        reason: data.reason,
        created_by: context.userId,
      });
    }
    if (data.check_out) {
      const at = instantAt(data.work_date, parseHm(data.check_out), settings.timezone);
      rows.push({
        user_id: data.user_id,
        work_date: data.work_date,
        kind: "check_out",
        raw_at: now,
        effective_at: at.toISOString(),
        source: "admin_manual",
        reason: data.reason,
        created_by: context.userId,
      });
    }
    if (rows.length === 0) throw new Error("Provide a check-in and/or check-out time.");
    const { error } = await admin.from("attendance_events").insert(rows as never);
    if (error) throw new Error(error.message);

    const day = await recomputeDay(admin, data.user_id, data.work_date, settings);
    await audit(admin, {
      actor_id: context.userId,
      action: "manual_correction",
      entity: "attendance_days",
      entity_id: `${data.user_id}:${data.work_date}`,
      reason: data.reason,
      payload: { before: before.data, after: day },
    });
    return { ok: true };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        org_name: z.string().min(1),
        timezone: z.string().min(1),
        shift_start: z.string(),
        shift_end: z.string(),
        qr_open: z.string(),
        daily_cutoff: z.string(),
        grace_minutes: z.number().int().min(0),
        break_threshold_minutes: z.number().int().min(0),
        break_deduction_minutes: z.number().int().min(0),
        count_unapproved_overtime: z.boolean(),
        min_dwell_seconds: z.number().int().min(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requirePermission(context as never, "settings.manage");
    const { admin, audit } = await loadServer();
    const { error } = await admin
      .from("settings")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    await audit(admin, {
      actor_id: context.userId,
      action: "update_settings",
      entity: "settings",
      entity_id: "1",
      payload: data,
    });
    return { ok: true };
  });

/** Change a user's role. Admin-only (roles.manage). */
export const setEmployeeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        role: z.enum(["employee", "manager", "admin"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requirePermission(context as never, "roles.manage");
    const { admin, audit } = await loadServer();
    if (data.id === context.userId && data.role !== "admin") {
      throw new Error("You cannot remove your own administrator role.");
    }
    await admin.from("user_roles").delete().eq("user_id", data.id);
    const { error } = await admin
      .from("user_roles")
      .insert({ user_id: data.id, role: data.role });
    if (error) throw new Error(error.message);
    await audit(admin, {
      actor_id: context.userId,
      action: "set_role",
      entity: "user_roles",
      entity_id: data.id,
      payload: { role: data.role },
    });
    return { ok: true };
  });
