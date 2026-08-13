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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions, useSettings } from "@/hooks/use-chrono";
import { supabase } from "@/integrations/supabase/client";
import { decimalHours, formatMinutes, zoned } from "@/lib/attendance-rules";
import { manualCorrection } from "@/lib/chrono.functions";

export const Route = createFileRoute("/_authenticated/admin/records")({
  head: () => ({
    meta: [
      { title: "Attendance records — ChronoDesk" },
      {
        name: "description",
        content: "Filter attendance by date range, correct entries and export payroll-ready CSV.",
      },
      { property: "og:title", content: "Attendance records — ChronoDesk" },
      { property: "og:description", content: "Timesheets, corrections and CSV export." },
    ],
  }),
  component: RecordsPage,
});

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
};

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function RecordsPage() {
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const correct = useServerFn(manualCorrection);
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [editing, setEditing] = useState<Row | null>(null);

  const { data } = useQuery({
    queryKey: ["records", from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_days")
        .select("*, profiles(first_name,last_name,employee_code)")
        .gte("work_date", from)
        .lte("work_date", to)
        .order("work_date", { ascending: false });
      return (data ?? []) as unknown as Row[];
    },
  });

  const perms = usePermissions();
  const rows = data ?? [];

  const fix = useMutation({
    mutationFn: (vars: {
      user_id: string;
      work_date: string;
      check_in?: string | null;
      check_out?: string | null;
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
    const header = [
      "employee",
      "code",
      "date",
      "check_in",
      "check_out",
      "gross_hours",
      "break_minutes",
      "net_hours",
      "late_minutes",
      "overtime_minutes",
      "status",
    ];
    const lines = rows.map((r) =>
      [
        r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : "",
        r.profiles?.employee_code ?? "",
        r.work_date,
        r.check_in_at && settings ? zoned(new Date(r.check_in_at), settings.timezone).hm : "",
        r.check_out_at && settings ? zoned(new Date(r.check_out_at), settings.timezone).hm : "",
        decimalHours(r.gross_minutes),
        String(r.break_minutes),
        decimalHours(r.net_minutes),
        String(r.late_minutes),
        String(r.overtime_minutes),
        r.status,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chronodesk-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-end gap-3 border-b border-border px-5 py-4">
        <div className="space-y-1">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button
          variant="outline"
          className="ml-auto"
          onClick={exportCsv}
          disabled={!rows.length || !perms.can("records.export")}
        >
          <Download className="mr-2 size-4" /> Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>In</TableHead>
              <TableHead>Out</TableHead>
              <TableHead>Net</TableHead>
              <TableHead>Late</TableHead>
              <TableHead>OT</TableHead>
              <TableHead className="text-right">Fix</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  {r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : "Unknown"}
                </TableCell>
                <TableCell className="tabular">{r.work_date}</TableCell>
                <TableCell className="tabular">
                  {r.check_in_at && settings
                    ? zoned(new Date(r.check_in_at), settings.timezone).hm
                    : "—"}
                </TableCell>
                <TableCell className="tabular">
                  {r.check_out_at && settings
                    ? zoned(new Date(r.check_out_at), settings.timezone).hm
                    : "—"}
                </TableCell>
                <TableCell className="tabular font-semibold">
                  {formatMinutes(r.net_minutes)}
                </TableCell>
                <TableCell className="tabular">{r.late_minutes}m</TableCell>
                <TableCell className="tabular">{formatMinutes(r.overtime_minutes)}</TableCell>
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
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  No records in this range.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
