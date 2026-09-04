import Link from "next/link";
import {
  Activity,
  Boxes,
  Building2,
  Factory,
  LineChart,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  Zap,
} from "lucide-react";
import { getOrgContext } from "@/lib/session";
import { listProducts } from "@/lib/services/products";
import { onHandByProduct } from "@/lib/services/inventory";
import { listCompanies } from "@/lib/services/reference";
import { listRecentAudit } from "@/lib/services/audit";
import { OpenCopilotButton } from "@/components/open-copilot-button";

export const dynamic = "force-dynamic";

const ACTIVE = [
  { href: "/inventory", label: "Inventory", desc: "Products, packages & on-hand", Icon: Boxes },
  { href: "/companies", label: "Companies", desc: "Customers, vendors & brands", Icon: Building2 },
  { href: "/integrations", label: "Integrations", desc: "API tokens, MCP & webhooks", Icon: Zap },
];

const PREVIEW = [
  { label: "Sales Orders", desc: "Quotes → orders → fulfillment", Icon: ShoppingCart },
  { label: "Purchasing", desc: "POs & multi-channel intake", Icon: Truck },
  { label: "Manufacturing", desc: "Assemblies, BOMs & COGS", Icon: Factory },
  { label: "Compliance", desc: "Metrc & BioTrack sync", Icon: ShieldCheck },
  { label: "Analytics", desc: "Reporting & insights", Icon: LineChart },
];

function actionLabel(action: string) {
  const map: Record<string, string> = {
    "product.create": "Created product",
    "product.update": "Updated product",
    "inventory.adjust": "Adjusted inventory",
    "category.create": "Created category",
    "company.create": "Created company",
    "api_token.create": "Created API token",
    "api_token.revoke": "Revoked API token",
  };
  return map[action] ?? action;
}

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };

  const [{ items }, onHand, companies, audit] = await Promise.all([
    listProducts(service, { limit: 500 }),
    onHandByProduct(service),
    listCompanies(service),
    listRecentAudit(service, 10),
  ]);
  const units = [...onHand.values()].reduce((a, b) => a + b, 0);
  const customers = companies.filter((c) => c.roles.includes("CUSTOMER")).length;

  const firstName = ctx.user.name?.split(" ")[0] ?? "there";

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Welcome back, {firstName}</h1>
            <p className="text-sm text-muted">Your seed-to-sale operations, now with an agent.</p>
          </div>
          <OpenCopilotButton className="btn btn-primary" title="Open Copilot (⌘/Ctrl+J)">
            <Sparkles size={16} /> Ask the Copilot
          </OpenCopilotButton>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Products" value={items.length} />
          <Stat label="Units on hand" value={units.toLocaleString()} />
          <Stat label="Companies" value={companies.length} />
          <Stat label="Customers" value={customers} />
        </div>

        <h2 className="mb-3 text-sm font-semibold text-muted">Modules</h2>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <OpenCopilotButton
            className="card group text-left transition-colors hover:border-accent"
            title="Open Copilot (⌘/Ctrl+J)"
          >
            <Sparkles size={20} style={{ color: "var(--color-accent)" }} />
            <div className="mt-3 font-medium">Copilot</div>
            <div className="text-xs text-muted">Chat to run your catalog & imports</div>
          </OpenCopilotButton>
          {ACTIVE.map(({ href, label, desc, Icon }) => (
            <Link key={href} href={href} className="card group transition-colors hover:border-accent">
              <Icon size={20} style={{ color: "var(--color-accent)" }} />
              <div className="mt-3 font-medium">{label}</div>
              <div className="text-xs text-muted">{desc}</div>
            </Link>
          ))}
        </div>

        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PREVIEW.map(({ label, desc, Icon }) => (
            <div key={label} className="card opacity-75">
              <div className="flex items-center justify-between">
                <Icon size={18} className="text-muted" />
                <span className="badge text-[10px]">Preview</span>
              </div>
              <div className="mt-3 text-sm font-medium">{label}</div>
              <div className="text-xs text-muted">{desc}</div>
            </div>
          ))}
        </div>
        <p className="mb-8 -mt-4 text-xs text-muted">
          Preview modules aren&apos;t built out - but the same agentic harness, service layer, and
          public API/MCP that power Inventory are designed to power all of them next.
        </p>

        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted">
          <Activity size={15} /> Recent activity
        </h2>
        <div className="card divide-y p-0">
          {audit.length === 0 && (
            <div className="p-4 text-sm text-muted">
              No activity yet. Ask the Copilot to add a product or import a catalog.
            </div>
          )}
          {audit.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="badge text-[10px]">{a.actorType}</span>
              <span className="font-medium">{actionLabel(a.action)}</span>
              <span className="text-muted">
                {(a.after as { name?: string; sku?: string } | null)?.name ??
                  (a.after as { sku?: string } | null)?.sku ??
                  a.entityType}
              </span>
              <span className="ml-auto text-xs text-muted">{timeAgo(a.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
