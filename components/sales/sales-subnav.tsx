"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Segmented tab bar across the Sales area, styled like the orders/invoices
 * control in `sales-manager.tsx`. Rendered at the top of each sales page inside
 * the scroll area, above the content.
 */
const TABS = [
  { label: "Orders & invoices", href: "/sales" },
  { label: "Returns", href: "/sales/returns" },
  { label: "Credits", href: "/sales/credits" },
  { label: "Payments", href: "/sales/payments" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/sales") {
    // Orders & invoices owns the base plus the order/invoice detail routes.
    return (
      pathname === "/sales" ||
      pathname.startsWith("/sales/orders") ||
      pathname.startsWith("/sales/invoices")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SalesSubnav() {
  const pathname = usePathname();
  return (
    <div className="mb-6">
      <div
        className="inline-flex rounded-lg border p-0.5"
        style={{ background: "var(--color-surface)" }}
      >
        {TABS.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <Link
              key={t.href}
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
