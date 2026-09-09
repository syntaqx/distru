"use client";

/**
 * Root error boundary. It renders its own <html>/<body> because it replaces the
 * root layout, and it deliberately uses no context or providers so it renders in
 * any state (this also avoids the default global-error page's prerender crash).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0b0b0c",
          color: "#e5e5e5",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, opacity: 0.7, margin: "0 0 16px" }}>
            An unexpected error occurred. You can try again, or reload the page.
          </p>
          {error?.digest && (
            <p style={{ fontSize: 12, opacity: 0.4, margin: "0 0 16px", fontFamily: "monospace" }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              fontSize: 14,
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #333",
              background: "#1a1a1c",
              color: "#e5e5e5",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
