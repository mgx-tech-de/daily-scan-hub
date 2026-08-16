import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { RequirePermission } from "@/components/chrono/require-permission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/hooks/use-chrono";
import { saveSettings } from "@/lib/chrono.functions";
import { LANGUAGES, useLocale, type Lang, type Theme } from "@/lib/i18n";

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
  component: SettingsGuarded,
});

function SettingsGuarded() {
  return (
    <RequirePermission permission="settings.manage">
      <SettingsPage />
    </RequirePermission>
  );
}

function SettingsPage() {
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const save = useServerFn(saveSettings);
  const { t, setLang, setTheme } = useLocale();
  const [unlockCode, setUnlockCode] = useState("");
  const orgUnlocked = unlockCode.trim().length > 0;
  const [coords, setCoords] = useState<{ lat: string; lng: string } | null>(null);
  const [locating, setLocating] = useState(false);

  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      toast.error(t("This device cannot share GPS location."));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        });
        setLocating(false);
        toast.success(t("Location captured"));
      },
      () => {
        setLocating(false);
        toast.error(t("Allow GPS location to capture the office position."));
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

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
          max_daily_sessions: Number(form.get("max_daily_sessions")),
          language: String(form.get("language")) as Lang,
          theme: String(form.get("theme")) as Theme,
          office_address: String(form.get("office_address") ?? ""),
          office_lat: form.get("office_lat") ? Number(form.get("office_lat")) : null,
          office_lng: form.get("office_lng") ? Number(form.get("office_lng")) : null,
          geofence_radius_m: Number(form.get("geofence_radius_m") || 150),
          require_geofence: form.get("require_geofence") === "on",
          org_unlock_code: String(form.get("org_unlock_code") ?? ""),
        },
      }),
    onSuccess: (_res, form) => {
      setLang(String(form.get("language")) as Lang);
      setTheme(String(form.get("theme")) as Theme);
      toast.success(t("Settings saved"));
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["org-locale"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!settings) return <p className="text-sm text-muted-foreground">{t("Loading settings…")}</p>;

  return (
    <form
      className="panel space-y-6 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate(new FormData(e.currentTarget));
      }}
    >
      <div>
        <h1 className="font-display text-base font-semibold">{t("Attendance rules")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "These values drive clamping, lateness, break deduction and overtime for every scan.",
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="org_unlock_code">{t("Unlock code (to edit organisation)")}</Label>
          <Input
            id="org_unlock_code"
            name="org_unlock_code"
            type="password"
            autoComplete="off"
            placeholder={t("Enter code to unlock")}
            value={unlockCode}
            onChange={(e) => setUnlockCode(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org_name">{t("Organisation")}</Label>
          <Input
            id="org_name"
            name="org_name"
            defaultValue={settings.org_name}
            readOnly={!orgUnlocked}
            required
            aria-describedby="org_name_hint"
          />
          {!orgUnlocked && (
            <p id="org_name_hint" className="text-xs text-muted-foreground">
              {t("Locked — enter the unlock code to change it.")}
            </p>
          )}
        </div>
        <Field name="timezone" label={t("Timezone")} defaultValue={settings.timezone} />
        <Field name="shift_start" label={t("Shift start")} type="time" defaultValue={settings.shift_start} />
        <Field name="shift_end" label={t("Shift end")} type="time" defaultValue={settings.shift_end} />
        <Field name="qr_open" label={t("Scan window opens")} type="time" defaultValue={settings.qr_open} />
        <Field name="daily_cutoff" label={t("Scan window closes")} type="time" defaultValue={settings.daily_cutoff} />
        <Field
          name="grace_minutes"
          label={t("Grace period (min)")}
          type="number"
          defaultValue={String(settings.grace_minutes)}
        />
        <Field
          name="break_threshold_minutes"
          label={t("Break threshold (min worked)")}
          type="number"
          defaultValue={String(settings.break_threshold_minutes)}
        />
        <Field
          name="break_deduction_minutes"
          label={t("Break deduction (min)")}
          type="number"
          defaultValue={String(settings.break_deduction_minutes)}
        />
        <Field
          name="min_dwell_seconds"
          label={t("Min seconds between scans")}
          type="number"
          defaultValue={String(settings.min_dwell_seconds)}
        />
        <div className="space-y-2">
          <Label htmlFor="max_daily_sessions">{t("Check-ins per day")}</Label>
          <select
            id="max_daily_sessions"
            name="max_daily_sessions"
            defaultValue={String(settings.max_daily_sessions ?? 1)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {t("How many check-in/check-out pairs each employee may record per day.")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="language">{t("Application language")}</Label>
          <select
            id="language"
            name="language"
            defaultValue={settings.language ?? "de"}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="theme">{t("Appearance")}</Label>
          <select
            id="theme"
            name="theme"
            defaultValue={settings.theme ?? "dark"}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="dark">{t("Dark")}</option>
            <option value="light">{t("Light")}</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border p-4">
        <Switch
          id="count_unapproved_overtime"
          name="count_unapproved_overtime"
          defaultChecked={settings.count_unapproved_overtime}
        />
        <Label htmlFor="count_unapproved_overtime" className="font-normal">
          {t("Count unapproved overtime in payroll totals")}
        </Label>
      </div>

      <div className="space-y-4 rounded-xl border border-border p-4">
        <div>
          <h2 className="font-display text-sm font-semibold">{t("Office location (GPS)")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "When enabled, employees can only scan the code while they are physically within the allowed radius of the office.",
            )}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="office_address">{t("Office address")}</Label>
            <Input
              id="office_address"
              name="office_address"
              defaultValue={settings.office_address ?? ""}
              placeholder={t("Street, city, country")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="office_lat">{t("Latitude")}</Label>
            <Input
              id="office_lat"
              name="office_lat"
              inputMode="decimal"
              key={`lat-${coords?.lat ?? "d"}`}
              defaultValue={coords?.lat ?? (settings.office_lat != null ? String(settings.office_lat) : "")}
              placeholder="52.520008"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="office_lng">{t("Longitude")}</Label>
            <Input
              id="office_lng"
              name="office_lng"
              inputMode="decimal"
              key={`lng-${coords?.lng ?? "d"}`}
              defaultValue={coords?.lng ?? (settings.office_lng != null ? String(settings.office_lng) : "")}
              placeholder="13.404954"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="geofence_radius_m">{t("Allowed radius (m)")}</Label>
            <Input
              id="geofence_radius_m"
              name="geofence_radius_m"
              type="number"
              min={20}
              max={5000}
              defaultValue={String(settings.geofence_radius_m ?? 150)}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={useCurrentLocation} disabled={locating}>
              {locating ? t("Locating…") : t("Use my current location")}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="require_geofence"
            name="require_geofence"
            defaultChecked={settings.require_geofence ?? false}
          />
          <Label htmlFor="require_geofence" className="font-normal">
            {t("Only allow check-in/check-out at the office location")}
          </Label>
        </div>
      </div>

      <Button type="submit" disabled={mut.isPending}>
        {mut.isPending ? t("Saving…") : t("Save settings")}
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
