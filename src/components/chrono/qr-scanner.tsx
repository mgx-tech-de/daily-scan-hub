import jsQR from "jsqr";
import { Camera, CameraOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  onResult: (payload: string) => void;
  busy?: boolean;
};

export function QrScanner({ onResult, busy }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lockRef = useRef(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => stop, [stop]);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const w = 480;
    const h = Math.round((video.videoHeight / video.videoWidth) * w) || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const image = ctx.getImageData(0, 0, w, h);
    const code = jsQR(image.data, w, h, { inversionAttempts: "dontInvert" });
    if (code?.data && !lockRef.current) {
      lockRef.current = true;
      onResult(code.data);
      window.setTimeout(() => (lockRef.current = false), 3000);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onResult]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError("Camera access was blocked. Allow the camera or type the code below.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-secondary">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`size-full object-cover ${active ? "" : "opacity-0"}`}
        />
        <canvas ref={canvasRef} className="hidden" />
        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <CameraOff className="size-8 text-muted-foreground" aria-hidden />
            <p className="max-w-[16rem] text-sm text-muted-foreground">
              Point your camera at the workplace QR code on the wall display.
            </p>
            <Button type="button" onClick={start} disabled={busy}>
              <Camera className="mr-2 size-4" /> Start camera
            </Button>
          </div>
        )}
        {active && (
          <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-primary/80" />
        )}
      </div>

      {active && (
        <Button type="button" variant="outline" className="w-full" onClick={stop}>
          Stop camera
        </Button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) onResult(manual.trim());
        }}
      >
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Or paste the code text"
          aria-label="Attendance code"
        />
        <Button type="submit" variant="secondary" disabled={busy || !manual.trim()}>
          Submit
        </Button>
      </form>
    </div>
  );
}