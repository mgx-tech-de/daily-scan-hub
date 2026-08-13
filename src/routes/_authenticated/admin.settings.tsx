import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/hooks/use-chrono";
import { saveSettings } from "@/lib/chrono.functions";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Attendance settings — ChronoDesk" },
      {
        name: "description",
        content: "Configure shift hours, grace period, automatic break deduction and scan window.",
      },
      { property: "og:title", content: "Attendance settings — ChronoDesk" },
      { property: "og:description", content: "Shift rules that drive every calculation." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const save = useServerFn(saveSettings);

  const mut = useMutation({
    mutationFn: (form: FormData) =>
      save({
        data: {
          org_name: String(form.get("org_name")),
          timezone: String(form.get("timezone")),
          shift_start: String(form.get("shift_start")),
          shift_end: String(form.get("shift_end")),
          qr_open: String(form.get("qr_open")),
          daily_cutoff: String(form.get("daily_cutoff")),
          grace_minutes: Number(form.get("grace_minutes")),
          break_threshold_minutes: Number(form.get("break_threshold_minutes")),
          break_deduction_minutes: Number(form.get("break_deduction_minutes")),
          count_unapproved_overtime: form.get("count_unapproved_overtime") === "on",
          min_dwell_seconds: Number(form.get("min_dwell_seconds")),
        },
      }),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!settings) return <p className="text-sm text-muted-foreground">Loading settings…</p>;

  return (
    <form
      className="panel space-y-6 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate(new FormData(e.currentTarget));
      }}
    >
      <div>
        <h1 className="font-display text-base font-semibold">Attendance rules</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          These values drive clamping, lateness, break deduction and overtime for every scan.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field name="org_name" label="Organisation" defaultValue={settings.org_name} />
        <Field name="timezone" label="Timezone" defaultValue={settings.timezone} />
        <Field name="shift_start" label="Shift start" type="time" defaultValue={settings.shift_start} />
        <Field name="shift_end" label="Shift end" type="time" defaultValue={settings.shift_end} />
        <Field name="qr_open" label="Scan window opens" type="time" defaultValue={settings.qr_open} />
        <Field name="daily_cutoff" label="Scan window closes" type="time" defaultValue={settings.daily_cutoff} />
        <Field
          name="grace_minutes"
          label="Grace period (min)"
          type="number"
          defaultValue={String(settings.grace_minutes)}
        />
        <Field
          name="break_threshold_minutes"
          label="Break threshold (min worked)"
          type="number"
          defaultValue={String(settings.break_threshold_minutes)}
        />
        <Field
          name="break_deduction_minutes"
          label="Break deduction (min)"
          type="number"
          defaultValue={String(settings.break_deduction_minutes)}
        />
        <Field
          name="min_dwell_seconds"
          label="Min seconds between scans"
          type="number"
          defaultValue={String(settings.min_dwell_seconds)}
        />
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border p-4">
        <Switch
          id="count_unapproved_overtime"
          name="count_unapproved_overtime"
          defaultChecked={settings.count_unapproved_overtime}
        />
        <Label htmlFor="count_unapproved_overtime" className="font-normal">
          Count unapproved overtime in payroll totals
        </Label>
      </div>

      <Button type="submit" disabled={mut.isPending}>
        {mut.isPending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | undefined;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} required />
    </div>
  );
}
