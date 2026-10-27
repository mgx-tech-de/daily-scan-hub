import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Pencil, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-chrono";
import { createEmployee, setEmployeePassword, setEmployeeRole, updateEmployee } from "@/lib/chrono.functions";
import { ROLE_LABELS, type AppRole } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin/employees")({
  head: () => ({
    meta: [
      { title: "Employees — ChronoDesk" },
      { name: "description", content: "Create, edit, suspend and reset access for your workforce." },
      { property: "og:title", content: "Employees — ChronoDesk" },
      { property: "og:description", content: "Workforce directory and account management." },
    ],
  }),
  component: EmployeesPage,
});

type Profile = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  employee_code: string | null;
  department: string | null;
  position: string | null;
  status: string;
};

function EmployeesPage() {
  const perms = usePermissions();
  const qc = useQueryClient();
  const create = useServerFn(createEmployee);
  const update = useServerFn(updateEmployee);
  const setPassword = useServerFn(setEmployeePassword);
  const setRole = useServerFn(setEmployeeRole);
  const [open, setOpen] = useState(false);
  const [resetFor, setResetFor] = useState<Profile | null>(null);
  const [editFor, setEditFor] = useState<Profile | null>(null);

  const { data } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,email,first_name,last_name,employee_code,department,position,status")
        .order("first_name");
      return (data ?? []) as Profile[];
    },
  });

  const { data: roleRows } = useQuery({
    queryKey: ["employee-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id,role");
      return (data ?? []) as Array<{ user_id: string; role: AppRole }>;
    },
  });
  const roleByUser = new Map((roleRows ?? []).map((r) => [r.user_id, r.role]));

  const roleMut = useMutation({
    mutationFn: (vars: { id: string; role: AppRole }) => setRole({ data: vars }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["employee-roles"] });
      qc.invalidateQueries({ queryKey: ["role"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: (form: FormData) =>
      create({
        data: {
          email: String(form.get("email")),
          password: String(form.get("password")),
          first_name: String(form.get("first_name")),
          last_name: String(form.get("last_name")),
          employee_code: String(form.get("employee_code") || "") || undefined,
          department: String(form.get("department") || "") || undefined,
          position: String(form.get("position") || "") || undefined,
          role: (String(form.get("role") || "employee") as AppRole),
        },
      }),
    onSuccess: () => {
      toast.success("Employee created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (vars: { id: string; status: "active" | "suspended" }) =>
      update({ data: vars }),
    onSuccess: () => {
      toast.success("Employee updated");
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const passwordMut = useMutation({
    mutationFn: (vars: { id: string; password: string }) => setPassword({ data: vars }),
    onSuccess: () => {
      toast.success("Password updated");
      setResetFor(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editMut = useMutation({
    mutationFn: (vars: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      password?: string;
    }) => update({ data: vars }),
    onSuccess: () => {
      toast.success("Employee updated");
      setEditFor(null);
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data ?? [];

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <h1 className="font-display text-base font-semibold">Employees</h1>
        <span className="text-sm text-muted-foreground">{rows.length} accounts</span>
        {perms.can("employees.manage") && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="ml-auto">
              <UserPlus className="mr-2 size-4" /> New employee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create employee</DialogTitle>
              <DialogDescription>
                They sign in with this email and password to scan the daily code.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                createMut.mutate(new FormData(e.currentTarget));
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field name="first_name" label="First name" required />
                <Field name="last_name" label="Surname" required />
                <Field name="email" label="Email" type="email" required />
                <Field name="password" label="Temp password" type="text" required minLength={10} />
                <Field name="employee_code" label="Employee code" />
                <Field name="department" label="Department" />
                <Field name="position" label="Position" />
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    name="role"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    defaultValue="employee"
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMut.isPending}>
                {createMut.isPending ? "Creating…" : "Create employee"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  {p.first_name} {p.last_name}
                </TableCell>
                <TableCell className="tabular">{p.employee_code ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.email}</TableCell>
                <TableCell className="text-muted-foreground">{p.department ?? "—"}</TableCell>
                <TableCell>
                  {perms.can("roles.manage") ? (
                    <select
                      aria-label={`Role for ${p.first_name} ${p.last_name}`}
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                      value={roleByUser.get(p.id) ?? "employee"}
                      onChange={(e) =>
                        roleMut.mutate({ id: p.id, role: e.target.value as AppRole })
                      }
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {ROLE_LABELS[roleByUser.get(p.id) ?? "employee"]}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={p.status === "active" ? "secondary" : "destructive"}>
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  {!perms.can("employees.manage") && (
                    <span className="text-sm text-muted-foreground">View only</span>
                  )}
                  {perms.can("employees.manage") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditFor(p)}
                    aria-label={`Edit ${p.first_name}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  )}
                  {perms.can("employees.reset_password") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResetFor(p)}
                    aria-label={`Reset password for ${p.first_name}`}
                  >
                    <KeyRound className="size-4" />
                  </Button>
                  )}
                  {perms.can("employees.manage") && (
                  <Button
                    size="sm"
                    variant={p.status === "active" ? "destructive" : "default"}
                    onClick={() =>
                      statusMut.mutate({
                        id: p.id,
                        status: p.status === "active" ? "suspended" : "active",
                      })
                    }
                  >
                    {p.status === "active" ? "Suspend" : "Reactivate"}
                  </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No employees yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editFor} onOpenChange={(v) => !v && setEditFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit employee</DialogTitle>
            <DialogDescription>Changes apply to the sign-in account immediately.</DialogDescription>
          </DialogHeader>
          {editFor && (
            <form
              key={editFor.id}
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const pw = String(f.get("password") || "");
                editMut.mutate({
                  id: editFor.id,
                  first_name: String(f.get("first_name")).trim(),
                  last_name: String(f.get("last_name")).trim(),
                  email: String(f.get("email")).trim(),
                  password: pw || undefined,
                });
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <EditField name="first_name" label="First name" defaultValue={editFor.first_name} required />
                <EditField name="last_name" label="Surname" defaultValue={editFor.last_name} required />
              </div>
              <EditField name="email" label="Email" type="email" defaultValue={editFor.email} required />
              <div className="space-y-2">
                <Label htmlFor="edit-password">New password (optional)</Label>
                <Input id="edit-password" name="password" type="text" minLength={10} placeholder="Leave blank to keep current" />
              </div>
              <Button type="submit" className="w-full" disabled={editMut.isPending}>
                {editMut.isPending ? "Saving…" : "Save changes"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetFor} onOpenChange={(v) => !v && setResetFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              {resetFor ? `${resetFor.first_name} ${resetFor.last_name}` : ""}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              if (resetFor) {
                passwordMut.mutate({ id: resetFor.id, password: String(form.get("password")) });
              }
            }}
          >
            <Field name="password" label="New password" type="text" required minLength={10} />
            <Button type="submit" className="w-full" disabled={passwordMut.isPending}>
              Update password
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  minLength,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} minLength={minLength} />
    </div>
  );
}

function EditField({
  name,
  label,
  type = "text",
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`edit-${name}`}>{label}</Label>
      <Input id={`edit-${name}`} name={name} type={type} defaultValue={defaultValue} required={required} />
    </div>
  );
}
