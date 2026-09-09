"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Streamdown } from "streamdown";
import type { Components } from "streamdown";

/** A link is internal if it stays on this site (relative, root-, or hash-linked). */
function isInternal(href: string) {
  return (
    href.startsWith("/") ||
    href.startsWith("#") ||
    (!/^[a-z]+:/i.test(href) && !href.startsWith("//"))
  );
}

/**
 * Render doc links ourselves instead of using Streamdown's link-safety modal
 * (meant for untrusted AI output; it pops on every link). Our docs are
 * first-party: internal links navigate in place; only links that actually leave
 * the site open in a new tab, marked with an icon.
 *
 * This lives in a Client Component because the `components` map holds functions,
 * which can't be passed from a Server Component into Streamdown (a Client
 * Component) across the RSC boundary.
 */
const docComponents: Components = {
  a({ href, children }) {
    const to = href ?? "";
    if (isInternal(to)) {
      return (
        <Link href={to} className="text-info hover:underline">
          {children}
        </Link>
      );
    }
    return (
      <a
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 text-info hover:underline"
      >
        {children}
        <ArrowUpRight size={12} className="opacity-70" />
      </a>
    );
  },
};

/** Render one markdown chunk of a doc article (prose, tables). */
export function DocMarkdown({ md }: { md: string }) {
  return (
    <Streamdown components={docComponents} linkSafety={{ enabled: false }}>
      {md}
    </Streamdown>
  );
}
