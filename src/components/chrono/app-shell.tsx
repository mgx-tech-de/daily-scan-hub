import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useProfile, useRole, useUser } from "@/hooks/use-chrono";
import { supabase } from "@/integrations/supabase/client";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user } = useUser();
  const { data: profile } = useProfile(user?.id);
  const { data: roles } = useRole(user?.id);
  const isAdmin = roles?.includes("admin");

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/home" className="font-display text-base font-semibold">
            Chrono<span className="text-primary">Desk</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Button asChild variant="ghost" size="sm">
              <Link to="/home">My day</Link>
            </Button>
            {isAdmin && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin">Admin</Link>
              </Button>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {profile ? `${profile.first_name} ${profile.last_name}` : user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={signOut} aria-label="Sign out">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}