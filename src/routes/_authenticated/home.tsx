import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, LogIn, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/chrono/app-shell";
import { QrScanner } from "@/components/chrono/qr-scanner";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSettings, useUser } from "@/hooks/use-chrono";
import { supabase } from "@/integrations/supabase/client";
import { formatMinutes, zoned } from "@/lib/attendance-rules";
import { scanQr } from "@/lib/chrono.functions";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "My day — ChronoDesk" },
      {
        name: "description",
        content: "Scan the daily QR code to check in or out and review your attendance history.",
      },
      { property: "og:title", content: "My day — ChronoDesk" },
      { property: "og:description", content: "Employee check-in, check-out and hours worked." },
    ],
  }),
  component: HomePage,
});

type ScanOk = Extract<Awaited<ReturnType<typeof scanQr>>, { ok: true }>;

function HomePage() {
  const { user } = useUser();
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const scan = useServerFn(scanQr);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<ScanOk | null>(null);

  const today = settings ? zoned(new Date(), settings.timezone).date : "";

  const history = useQuery({
    queryKey: ["my-days", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_days")
        .select("*")
        .eq("user_id", user!.id)
        .order("work_date", { ascending: false })
        .limit(60);
      return data ?? [];
    },
  });

  const days = history.data ?? [];
  const todayRow = days.find((d) => d.work_date === today);
  const monthPrefix = today.slice(0, 7);
  const monthNet = days
    .filter((d) => d.work_date.startsWith(monthPrefix))
    .reduce((sum, d) => sum + d.net_minutes, 0);
  const totalNet = days.reduce((sum, d) => sum + d.net_minutes, 0);

  async function handleResult(payload: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await scan({ data: { payload, clientTime: new Date().toISOString() } });
      if (!res.ok) {
        toast.error(res.message);
      } else {
        setReceipt(res);
        toast.success(res.kind === "check_in" ? "Checked in" : "Checked out");
        qc.invalidateQueries({ queryKey: ["my-days"] });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <section className="panel p-5">
          <h1 className="font-display text-xl font-semibold">Scan the workplace code</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {settings
              ? `Open ${settings.qr_open}–${settings.daily_cutoff}. First scan checks you in, the next checks you out.`
              : "Loading…"}
          </p>
          <div className="mt-4">
            <QrScanner onResult={handleResult} busy={busy} />
          </div>

          {receipt && (
            <div
              role="status"
              className="mt-5 rounded-xl border border-success/40 bg-success/10 p-4"
            >
              <div className="flex items-center gap-2">
                {receipt.kind === "check_in" ? (
                  <LogIn className="size-5 text-success" aria-hidden />
                ) : (
                  <LogOut className="size-5 text-success" aria-hidden />
                )}
                <span className="font-display text-sm font-semibold uppercase tracking-wide text-success">
                  {receipt.kind === "check_in" ? "Check in" : "Check out"}
                </span>
              </div>
              <p className="mt-2 text-lg font-semibold">{receipt.name || "Employee"}</p>
              <p className="tabular text-sm text-muted-foreground">
                {receipt.time} · {receipt.workDate}
              </p>
              {receipt.kind === "check_out" && (
                <dl className="tabular mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Gross</dt>
                    <dd>{formatMinutes(receipt.totals.gross)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Break</dt>
                    <dd>{formatMinutes(receipt.totals.break)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Net</dt>
                    <dd className="font-semibold">{formatMinutes(receipt.totals.net)}</dd>
                  </div>
                </dl>
              )}
            </div>
          )}
        </section>

        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Today (net)" value={formatMinutes(todayRow?.net_minutes ?? 0)} />
            <Stat label="This month" value={formatMinutes(monthNet)} />
            <Stat label="Recorded total" value={formatMinutes(totalNet)} />
          </div>

          <div className="panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <CheckCircle2 className="size-4 text-primary" aria-hidden />
              <h2 className="font-display text-base font-semibold">My attendance history</h2>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>In</TableHead>
                    <TableHead>Out</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Break</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {days.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="tabular">{d.work_date}</TableCell>
                      <TableCell className="tabular">
                        {d.check_in_at && settings
                          ? zoned(new Date(d.check_in_at), settings.timezone).hm
                          : "—"}
                      </TableCell>
                      <TableCell className="tabular">
                        {d.check_out_at && settings
                          ? zoned(new Date(d.check_out_at), settings.timezone).hm
                          : "—"}
                      </TableCell>
                      <TableCell className="tabular">{formatMinutes(d.gross_minutes)}</TableCell>
                      <TableCell className="tabular">{formatMinutes(d.break_minutes)}</TableCell>
                      <TableCell className="tabular font-semibold">
                        {formatMinutes(d.net_minutes)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={d.status === "present" ? "secondary" : "destructive"}>
                          {d.status}
                          {d.late_minutes > 0 ? ` · late ${d.late_minutes}m` : ""}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {days.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        No attendance recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="tabular mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}