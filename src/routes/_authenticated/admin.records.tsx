import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, PencilLine } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions, useSettings } from "@/hooks/use-chrono";
import { supabase } from "@/integrations/supabase/client";
import { decimalHours, formatMinutes, pairSessions, zoned } from "@/lib/attendance-rules";
import { manualCorrection } from "@/lib/chrono.functions";

export const Route = createFileRoute("/_authenticated/admin/records")({
  head: () => ({
    meta: [
      { title: "Attendance records — ChronoDesk" },
      {
        name: "description",
        content: "Filter attendance by employee, day or month, correct entries and export payroll-ready CSV.",
      },
      { property: "og:title", content: "Attendance records — ChronoDesk" },
      { property: "og:description", content: "Timesheets, corrections and CSV export." },
    ],
  }),
  component: RecordsPage,
});

type SessionRow = { in: string | null; out: string | null };

type Row = {
  id: string;
  user_id: string;
  work_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  gross_minutes: number;
  break_minutes: number;
  net_minutes: number;
  late_minutes: number;
  overtime_minutes: number;
  undertime_minutes: number;
  status: string;
  profiles: { first_name: string; last_name: string; employee_code: string | null } | null;
  sessions: SessionRow[];
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

function weekdayName(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y!, m! - 1, d!)),
  );
}

function csvCell(v: unknown) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function csvRow(values: unknown[]) {
  return values.map(csvCell).join(",");
}

function downloadCsv(name: string, lines: string[]) {
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function RecordsPage() {
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const correct = useServerFn(manualCorrection);
  const perms = usePermissions();

  const [editing, setEditing] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Array<{ in: string; out: string }>>([]);
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"daily" | "monthly">("daily");
  const [day, setDay] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [employee, setEmployee] = useState<string>("all");

  const perEmployee = employee !== "all";
  // A single employee is always shown as a full month of daily rows.
  const { from, to } = perEmployee
    ? monthRange(month)
    : mode === "daily"
      ? { from: day, to: day }
      : monthRange(month);
  const monthlyGroup = !perEmployee && mode === "monthly";
  const dailyGroup = !perEmployee && mode === "daily";

  const { data: staff } = useQuery({
    queryKey: ["records-staff"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,first_name,last_name,employee_code")
        .order("first_name", { ascending: true });
      return data ?? [];
    },
  });

  const { data } = useQuery({
    queryKey: ["records", from, to, employee],
    refetchInterval: 10000,
    queryFn: async () => {
      let dayQuery = supabase
        .from("attendance_days")
        .select("*")
        .gte("work_date", from)
        .lte("work_date", to);
      if (employee !== "all") dayQuery = dayQuery.eq("user_id", employee);
      const { data: days } = await dayQuery.order("work_date", { ascending: false });
      const list = days ?? [];
      const ids = [...new Set(list.map((d) => d.user_id))];

      const { data: profiles } = ids.length
        ? await supabase
            .from("profiles")
            .select("id,first_name,last_name,employee_code")
            .in("id", ids)
        : { data: [] };

      let eventQuery = supabase
        .from("attendance_events")
        .select("user_id,work_date,kind,effective_at")
        .gte("work_date", from)
        .lte("work_date", to);
      if (employee !== "all") eventQuery = eventQuery.eq("user_id", employee);
      const { data: events } = await eventQuery.order("effective_at", { ascending: true });

      const grouped = new Map<string, Array<{ kind: string; effective_at: string }>>();
      for (const e of events ?? []) {
        const key = `${e.user_id}|${e.work_date}`;
        const arr = grouped.get(key) ?? [];
        arr.push({ kind: e.kind as string, effective_at: e.effective_at as string });
        grouped.set(key, arr);
      }
      const sessionsByKey = new Map<string, SessionRow[]>();
      for (const [key, evs] of grouped) {
        sessionsByKey.set(
          key,
          pairSessions(evs).map((s) => ({
            in: s.in ? s.in.toISOString() : null,
            out: s.out ? s.out.toISOString() : null,
          })),
        );
      }

      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      const rows = list.map((d) => ({
        ...d,
        profiles: byId.get(d.user_id) ?? null,
        sessions: sessionsByKey.get(`${d.user_id}|${d.work_date}`) ?? [],
      })) as unknown as Row[];
      rows.sort((a, b) => {
        const na = `${a.profiles?.first_name ?? ""} ${a.profiles?.last_name ?? ""}`;
        const nb = `${b.profiles?.first_name ?? ""} ${b.profiles?.last_name ?? ""}`;
        return na.localeCompare(nb) || b.work_date.localeCompare(a.work_date);
      });
      return rows;
    },
  });

  const rows = data ?? [];
  const orgName = (settings as { org_name?: string } | undefined)?.org_name ?? "ChronoDesk";
  const tz = settings?.timezone ?? "Europe/Berlin";
  const hm = (iso: string | null) => (iso ? zoned(new Date(iso), tz).hm : "—");
  const sessionsOf = (r: Row) =>
    r.sessions.length ? r.sessions : [{ in: r.check_in_at, out: r.check_out_at }];

  const fix = useMutation({
    mutationFn: (vars: {
      user_id: string;
      work_date: string;
      check_in?: string | null;
      check_out?: string | null;
      sessions?: Array<{ in: string | null; out: string | null }>;
      reason: string;
    }) => correct({ data: vars }),
    onSuccess: () => {
      toast.success("Correction saved and logged");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["records"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function exportCsv() {
    const who =
      employee === "all"
        ? "All employees"
        : (() => {
            const p = staff?.find((s) => s.id === employee);
            return p ? `${p.first_name} ${p.last_name}` : "Employee";
          })();
    const title = monthlyGroup
      ? "Monthly totals per employee"
      : dailyGroup
        ? "Daily totals per employee"
        : "Monthly attendance report";

    const head = [
      csvRow([orgName]),
      csvRow([title]),
      csvRow(["Period", perEmployee ? month : mode === "daily" ? day : month]),
      csvRow(["Employees", who]),
      csvRow(["Generated", new Date().toLocaleString()]),
      "",
    ];

    let body: string[];
    let file: string;

    if (monthlyGroup) {
      const totals = new Map<string, { name: string; code: string; net: number; days: number }>();
      for (const r of rows) {
        const prev = totals.get(r.user_id) ?? {
          name: r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : "Unknown",
          code: r.profiles?.employee_code ?? "",
          net: 0,
          days: 0,
        };
        prev.net += r.net_minutes;
        prev.days += r.net_minutes > 0 ? 1 : 0;
        totals.set(r.user_id, prev);
      }
      body = [
        csvRow(["Employee", "Code", "Days worked", "Total hours (hh:mm)", "Total hours (decimal)"]),
        ...[...totals.values()]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((t) => csvRow([t.name, t.code, t.days, formatMinutes(t.net), decimalHours(t.net)])),
      ];
      file = `${orgName}-monthly-totals-${month}.csv`;
    } else if (dailyGroup) {
      body = [
        csvRow(["Employee", "Code", "Date", "Day", "Total hours (hh:mm)", "Total hours (decimal)"]),
        ...rows.map((r) =>
          csvRow([
            r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : "Unknown",
            r.profiles?.employee_code ?? "",
            r.work_date,
            weekdayName(r.work_date),
            formatMinutes(r.net_minutes),
            decimalHours(r.net_minutes),
          ]),
        ),
        "",
        csvRow([
          "Total",
          "",
          "",
          "",
          formatMinutes(rows.reduce((s, r) => s + r.net_minutes, 0)),
          decimalHours(rows.reduce((s, r) => s + r.net_minutes, 0)),
        ]),
      ];
      file = `${orgName}-daily-totals-${day}.csv`;
    } else {
      body = [
        csvRow([
          "Employee",
          "Code",
          "Date",
          "Day",
          "Worked hours (hh:mm)",
          "Worked hours (decimal)",
        ]),
      ];
      let grand = 0;
      for (const r of rows) {
        grand += r.net_minutes;
        const name = r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : "Unknown";
        const code = r.profiles?.employee_code ?? "";
        body.push(
          csvRow([
            name,
            code,
            r.work_date,
            weekdayName(r.work_date),
            formatMinutes(r.net_minutes),
            decimalHours(r.net_minutes),
          ]),
        );
      }
      body.push("");
      body.push(
        csvRow([
          "Total",
          "",
          "",
          "",
          formatMinutes(grand),
          decimalHours(grand),
        ]),
      );
      file = `${orgName}-${who}-${month}.csv`;
    }

    downloadCsv(file.replace(/\s+/g, "-"), [...head, ...body]);
  }

  const totalNet = rows.reduce((sum, r) => sum + r.net_minutes, 0);

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-end gap-3 border-b border-border px-5 py-4">
        <div className="space-y-1">
          <Label>Employee</Label>
          <Select value={employee} onValueChange={setEmployee}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All employees</SelectItem>
              {(staff ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!perEmployee && (
          <div className="space-y-1">
            <Label>Period</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "daily" | "monthly")}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {dailyGroup ? (
          <div className="space-y-1">
            <Label htmlFor="day">Date</Label>
            <Input id="day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="month">Month</Label>
            <Input
              id="month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
        )}
        <Button
          variant="outline"
          className="ml-auto"
          onClick={exportCsv}
          disabled={!rows.length || !perms.can("records.export")}
        >
          <Download className="mr-2 size-4" />
          {monthlyGroup ? "Export monthly totals" : dailyGroup ? "Export daily totals" : "Export CSV"}
        </Button>
      </div>

      {monthlyGroup ? (
        <MonthlyTotals rows={rows} />
      ) : dailyGroup ? (
        <DailyTotals rows={rows} />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead>Worked</TableHead>
                <TableHead>Late</TableHead>
                <TableHead className="text-right">Fix</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...rows]
                .sort((a, b) => a.work_date.localeCompare(b.work_date))
                .map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="tabular font-medium">{r.work_date}</TableCell>
                  <TableCell>{weekdayName(r.work_date)}</TableCell>
                  <TableCell className="tabular">
                    <div className="flex flex-col gap-0.5">
                      {sessionsOf(r).map((s, i) => (
                        <span key={i} className="text-sm">
                          {i + 1}. {hm(s.in)} → {hm(s.out)}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="tabular font-semibold">
                    {formatMinutes(r.net_minutes)}
                  </TableCell>
                  <TableCell className="tabular">{r.late_minutes}m</TableCell>
                  <TableCell className="text-right">
                    {perms.can("records.correct") ? (
                      <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                        <PencilLine className="size-4" />
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No records in this range.
                  </TableCell>
                </TableRow>
              )}
              {rows.length > 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-medium">
                    Total
                  </TableCell>
                  <TableCell className="tabular font-semibold">
                    {formatMinutes(totalNet)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual correction</DialogTitle>
            <DialogDescription>
              {editing
                ? `${editing.profiles?.first_name ?? ""} ${editing.profiles?.last_name ?? ""} · ${editing.work_date}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!editing) return;
              const form = new FormData(e.currentTarget);
              fix.mutate({
                user_id: editing.user_id,
                work_date: editing.work_date,
                check_in: String(form.get("check_in") || "") || null,
                check_out: String(form.get("check_out") || "") || null,
                reason: String(form.get("reason")),
              });
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="check_in">Check in</Label>
                <Input id="check_in" name="check_in" type="time" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="check_out">Check out</Label>
                <Input id="check_out" name="check_out" type="time" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (required, stored in the audit log)</Label>
              <Input id="reason" name="reason" required minLength={3} />
            </div>
            <Button type="submit" className="w-full" disabled={fix.isPending}>
              Save correction
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MonthlyTotals({ rows }: { rows: Row[] }) {
  return <TotalsTable rows={rows} label="Days worked" />;
}

function DailyTotals({ rows }: { rows: Row[] }) {
  return <TotalsTable rows={rows} label="Sessions" daily />;
}

function TotalsTable({ rows, label, daily }: { rows: Row[]; label: string; daily?: boolean }) {
  const totals = new Map<string, { name: string; code: string; net: number; days: number }>();
  for (const r of rows) {
    const prev = totals.get(r.user_id) ?? {
      name: r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : "Unknown",
      code: r.profiles?.employee_code ?? "",
      net: 0,
      days: 0,
    };
    prev.net += r.net_minutes;
    prev.days += daily
      ? Math.max(r.sessions.length, r.check_in_at ? 1 : 0)
      : r.net_minutes > 0
        ? 1
        : 0;
    totals.set(r.user_id, prev);
  }
  const list = [...totals.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>{label}</TableHead>
            <TableHead>Total hours</TableHead>
            <TableHead className="text-right">Decimal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((t) => (
            <TableRow key={t.name + t.code}>
              <TableCell className="font-medium">{t.name}</TableCell>
              <TableCell className="tabular">{t.code || "—"}</TableCell>
              <TableCell className="tabular">{t.days}</TableCell>
              <TableCell className="tabular font-semibold">{formatMinutes(t.net)}</TableCell>
              <TableCell className="tabular text-right">{decimalHours(t.net)}</TableCell>
            </TableRow>
          ))}
          {list.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                No records for this month.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
