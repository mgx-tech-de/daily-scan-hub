# Edit employees + non-overlapping alerts

Your uploaded project is identical to the current one (except the connection settings file, which stays untouched). Only the two changes below are added.

## 1. Edit employee details (Admin → Employees)
- New "Edit" (pencil) button on each employee row, visible to admins (employees.manage permission).
- Dialog prefilled with: First name, Surname, Email, and an optional New password (min 10 characters; leave blank to keep current).
- Saving updates the sign-in account directly (email + password) and the employee profile (name + email), then refreshes the list. Email change is applied immediately without needing a confirmation email.
- Clear error if the email is already used by another account. Change is recorded in the audit log.

## 2. Alerts no longer stack on top of each other
- Check-in/check-out notifications and other alerts move to the bottom-right corner (bottom-center on phones), shown as a spaced, expanded list so simultaneous alerts appear one under the other instead of overlapping.
- The scan receipt panel under the scanner stays as is.

## Technical details
- `chrono.functions.ts`: extend `updateEmployee` to accept `email`; when email/password given, call `admin.auth.admin.updateUserById(id, { email, email_confirm: true, password })`, then update `profiles` (first_name, last_name, email). Permission: `employees.manage`.
- `admin.employees.tsx`: add edit dialog + mutation.
- `__root.tsx`: `<Toaster richColors expand position="bottom-right" gap={10} visibleToasts={5} />`.
