import { Link, Outlet, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/chrono/app-shell";
import { useRole, useUser } from "@/hooks/use-chrono";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const TABS = [
  { to: "/admin", label: "Live board", exact: true },
  { to: "/admin/employees", label: "Employees" },
  { to: "/admin/records", label: "Records" },
  { to: "/admin/qr", label: "Daily QR" },
  { to: "/admin/settings", label: "Settings" },
  { to: "/admin/audit", label: "Audit log" },
] as const;

function AdminLayout() {
  const { user, loading } = useUser();
  const { data: roles, isLoading } = useRole(user?.id);

  if (loading || isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Checking permissions…</p>
      </AppShell>
    );
  }

  if (!roles?.includes("admin")) {
    return (
      <AppShell>
        <div className="panel p-6">
          <h1 className="font-display text-lg font-semibold">Admins only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account does not have administrator access.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <nav className="mb-6 flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {TABS.map((tab) => (
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