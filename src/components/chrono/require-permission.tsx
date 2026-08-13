import type { ReactNode } from "react";

import { usePermissions } from "@/hooks/use-chrono";
import type { Permission } from "@/lib/permissions";

export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const perms = usePermissions();

  if (perms.loading) {
    return <p className="text-sm text-muted-foreground">Checking permissions…</p>;
  }

  if (!perms.can(permission)) {
    return (
      <div className="panel p-6">
        <h1 className="font-display text-lg font-semibold">Not available for your role</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This section is restricted to administrators.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
