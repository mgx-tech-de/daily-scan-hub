import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSettings } from "@/hooks/use-chrono";
import { supabase } from "@/integrations/supabase/client";
import { formatMinutes, zoned } from "@/lib/attendance-rules";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Live attendance board — ChronoDesk" },
      { name: "description", content: "Who is on site right now, with hours worked today." },
      { property: "og:title", content: "Live attendance board — ChronoDesk" },
      { property: "og:description", content: "Real-time presence and daily totals for your team." },
    ],
  }),
  component: LiveBoard,
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
  status: string;
  profiles: { first_name: string; last_name: string; department: string | null } | null;
};

function LiveBoard() {
  const { data: settings } = useSettings();
  const today = settings ? zoned(new Date(), settings.timezone).date : "";

  const { data } = useQuery({
    queryKey: ["live-board", today],
    enabled: !!today,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_days")
        .select("*, profiles(first_name,last_name,department)")
        .eq("work_date", today)
        .order("check_in_at", { ascending: true });
      return (data ?? []) as unknown as Row[];
    },
  });

  const rows = data ?? [];
  const onSite = rows.filter((r) => r.check_in_at && !r.check_out_at);
  const late = rows.filter((r) => r.late_minutes > 0);
  const netTotal = rows.reduce((s, r) => s + r.net_minutes, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Scanned in today" value={String(rows.length)} />
        <Stat label="Currently on site" value={String(onSite.length)} />
        <Stat label="Late arrivals" value={String(late.length)} />
        <Stat label="Net hours logged" value={formatMinutes(netTotal)} />
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h1 className="font-display text-base font-semibold">Today · {today || "—"}</h1>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>In</TableHead>
                <TableHead>Out</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Overtime</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : "Unknown"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.profiles?.department ?? "—"}
                  </TableCell>
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
                  <TableCell className="tabular">{formatMinutes(r.overtime_minutes)}</TableCell>
                  <TableCell>
                    {r.check_in_at && !r.check_out_at ? (
                      <Badge>On site</Badge>
                    ) : (
                      <Badge variant="secondary">{r.status}</Badge>
                    )}
                    {r.late_minutes > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        Late {r.late_minutes}m
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No scans yet today.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
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
