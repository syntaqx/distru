import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  Car,
  ClipboardList,
  CreditCard,
  Database,
  Factory,
  FileText,
  KeyRound,
  LayoutDashboard,
  type LucideIcon,
  Package,
  RotateCcw,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sprout,
  Tag,
  Truck,
  Users,
  Webhook,
  Workflow,
  Zap,
} from "lucide-react";

export type NavItem = { label: string; Icon: LucideIcon; href?: string };
export type NavGroup = { label: string; items: NavItem[] };

/**
 * The primary nav, grouped by workflow. Single source of truth shared by the
 * sidebar (rendering + active highlight) and the topbar breadcrumb.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", Icon: LayoutDashboard, href: "/dashboard" },
      { label: "Notifications", Icon: Bell, href: "/notifications" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Inventory", Icon: Boxes, href: "/inventory" },
      { label: "Packages", Icon: Package, href: "/inventory/packages" },
      { label: "Categories", Icon: Tag, href: "/categories" },
    ],
  },
  {
    label: "Sales & CRM",
    items: [
      { label: "Sales", Icon: ShoppingCart, href: "/sales" },
      { label: "Returns", Icon: RotateCcw, href: "/sales/returns" },
      { label: "Companies", Icon: Building2, href: "/companies" },
    ],
  },
  {
    label: "Supply & Production",
    items: [
      { label: "Purchasing", Icon: Truck, href: "/purchasing" },
      { label: "Manufacturing", Icon: Factory, href: "/manufacturing" },
      { label: "Fleet", Icon: Car, href: "/fleet" },
    ],
  },
  {
    label: "Grow & Comply",
    items: [
      { label: "Cultivation", Icon: Sprout, href: "/cultivation" },
      { label: "Compliance", Icon: ShieldCheck, href: "/compliance" },
    ],
  },
  {
    label: "Automate & Analyze",
    items: [
      { label: "Insights", Icon: BarChart3, href: "/insights" },
      { label: "Reports", Icon: ScrollText, href: "/reports" },
      { label: "Automations", Icon: Workflow, href: "/automations" },
    ],
  },
];

export const SETTINGS_ITEMS: NavItem[] = [
  { label: "General", Icon: Settings, href: "/settings" },
  { label: "Members", Icon: Users, href: "/settings/members" },
  { label: "Reference data", Icon: Database, href: "/settings/reference" },
  { label: "API tokens", Icon: KeyRound, href: "/settings/api-tokens" },
  { label: "Webhooks", Icon: Webhook, href: "/settings/webhooks" },
  { label: "Integrations", Icon: Zap, href: "/settings/integrations" },
  { label: "Audit log", Icon: ClipboardList, href: "/settings/audit-log" },
  { label: "Billing", Icon: CreditCard },
  { label: "Notification prefs", Icon: FileText },
];

/** Does `href` cover `pathname` (exact, or a parent segment - never a partial word)? */
function covers(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * The single most-specific nav href that owns this path - the longest `href` that
 * covers `pathname`. This is what makes exactly one nav item highlight: on
 * `/sales/returns` both `/sales` and `/sales/returns` cover it, and the longer
 * (`/sales/returns`) wins, so "Sales" no longer lights up alongside "Returns".
 */
export function activeHref(pathname: string, items: NavItem[]): string | null {
  let best: string | null = null;
  for (const it of items) {
    if (it.href && covers(pathname, it.href) && it.href.length > (best?.length ?? -1)) {
      best = it.href;
    }
  }
  return best;
}

const ALL_MAIN = NAV_GROUPS.flatMap((g) => g.items);

function titleCase(seg: string) {
  return seg
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export type Crumb = { label: string; href?: string };

/**
 * The breadcrumb trail for a path: `Group › Item › [Action]`, derived from the
 * same nav config. Detail/create/edit sub-routes append a final crumb (New /
 * Edit / Details) so the bar reflects exactly where you are.
 */
export function breadcrumbTrail(pathname: string): Crumb[] {
  const candidates: { group: string; item: NavItem }[] = [
    ...NAV_GROUPS.flatMap((g) => g.items.map((item) => ({ group: g.label, item }))),
    ...SETTINGS_ITEMS.map((item) => ({ group: "Settings", item })),
    { group: "Docs", item: { label: "Docs", Icon: FileText, href: "/docs" } },
  ];

  let best: { group: string; item: NavItem } | null = null;
  for (const c of candidates) {
    const h = c.item.href;
    if (h && covers(pathname, h) && h.length > (best?.item.href?.length ?? -1)) best = c;
  }
  if (!best?.item.href) return [{ label: "Overview" }];

  // Drop the group crumb when it just repeats the item (e.g. Docs › Docs).
  const crumbs: Crumb[] =
    best.group === best.item.label
      ? [{ label: best.item.label, href: best.item.href }]
      : [{ label: best.group }, { label: best.item.label, href: best.item.href }];

  const rest = pathname.slice(best.item.href.length).split("/").filter(Boolean);
  if (rest.length) {
    const last = rest[rest.length - 1];
    const action =
      last === "new" ? "New" : last === "edit" ? "Edit" : /^[0-9a-f-]{16,}$/i.test(last) ? "Details" : titleCase(last);
    crumbs.push({ label: action });
  }
  return crumbs;
}

export { ALL_MAIN };
