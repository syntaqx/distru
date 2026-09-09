import { highlightToHtml } from "@/lib/docs/highlight";
import { MermaidDiagram } from "./mermaid";
import { DocMarkdown } from "./doc-markdown";

type Part =
  | { type: "md"; md: string }
  | { type: "code"; html: string }
  | { type: "mermaid"; code: string };

/**
 * Split the markdown body on fenced code blocks so we can highlight code
 * server-side with shiki (reliable, in the initial HTML) while leaving prose,
 * tables, and mermaid diagrams to the client renderer. Mermaid fences stay in
 * the markdown stream so they render as diagrams.
 */
async function buildParts(body: string): Promise<Part[]> {
  const parts: Part[] = [];
  const re = /```(\w+)?\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const lang = m[1] ?? "";
    const code = m[2] ?? "";
    if (m.index > last) parts.push({ type: "md", md: body.slice(last, m.index) });
    if (lang === "mermaid") {
      parts.push({ type: "mermaid", code: code.replace(/\n$/, "") });
    } else {
      parts.push({ type: "code", html: await highlightToHtml(code.replace(/\n$/, ""), lang) });
    }
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push({ type: "md", md: body.slice(last) });
  return parts;
}

export async function Article({ section, body }: { section: string; body: string }) {
  const parts = await buildParts(body);
  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{section}</div>
      <div className="copilot-md space-y-4 text-sm leading-relaxed">
        {parts.map((p, i) =>
          p.type === "code" ? (
            <div key={i} className="doc-shiki" dangerouslySetInnerHTML={{ __html: p.html }} />
          ) : p.type === "mermaid" ? (
            <MermaidDiagram key={i} chart={p.code} />
          ) : (
            <DocMarkdown key={i} md={p.md} />
          ),
        )}
      </div>
    </div>
  );
}
