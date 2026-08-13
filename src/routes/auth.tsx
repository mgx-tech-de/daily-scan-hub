import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { claimFirstAdmin, getOrgName } from "@/lib/chrono.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — ChronoDesk" },
      {
        name: "description",
        content: "Sign in to ChronoDesk to scan the daily attendance code or open the admin panel.",
      },
      { property: "og:title", content: "Sign in — ChronoDesk" },
      { property: "og:description", content: "Employee and admin access to ChronoDesk attendance." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const claim = useServerFn(claimFirstAdmin);
  const [busy, setBusy] = useState(false);
  const { data: org } = useQuery({ queryKey: ["org-name"], queryFn: () => getOrgName() });
  const orgName = org?.orgName ?? "ChronoDesk";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home" });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/home" });
  }

  async function setupAdmin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error && !/already registered/i.test(error.message)) throw error;
      const signedIn = await supabase.auth.signInWithPassword({ email, password });
      if (signedIn.error) throw signedIn.error;
      await claim({
        data: {
          first_name: String(form.get("first_name") || "Admin"),
          last_name: String(form.get("last_name") || ""),
          setup_code: String(form.get("setup_code") || ""),
        },
      });
      toast.success("Administrator account ready.");
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="hero-surface flex min-h-screen items-center justify-center px-4 py-12">
      <div className="panel w-full max-w-md p-8">
        <h1 className="font-display text-2xl font-semibold">{orgName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Accounts are issued by HR. Use the credentials you were given.
        </p>

        <Tabs defaultValue="signin" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="setup">First-run setup</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={signIn} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="setup">
            <p className="mt-4 text-sm text-muted-foreground">
              Create the very first administrator. This requires the setup password and only works
              while no administrator exists.
            </p>
            <form onSubmit={setupAdmin} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="setup_code">Setup password</Label>
                <Input id="setup_code" name="setup_code" type="password" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First name</Label>
                  <Input id="first_name" name="first_name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Surname</Label>
                  <Input id="last_name" name="last_name" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input id="admin-email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password (min 10 characters)</Label>
                <Input id="admin-password" name="password" type="password" minLength={10} required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Setting up…" : "Create administrator"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}