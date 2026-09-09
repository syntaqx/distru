import "server-only";
import { codeToHtml } from "shiki";

const LANG_ALIAS: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  sh: "bash",
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Highlight a code block to dual-theme HTML at render time. Shiki emits light
 * colors inline and dark colors as `--shiki-dark` CSS vars; globals.css swaps to
 * the dark vars in the app's dark mode. Rendering server-side means the colors
 * are in the initial HTML - no client highlighter to depend on.
 */
export async function highlightToHtml(code: string, lang: string): Promise<string> {
  const language = LANG_ALIAS[lang] ?? lang ?? "text";
  try {
    return await codeToHtml(code, {
      lang: language,
      themes: { light: "github-light", dark: "github-dark" },
    });
  } catch {
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }
}
