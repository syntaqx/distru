/**
 * Org role vocabulary + helpers - pure and dependency-free so both server
 * services (lib/modules/platform/team.ts) and client components can import it.
 *
 * A person holds several roles at once; they're additive labels stored as a
 * comma-separated list in `member.role`. "driver" is a pseudo-role derived from
 * having a linked driver profile, so it is never written into `member.role`.
 */

export const ORG_ROLES = [
  { key: "owner", label: "Owner", desc: "Full control of the workspace, billing, and team." },
  { key: "admin", label: "Admin", desc: "Manage settings, team, and every operation." },
  { key: "dispatcher", label: "Dispatcher", desc: "Build routes and assign deliveries." },
  { key: "driver", label: "Driver", desc: "Runs deliveries and signs into the driver app." },
  { key: "sales", label: "Sales", desc: "Manage companies, orders, and invoices." },
  { key: "fulfillment", label: "Fulfillment", desc: "Pick, pack, and run manufacturing." },
  { key: "member", label: "Member", desc: "Baseline access to the workspace." },
] as const;

export type OrgRoleKey = (typeof ORG_ROLES)[number]["key"];

/** Access roles assignable in the Team UI (driver is toggled via its profile). */
export const ASSIGNABLE_ROLES = ORG_ROLES.filter((r) => r.key !== "driver");

const ROLE_ORDER = ORG_ROLES.map((r) => r.key) as string[];

export function parseRoles(role: string | null | undefined): string[] {
  return (role ?? "")
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
}

/** Dedupe, drop the pseudo-role "driver", canonicalise order, default to member. */
export function serializeRoles(roles: string[]): string {
  const uniq = Array.from(
    new Set(roles.map((r) => r.trim().toLowerCase()).filter((r) => r && r !== "driver")),
  );
  uniq.sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
  return uniq.length ? uniq.join(",") : "member";
}

export function orderRoles(roles: string[]): string[] {
  const uniq = Array.from(new Set(roles));
  uniq.sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
  return uniq;
}

export function roleLabel(key: string): string {
  return ORG_ROLES.find((r) => r.key === key)?.label ?? key;
}

/** Chip color per role, so the labels read at a glance across the app. */
export const ROLE_COLOR: Record<string, string> = {
  owner: "var(--color-accent)",
  admin: "var(--color-accent)",
  dispatcher: "#f59e0b",
  driver: "#10b981",
  sales: "#3b82f6",
  fulfillment: "#a855f7",
  member: "var(--color-muted)",
};
