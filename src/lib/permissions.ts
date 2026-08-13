export type AppRole = "admin" | "manager" | "employee";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrator",
  manager: "Manager",
  employee: "Employee",
};

export const PERMISSIONS = [
  "admin.access",
  "board.view",
  "employees.view",
  "employees.manage",
  "employees.reset_password",
  "roles.manage",
  "records.view",
  "records.export",
  "records.correct",
  "qr.view",
  "qr.rotate",
  "settings.manage",
  "audit.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const MANAGER_PERMISSIONS: Permission[] = [
  "admin.access",
  "board.view",
  "employees.view",
  "records.view",
  "records.export",
  "records.correct",
  "qr.view",
];

export const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  admin: PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  employee: [],
};

export function permissionsFor(roles: readonly string[] | undefined | null): Set<Permission> {
  const set = new Set<Permission>();
  for (const role of roles ?? []) {
    const list = ROLE_PERMISSIONS[role as AppRole];
    if (list) list.forEach((p) => set.add(p));
  }
  return set;
}

export function can(roles: readonly string[] | undefined | null, permission: Permission) {
  return permissionsFor(roles).has(permission);
}

export function highestRole(roles: readonly string[] | undefined | null): AppRole | null {
  if (!roles?.length) return null;
  if (roles.includes("admin")) return "admin";
  if (roles.includes("manager")) return "manager";
  if (roles.includes("employee")) return "employee";
  return null;
}
