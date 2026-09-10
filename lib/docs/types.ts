/** One documentation article, sourced from a markdown file under docs/. */
export type DocArticle = {
  slug: string;
  section: string;
  title: string;
  summary: string;
  keywords: string[];
  body: string;
};

/** The lightweight, client-safe nav shape (no bodies). */
export type DocNav = { slug: string; section: string; title: string; summary: string };
