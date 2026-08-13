import { Link, Outlet, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/chrono/app-shell";
import { usePermissions } from "@/hooks/use-chrono";
import type { Permission } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const TABS = [
  { to: "/admin", label: "Live board", exact: true, permission: "board.view" },
  { to: "/admin/employees", label: "Employees", permission: "employees.view" },
  { to: "/admin/records", label: "Records", permission: "records.view" },
  { to: "/admin/qr", label: "Daily QR", permission: "qr.view" },
  { to: "/admin/settings", label: "Settings", permission: "settings.manage" },
  { to: "/admin/audit", label: "Audit log", permission: "audit.view" },
] as const satisfies ReadonlyArray<{
  to: string;
  label: string;
  exact?: true;
  permission: Permission;
}>;

function AdminLayout() {
  const perms = usePermissions();

  if (perms.loading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Checking permissions…</p>
      </AppShell>
    );
  }

  if (!perms.can("admin.access")) {
    return (
      <AppShell>
        <div className="panel p-6">
          <h1 className="font-display text-lg font-semibold">Restricted area</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account does not have administrator or manager access.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <nav className="mb-6 flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {TABS.filter((tab) => perms.can(tab.permission)).map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            activeOptions={{ exact: "exact" in tab }}
            activeProps={{ className: "bg-primary text-primary-foreground" }}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </AppShell>
  );
}