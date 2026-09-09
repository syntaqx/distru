"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, BookOpen, Settings } from "lucide-react";
import { listDocs } from "@/lib/docs/content";
import { UserMenu } from "@/components/user-menu";
import {
  ALL_MAIN,
  NAV_GROUPS,
  SETTINGS_ITEMS,
  activeHref,
  type NavItem,
} from "@/components/nav-config";

type Item = NavItem;
const MAIN = NAV_GROUPS;
const SETTINGS = SETTINGS_ITEMS;

function Row({ item, active }: { item: Item; active?: boolean }) {
  const { Icon } = item;
  const disabled = !item.href;
  // Colors live in classes (not inline) for the inactive state so the hover
  // variants actually win - inline styles would override :hover.
  const cls = active
    ? "text-fg"
    : disabled
      ? "text-muted opacity-55"
      : "text-muted hover:bg-surface2 hover:text-fg";
  const inner = (
    <div
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${cls}`}
      style={active ? { background: "var(--color-surface2)" } : undefined}
    >
      <Icon
        size={16}
        style={{ color: active ? "var(--color-accent)" : undefined }}
      />
      <span>{item.label}</span>
      {disabled && (
        <span className="ml-auto rounded bg-surface2 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted">
          Soon
        </span>
      )}
    </div>
  );
  if (!item.href)
    return (
      <div title="Coming soon" aria-disabled className="cursor-not-allowed">
        {inner}
      </div>
    );
  return <Link href={item.href}>{inner}</Link>;
}

function BackHeader({ label }: { label: string }) {
  return (
    <Link
      href="/dashboard"
      className="mb-1 flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-fg"
    >
      <ArrowLeft size={15} /> {label}
    </Link>
  );
}

export function Sidebar({
  userName,
  userEmail,
}: {
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const context = pathname.startsWith("/settings")
    ? "settings"
    : pathname.startsWith("/docs")
      ? "docs"
      : "main";
  // Exactly one main item is active: the most-specific href that owns the path,
  // so /sales/returns highlights "Returns" only (not "Sales" too).
  const mainActive = activeHref(pathname, ALL_MAIN);

  return (
    <aside
      className="flex w-64 shrink-0 flex-col border-r"
      style={{ background: "var(--color-surface)" }}
    >
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <div key={context} className="nav-swap space-y-4">
          {context === "settings" && (
            <div className="space-y-0.5">
              <BackHeader label="Settings" />
              {SETTINGS.map((item) => (
                <Row
                  key={item.label}
                  item={item}
                  active={item.href ? pathname === item.href : false}
                />
              ))}
            </div>
          )}

          {context === "docs" &&
            (() => {
              const docLink = (d: { slug: string; title: string }) => {
                const href =
                  d.slug === "overview" ? "/docs" : `/docs/${d.slug}`;
                const active = pathname === href;
                return (
                  <Link
                    key={d.slug}
                    href={href}
                    className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? "text-fg"
                        : "text-muted hover:bg-surface2 hover:text-fg"
                    }`}
                    style={
                      active
                        ? { background: "var(--color-surface2)" }
                        : undefined
                    }
                  >
                    {d.title}
                  </Link>
                );
              };
              const all = listDocs();
              // Product docs render as one flat list; everything else (the
              // engineering/architecture tier) groups by section so the
              // two-piece showcase - Platform vs Copilot - reads in the nav.
              const PRODUCT_SECTIONS = [
                "Getting started",
                "Catalog",
                "Selling",
                "Importing data",
                "Copilot",
                "Developers",
              ];
              const product = all.filter((d) =>
                PRODUCT_SECTIONS.includes(d.section),
              );
              const engineering = all.filter(
                (d) => !PRODUCT_SECTIONS.includes(d.section),
              );
              const engSections: string[] = [];
              for (const d of engineering)
                if (!engSections.includes(d.section))
                  engSections.push(d.section);
              return (
                <div className="space-y-5">
                  <div className="space-y-0.5">
                    <BackHeader label="Docs" />
                    {product.map(docLink)}
                  </div>
                  {engSections.map((section) => (
                    <div key={section} className="space-y-0.5">
                      <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                        {section}
                      </div>
                      {engineering
                        .filter((d) => d.section === section)
                        .map(docLink)}
                    </div>
                  ))}
                </div>
              );
            })()}

          {context === "main" && (
            <>
              {MAIN.map((group) => (
                <div key={group.label} className="space-y-0.5">
                  <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                    {group.label}
                  </div>
                  {group.items.map((item) => (
                    <Row
                      key={item.label}
                      item={item}
                      active={!!item.href && item.href === mainActive}
                    />
                  ))}
                </div>
              ))}
              <div className="space-y-0.5 border-t pt-3">
                <Row
                  item={{ label: "Docs", Icon: BookOpen, href: "/docs" }}
                  active={false}
                />
                <Row
                  item={{
                    label: "Settings",
                    Icon: Settings,
                    href: "/settings",
                  }}
                  active={false}
                />
              </div>
            </>
          )}
        </div>
      </nav>

      <div className="border-t p-2">
        <UserMenu userName={userName} userEmail={userEmail} />
      </div>
    </aside>
  );
}
