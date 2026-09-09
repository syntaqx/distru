"use client";

/**
 * An inline `<script>` that runs during HTML parsing (before first paint) but
 * does NOT trip React 19's "scripts inside React components are never executed
 * when rendering on the client" warning.
 *
 * The trick (from Next's "preventing flash before hydration" guide): render an
 * executable `text/javascript` on the server so the browser runs it while
 * parsing, but `text/plain` on the client so React's client render never
 * produces an executable script. `suppressHydrationWarning` accepts the type
 * mismatch during hydration.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
