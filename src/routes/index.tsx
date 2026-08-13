import { Link, createFileRoute } from "@tanstack/react-router";
import { Clock3, QrCode, ScanLine, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ChronoDesk — QR employee attendance & working hours" },
      {
        name: "description",
        content:
          "Check in and out with a daily rotating QR code. ChronoDesk computes net paid hours, flags lateness and gives HR payroll-ready records.",
      },
      { property: "og:title", content: "ChronoDesk — QR employee attendance" },
      {
        property: "og:description",
        content:
          "Daily rotating QR check-in, automatic break deduction and a live attendance board for admins.",
      },
    ],
  }),
  component: Index,
});

const FEATURES = [
  {
    icon: QrCode,
    title: "Daily rotating code",
    body: "One signed QR per work date, refreshed every 30 seconds so a screenshot is useless within a minute.",
  },
  {
    icon: Clock3,
    title: "Net hours, no arithmetic",
    body: "09:00–18:30 shift, early-scan clamp, 30 minute break past 5 hours — computed the same way everywhere.",
  },
  {
    icon: ShieldCheck,
    title: "Append-only audit trail",
    body: "Records are never edited. Corrections are new events with an actor, a timestamp and a mandatory reason.",
  },
];

function Index() {
  return (
    <main className="hero-surface min-h-screen">
      <div className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-16 md:py-24">
        <header className="flex items-center justify-between">
          <span className="font-display text-lg font-semibold tracking-tight">
            Chrono<span className="text-primary">Desk</span>
          </span>
          <Button asChild variant="outline" size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
        </header>

        <section className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            QR attendance platform
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight md:text-6xl">
            Scan in. Scan out. Payroll-ready hours.
          </h1>
          <p className="mt-5 text-base text-muted-foreground md:text-lg">
            Employees scan the workplace code from their own phone. Admins get a live board,
            correctable records and exports — with every minute traceable.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                <ScanLine className="mr-2 size-4" /> Open ChronoDesk
              </Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="panel p-6">
              <f.icon className="size-5 text-primary" aria-hidden />
              <h2 className="mt-4 text-lg font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
