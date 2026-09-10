"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Products", href: "/inventory" },
  { label: "Packages", href: "/inventory/packages" },
  { label: "Batches", href: "/inventory/batches" },
  { label: "Bins", href: "/inventory/bins" },
  { label: "Transfers", href: "/inventory/transfers" },
  { label: "Valuation", href: "/inventory/valuation" },
] as const;

/**
 * Segmented tab bar shared across the Inventory area. Products is only active on
 * the exact `/inventory` path; the depth screens match their own prefix so their
 * new/edit routes keep the tab highlighted.
 */
export function InventorySubnav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/inventory") return pathname === "/inventory";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="mb-6 flex overflow-x-auto">
      <div
        className="flex w-max rounded-lg border p-0.5"
        style={{ background: "var(--color-surface)" }}
      >
        {TABS.map((t) => {
          const active = isActive(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
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
