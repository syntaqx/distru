/**
 * The docs API. The content itself lives as markdown under the docs/ tree (the
 * single source of truth), compiled into `_generated.ts` by `scripts/build-docs.ts`.
 * This module just re-exports that data and the read/search helpers, so every
 * consumer (the /docs pages, the sidebar nav, the Copilot's docs tools, and the
 * llms.txt / skill.md generators) reads from one place.
 */
import { DOCS } from "./_generated";
import type { DocArticle, DocNav } from "./types";

export type { DocArticle, DocNav };
export { DOCS };

/** Client-safe nav metadata (no bodies) - what the sidebar renders. */
export function listDocs(): DocNav[] {
  return DOCS.map(({ slug, section, title, summary }) => ({ slug, section, title, summary }));
}

export function getDoc(slug: string): DocArticle | null {
  return DOCS.find((d) => d.slug === slug) ?? null;
}

/** Lightweight keyword search over the docs for the Copilot. */
export function searchDocs(query: string, limit = 5) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = DOCS.map((d) => {
    const hay = {
      title: d.title.toLowerCase(),
      keywords: d.keywords.join(" ").toLowerCase(),
      summary: d.summary.toLowerCase(),
      body: d.body.toLowerCase(),
    };
    let score = 0;
    for (const t of terms) {
      if (hay.title.includes(t)) score += 5;
      if (hay.keywords.includes(t)) score += 4;
      if (hay.summary.includes(t)) score += 2;
      if (hay.body.includes(t)) score += 1;
    }
    return { d, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map(({ d, score }) => ({
    slug: d.slug,
    title: d.title,
    section: d.section,
    summary: d.summary,
    score,
  }));
}
