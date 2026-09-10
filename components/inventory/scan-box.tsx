"use client";

import { useCallback, useState, useTransition } from "react";
import { Camera, ScanLine } from "lucide-react";
import {
  scanCodeAction,
  type ScanHit,
} from "@/app/(app)/inventory/depth-actions";
import { CameraScanner } from "@/components/inventory/camera-scanner";

/**
 * Warehouse scan lookup: type or scan a package tag / barcode / SKU and resolve
 * it to the package or product it identifies, plus its on-hand.
 */
export function ScanBox() {
  const [code, setCode] = useState("");
  const [hit, setHit] = useState<ScanHit | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const runScan = useCallback((value: string) => {
    if (!value.trim()) return;
    setError(null);
    setNotFound(false);
    setHit(null);
    startTransition(async () => {
      const res = await scanCodeAction(value);
      if (!res.ok) {
        setError(res.error ?? "Scan failed.");
        return;
      }
      if (!res.hit) setNotFound(true);
      else setHit(res.hit);
    });
  }, []);

  function scan() {
    runScan(code);
  }

  // Camera detected a code: fill the input, close the camera, and look it up.
  const onDetect = useCallback(
    (value: string) => {
      setCode(value);
      setCameraOpen(false);
      runScan(value);
    },
    [runScan],
  );

  return (
    <div className="card mb-6">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <ScanLine size={16} /> Scan
      </h2>
      <div className="flex gap-2">
        <input
          className="input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") scan();
          }}
          placeholder="Package tag, barcode, or SKU…"
          aria-label="Scan code"
        />
        <button
          className="btn btn-outline shrink-0"
          onClick={() => setCameraOpen(true)}
          title="Scan with camera"
          aria-label="Scan with camera"
        >
          <Camera size={15} />
          <span className="hidden sm:inline">Camera</span>
        </button>
        <button
          className="btn btn-primary shrink-0"
          onClick={scan}
          disabled={pending || !code.trim()}
        >
          {pending ? "Scanning…" : "Scan"}
        </button>
      </div>

      <CameraScanner open={cameraOpen} onOpenChange={setCameraOpen} onDetect={onDetect} />

      {error && <div className="mt-3 text-sm text-danger">{error}</div>}
      {notFound && (
        <div className="mt-3 text-sm text-muted">
          Nothing matched that code.
        </div>
      )}
      {hit && (
        <div className="mt-3 rounded-lg border p-3 text-sm">
          <div className="mb-1 text-xs uppercase tracking-wide text-muted">
            {hit.kind === "package" ? "Package" : "Product"}
          </div>
          <div className="font-medium">{hit.title}</div>
          {hit.subtitle && (
            <div className="font-mono text-xs text-muted">{hit.subtitle}</div>
          )}
          <div className="mt-1 tabular-nums text-muted">
            {hit.kind === "package"
              ? `Quantity ${hit.quantity.toLocaleString()} · ${hit.status}`
              : `On hand ${hit.onHand.toLocaleString()}`}
          </div>
        </div>
      )}
    </div>
  );
}
