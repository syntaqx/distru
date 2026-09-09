"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * The single tab bar for the whole Sales area, on every sales page. Orders and
 * Invoices are two views of `/sales` (switched via `?view=`); Returns/Credits/
 * Payments are their own routes. One consistent control everywhere.
 */
const TABS = [
  { label: "Orders", href: "/sales" },
  { label: "Invoices", href: "/sales?view=invoices" },
  { label: "Returns", href: "/sales/returns" },
  { label: "Credits", href: "/sales/credits" },
  { label: "Payments", href: "/sales/payments" },
] as const;

export function SalesSubnav() {
  const pathname = usePathname();
  const view = useSearchParams().get("view");

  function isActive(href: string): boolean {
    if (href === "/sales")
      return (pathname === "/sales" && view !== "invoices") || pathname.startsWith("/sales/orders");
    if (href === "/sales?view=invoices")
      return (pathname === "/sales" && view === "invoices") || pathname.startsWith("/sales/invoices");
    const base = href.split("?")[0];
    return pathname === base || pathname.startsWith(`${base}/`);
  }

  return (
    <div className="mb-6">
      <div
        className="inline-flex rounded-lg border p-0.5"
        style={{ background: "var(--color-surface)" }}
      >
        {TABS.map((t) => {
          const active = isActive(t.href);
          return (
            <Link
              key={t.label}
              href={t.href}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                active ? "text-fg" : "text-muted hover:text-fg"
              }`}
              style={active ? { background: "var(--color-surface2)" } : undefined}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
