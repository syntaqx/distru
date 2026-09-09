import { z } from "zod";
import { defineTool } from "../tool";
import { getDoc, listDocs, searchDocs } from "@/lib/docs/content";

export const searchDocsTool = defineTool({
  name: "search_docs",
  description:
    "Search Distru's product documentation for how-to and 'how does X work' questions " +
    "(creating products/categories, importing, inventory, the API, etc.). Returns the " +
    "most relevant articles; follow up with read_doc for full content.",
  gate: "none",
  inputSchema: z.object({ query: z.string() }),
  async execute(input) {
    const results = searchDocs(input.query, 5);
    return {
      ok: true,
      summary: results.length
        ? `Found ${results.length} doc(s): ${results.map((r) => r.slug).join(", ")}.`
        : "No matching docs.",
      data: { results },
    };
  },
});

export const readDocTool = defineTool({
  name: "read_doc",
  description: "Read one documentation article in full by its slug (from search_docs).",
  gate: "none",
  inputSchema: z.object({ slug: z.string() }),
  async execute(input) {
    const doc = getDoc(input.slug);
    if (!doc) return { ok: false, summary: `No doc "${input.slug}".` };
    return {
      ok: true,
      summary: `${doc.title} (${doc.section}).`,
      data: { slug: doc.slug, title: doc.title, section: doc.section, body: doc.body },
    };
  },
});

export const listDocsTool = defineTool({
  name: "list_docs",
  description: "List all documentation articles (slug, section, title, summary).",
  gate: "none",
  inputSchema: z.object({}),
  async execute() {
    const docs = listDocs();
    return { ok: true, summary: `${docs.length} articles.`, data: { docs } };
  },
});

export const docsTools = [searchDocsTool, readDocTool, listDocsTool];
