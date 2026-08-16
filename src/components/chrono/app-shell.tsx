import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { LocaleControls } from "@/components/chrono/locale-controls";
import { usePermissions, useProfile, useSettings, useUser } from "@/hooks/use-chrono";
import { useT } from "@/lib/i18n";
import { ROLE_LABELS } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const t = useT();
  const { user } = useUser();
  const perms = usePermissions();
  const { data: profile } = useProfile(perms.userId);
  const { data: settings } = useSettings();
  const canOpenAdmin = perms.can("admin.access");
  const pathname = useLocation({ select: (l) => l.pathname });
  const orgName = settings?.org_name ?? "ChronoDesk";

  useEffect(() => {
    const id = window.setTimeout(() => {
      document.title = document.title.replace(/ChronoDesk/g, orgName);
    }, 0);
    return () => window.clearTimeout(id);
  }, [orgName, pathname]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/home" className="font-display text-base font-semibold">
            {orgName}
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Button asChild variant="ghost" size="sm">
              <Link to="/home">{t("My day")}</Link>
            </Button>
            {canOpenAdmin && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin">{t("Admin")}</Link>
              </Button>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {profile ? `${profile.first_name} ${profile.last_name}` : (user?.email ?? "")}
              {perms.role ? ` · ${ROLE_LABELS[perms.role]}` : ""}
            </span>
            <LocaleControls compact />
            <Button variant="outline" size="sm" onClick={signOut} aria-label={t("Sign out")}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}