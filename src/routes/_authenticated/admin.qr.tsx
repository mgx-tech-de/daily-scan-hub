import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { RequirePermission } from "@/components/chrono/require-permission";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-chrono";
import { getKiosk, rotateQr } from "@/lib/chrono.functions";

export const Route = createFileRoute("/_authenticated/admin/qr")({
  head: () => ({
    meta: [
      { title: "Daily check-in QR — ChronoDesk" },
      {
        name: "description",
        content: "Display the rotating daily QR code employees scan to check in and out.",
      },
      { property: "og:title", content: "Daily check-in QR — ChronoDesk" },
      { property: "og:description", content: "Signed, rotating attendance code for the workplace." },
    ],
  }),
  component: QrGuarded,
});

function QrGuarded() {
  return (
    <RequirePermission permission="qr.view">
      <QrPage />
    </RequirePermission>
  );
}

function QrPage() {
  const perms = usePermissions();
  const kiosk = useServerFn(getKiosk);
  const rotate = useServerFn(rotateQr);
  const [png, setPng] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["kiosk"],
    queryFn: () => kiosk({ data: undefined }),
    refetchInterval: 15000,
  });

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
      if (left === rotateSeconds) refetch();
    }, 1000);
    return () => window.clearInterval(id);
  }, [data?.rotateSeconds, refetch]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="panel flex flex-col items-center justify-center p-8">
        <h1 className="font-display text-xl font-semibold">Scan to check in / out</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data ? `${data.workDate} · ${data.timezone}` : "Loading code…"}
        </p>
        <div className="mt-6 rounded-2xl bg-white p-4">
          {png ? (
            <img src={png} alt="Daily attendance QR code" className="size-[320px] sm:size-[420px]" />
          ) : (
            <div className="size-[320px] animate-pulse rounded-lg bg-muted sm:size-[420px]" />
          )}
        </div>
        <p className="tabular mt-5 text-sm text-muted-foreground">
          Refreshes in <span className="font-semibold text-foreground">{countdown}s</span>
        </p>
      </section>

      <aside className="panel space-y-4 p-5">
        <h2 className="font-display text-base font-semibold">Code controls</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Scan window</dt>
            <dd className="tabular">
              {data ? `${data.windowFrom}–${data.windowTo}` : "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Rotation</dt>
            <dd className="tabular">{data?.rotateSeconds ?? 30}s</dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">
          Each code is signed for today only and expires within seconds, so screenshots cannot be
          reused.
        </p>
        {perms.can("qr.rotate") ? (
          <Button
            className="w-full"
            variant="outline"
            disabled={isFetching}
            onClick={async () => {
            try {
              await rotate({ data: undefined });
              await refetch();
              toast.success("Daily secret rotated — old screenshots are dead.");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not rotate");
            }
            }}
          >
            <RefreshCw className="mr-2 size-4" /> Rotate today&apos;s secret
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Only administrators can rotate today&apos;s secret.
          </p>
        )}
      </aside>
    </div>
  );
}
