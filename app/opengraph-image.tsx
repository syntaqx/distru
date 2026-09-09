import { ImageResponse } from "next/og";

export const alt = "Distru - a seed-to-sale cannabis ERP with an AI Copilot";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The shared-link preview image, generated with next/og. On-brand: the leaf mark
 * and wordmark over the accent-green gradient, with a tagline. Kept honest - it's
 * a faithful recreation, noted at the foot.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0e7c66 0%, #0b6553 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* soft glow */}
        <div
          style={{
            position: "absolute",
            top: -160,
            right: -120,
            width: 520,
            height: 520,
            borderRadius: 9999,
            background: "rgba(255,255,255,0.10)",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 108,
              height: 108,
              borderRadius: 28,
              background: "#ffffff",
            }}
          >
            <svg
              width="62"
              height="62"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0e7c66"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
            </svg>
          </div>
          <div style={{ fontSize: 112, fontWeight: 700, letterSpacing: "-3px" }}>Distru</div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 36,
            maxWidth: 860,
            textAlign: "center",
            fontSize: 38,
            lineHeight: 1.25,
            color: "rgba(255,255,255,0.92)",
          }}
        >
          The cannabis seed-to-sale ERP, reimagined with an AI Copilot.
        </div>

        <div style={{ display: "flex", marginTop: 44, fontSize: 24, color: "rgba(255,255,255,0.70)" }}>
          A faithful recreation, with a few tricks of its own
        </div>
      </div>
    ),
    { ...size },
  );
}
