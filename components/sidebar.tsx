"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, BookOpen, Braces, Settings } from "lucide-react";
import type { DocNav } from "@/lib/docs/types";
import { UserMenu } from "@/components/user-menu";
import { OrgSwitcher } from "@/components/org-switcher";
import { DemoResetNotice } from "@/components/demo-reset-notice";
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

// Section "eyebrow" label - small, bold, wide-tracked uppercase so it reads
// clearly as a header rather than another (sentence-case, larger) nav link.
const SECTION_LABEL =
  "px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted";

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
  orgName,
  userName,
  userEmail,
  docsNav,
  mobileOpen = false,
  onMobileClose = () => {},
}: {
  orgName: string;
  userName: string;
  userEmail: string;
  docsNav: DocNav[];
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  // Close the mobile drawer once a navigation commits.
  useEffect(() => {
    onMobileClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  const context = pathname.startsWith("/settings")
    ? "settings"
    : pathname.startsWith("/docs") || pathname.startsWith("/api-reference")
      ? "docs"
      : "main";
  // Exactly one main item is active: the most-specific href that owns the path,
  // so /sales/returns highlights "Returns" only (not "Sales" too).
  const mainActive = activeHref(pathname, ALL_MAIN);

  return (
    <>
      {/* Mobile-only backdrop behind the drawer. */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 md:hidden ${mobileOpen ? "" : "hidden"}`}
        onClick={onMobileClose}
        aria-hidden
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r shadow-xl transition-transform md:static md:z-auto md:translate-x-0 md:shadow-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "var(--color-surface)" }}
      >
        <div className="flex h-14 shrink-0 items-center border-b px-2">
          <OrgSwitcher initialName={orgName} />
        </div>
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
              const all = docsNav;
              // Two tiers, clearly divided: the PRODUCT docs (what you'd write
              // for a real product) render as one flat list on top, and the
              // ENGINEERING / take-home write-ups (how it's built + the "above
              // and beyond the ask" story) sit in a labelled block at the bottom.
              const ENGINEERING_SECTIONS = ["Platform architecture", "Copilot & take-home"];
              const isEng = (s: string) => ENGINEERING_SECTIONS.includes(s);
              const product = all.filter((d) => !isEng(d.section));
              const engineering = all.filter((d) => isEng(d.section));
              const engSections = ENGINEERING_SECTIONS.filter((s) =>
                engineering.some((d) => d.section === s),
              );
              return (
                <div className="space-y-5">
                  <div className="space-y-0.5">
                    <BackHeader label="Docs" />
                    {product.map(docLink)}
                    {/* The interactive OpenAPI explorer lives alongside the docs. */}
                    <Link
                      href="/api-reference"
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                        pathname.startsWith("/api-reference")
                          ? "text-fg"
                          : "text-muted hover:bg-surface2 hover:text-fg"
                      }`}
                      style={
                        pathname.startsWith("/api-reference")
                          ? { background: "var(--color-surface2)" }
                          : undefined
                      }
                    >
                      <Braces size={15} className="shrink-0" /> API reference
                    </Link>
                  </div>
                  {engineering.length > 0 && (
                    <div className="space-y-6 border-t pt-5">
                      {engSections.map((section) => (
                        <div key={section} className="space-y-0.5">
                          <div className={SECTION_LABEL}>{section}</div>
                          {engineering
                            .filter((d) => d.section === section)
                            .map(docLink)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

          {context === "main" && (
            <>
              {MAIN.map((group) => (
                <div key={group.label} className="space-y-0.5">
                  {/* "Overview" is a single top-level item (Dashboard); it needs no header. */}
                  {group.label !== "Overview" && (
                    <div className={SECTION_LABEL}>{group.label}</div>
                  )}
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
          <DemoResetNotice variant="pill" />
          <UserMenu userName={userName} userEmail={userEmail} />
        </div>
      </aside>
    </>
  );
}
