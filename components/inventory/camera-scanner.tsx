"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Modal } from "@/components/ui/dialog";

/**
 * A camera barcode/QR scanner in an accessible modal (Esc / backdrop close /
 * focus trap via Radix). Works on desktop webcams and phone cameras. Uses ZXing,
 * dynamically imported so it never touches SSR or the initial bundle. Calls
 * `onDetect` once with the decoded text; the parent then closes it. The camera
 * body only mounts while the modal is open, so the device is released on close.
 */
export function CameraScanner({
  open,
  onOpenChange,
  onDetect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetect: (code: string) => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <Camera size={15} /> Scan a barcode
        </span>
      }
      description="Point your camera at a barcode or QR code to fill it in."
    >
      {open && <ScannerBody onDetect={onDetect} />}
    </Modal>
  );
}

function ScannerBody({ onDetect }: { onDetect: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    let firstDetect = true;

    async function start() {
      // getUserMedia only exists in a secure context (https or localhost).
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError(
          "The camera needs a secure connection (https, or localhost). Open the app over https or on localhost to scan.",
        );
        return;
      }
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;
        const reader = new BrowserMultiFormatReader();
        const el = videoRef.current;
        if (!el) return;
        // `ideal` (not a hard requirement) so a laptop's front webcam works too;
        // phones still prefer the rear camera.
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          el,
          (result) => {
            if (result && firstDetect && !cancelled) {
              firstDetect = false;
              onDetect(result.getText());
            }
          },
        );
        stop = () => controls.stop();
        if (cancelled) stop();
      } catch (err) {
        if (cancelled) return;
        const e = err instanceof Error ? err : null;
        const name = e?.name ?? "";
        if (/notallowed|permission|denied/i.test(name + (e?.message ?? ""))) {
          setError("Camera access was blocked. Allow camera permission in your browser and try again.");
        } else if (/notfound|devicesnotfound|overconstrained/i.test(name)) {
          setError("No camera was found on this device.");
        } else {
          setError(`Couldn't start the camera${name ? ` (${name})` : ""}. Close and try again.`);
        }
      }
    }

    // Defer acquisition a tick so React StrictMode's throwaway first mount is
    // cancelled before it ever grabs the webcam (otherwise the dev double-mount
    // turns the camera on then immediately off).
    const timer = setTimeout(start, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stop?.();
    };
  }, [onDetect]);

  return (
    <div>
      <div className="relative aspect-video bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {!error && (
          <div className="pointer-events-none absolute inset-x-10 top-1/2 h-0.5 -translate-y-1/2 bg-accent/80 shadow-[0_0_8px_var(--color-accent)]" />
        )}
      </div>
      <p className={`p-3 text-xs ${error ? "text-danger" : "text-muted"}`}>
        {error ?? "Point your camera at a barcode or QR code — it fills in automatically."}
      </p>
    </div>
  );
}
