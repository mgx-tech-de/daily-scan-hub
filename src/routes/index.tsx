import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { LogIn, LogOut } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatMinutes, zoned } from "@/lib/attendance-rules";
import { getPublicKiosk, getRecentScans } from "@/lib/chrono.functions";

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
function Index() {
  const [png, setPng] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);

  const kiosk = useQuery({
    queryKey: ["public-kiosk"],
    queryFn: () => getPublicKiosk(),
    refetchInterval: 10000,
  });

  const feed = useQuery({
    queryKey: ["public-scans"],
    queryFn: () => getRecentScans(),
    refetchInterval: 3000,
  });

  const data = kiosk.data;
  const scans = feed.data?.scans ?? [];
  const latest = scans[0] ?? null;
  const tz = feed.data?.timezone ?? data?.timezone ?? "UTC";

  useEffect(() => {
    if (!data?.payload) return;
    QRCode.toDataURL(data.payload, {
      width: 720,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0b0f14", light: "#ffffff" },
    }).then(setPng);
  }, [data?.payload]);

  useEffect(() => {
    const rotateSeconds = data?.rotateSeconds ?? 30;
    const id = window.setInterval(() => {
      const left = rotateSeconds - (Math.floor(Date.now() / 1000) % rotateSeconds);
      setCountdown(left);
      if (left === rotateSeconds) kiosk.refetch();
    }, 1000);
    return () => window.clearInterval(id);
  }, [data?.rotateSeconds, kiosk]);

  return (
    <main className="hero-surface min-h-screen">
      <div className="mx-auto flex max-w-3xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <span className="font-display text-lg font-semibold tracking-tight">
            {data?.orgName ?? "ChronoDesk"}
          </span>
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link to="/auth">Sign in</Link>
          </Button>
        </header>

        <section className="mt-6 flex flex-col items-center text-center">
          <h1 className="font-display text-2xl font-bold md:text-3xl">
            Scan to check in or out
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data ? `${data.workDate} · ${data.windowFrom}–${data.windowTo} · ${data.timezone}` : "Loading today's code…"}
          </p>

          <div className="mt-6 rounded-2xl bg-white p-4">
            {png ? (
              <img
                src={png}
                alt="Daily attendance QR code"
                className="size-[260px] sm:size-[340px]"
              />
            ) : (
              <div className="size-[260px] animate-pulse rounded-lg bg-muted sm:size-[340px]" />
            )}
          </div>
          <p className="tabular mt-3 text-sm text-muted-foreground">
            New code in <span className="font-semibold text-foreground">{countdown}s</span>
          </p>

          <div className="mt-6 w-full" aria-live="polite">
            {latest ? (
              <article className="panel flex items-center gap-4 p-5 text-left">
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-full ${
                    latest.kind === "check_in"
                      ? "bg-success/15 text-success"
                      : "bg-primary/15 text-primary"
                  }`}
                >
                  {latest.kind === "check_in" ? (
                    <LogIn className="size-5" aria-hidden />
                  ) : (
                    <LogOut className="size-5" aria-hidden />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold">{latest.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {latest.kind === "check_in" ? "Checked in" : "Checked out"} at{" "}
                    <span className="tabular">{zoned(new Date(latest.at), tz).hm}</span>
                    {latest.department ? ` · ${latest.department}` : ""}
                  </p>
                </div>
                <span className="tabular ml-auto text-right text-sm">
                  <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                    Net today
                  </span>
                  {formatMinutes(latest.netMinutes)}
                </span>
              </article>
            ) : (
              <p className="text-sm text-muted-foreground">
                No scans yet today — the next employee can scan now.
              </p>
            )}

            {scans.length > 1 && (
              <ul className="mt-3 space-y-1 text-left text-sm text-muted-foreground">
                {scans.slice(1, 5).map((s) => (
                  <li key={s.id} className="flex justify-between gap-3 px-1">
                    <span className="truncate">{s.name}</span>
                    <span className="tabular">
                      {s.kind === "check_in" ? "in" : "out"} · {zoned(new Date(s.at), tz).hm}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
