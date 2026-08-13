import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit log — ChronoDesk" },
      { name: "description", content: "Every administrative action recorded with actor and reason." },
      { property: "og:title", content: "Audit log — ChronoDesk" },
      { property: "og:description", content: "Traceable history of attendance changes." },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const { data } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_log")
        .select("id,created_at,action,entity,entity_id,reason")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const rows = data ?? [];

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="font-display text-base font-semibold">Audit log</h1>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="tabular">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell className="font-medium">{r.action}</TableCell>
                <TableCell className="text-muted-foreground">
                  {r.entity}
                  {r.entity_id ? ` · ${r.entity_id}` : ""}
                </TableCell>
                <TableCell className="text-muted-foreground">{r.reason ?? "—"}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Nothing recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
