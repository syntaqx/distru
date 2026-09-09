import Link from "next/link";
import {
  Bot,
  Calculator,
  Cloud,
  FileSpreadsheet,
  MessageSquare,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { getOrgContext } from "@/lib/session";

export const dynamic = "force-dynamic";

type Integration = {
  name: string;
  Icon: LucideIcon;
  category: string;
  status: "available" | "planned";
  blurb: string;
  href?: string;
};

const INTEGRATIONS: Integration[] = [
  {
    name: "Your own agent (MCP)",
    Icon: Bot,
    category: "Developer",
    status: "available",
    blurb:
      "Connect Claude Code, Claude Desktop, Cursor, or any MCP client and read or update your workspace programmatically - the same tools the Copilot uses.",
    href: "/settings/api-tokens",
  },
  {
    name: "Google Drive",
    Icon: Cloud,
    category: "Files",
    status: "planned",
    blurb:
      "Import catalog and price files from Drive and export reports and error CSVs back to it, without leaving Distru.",
  },
  {
    name: "Google Sheets",
    Icon: FileSpreadsheet,
    category: "Files",
    status: "planned",
    blurb:
      "Read from and write to the spreadsheets your team already works in, keeping catalog and on-hand in step.",
  },
  {
    name: "Slack",
    Icon: MessageSquare,
    category: "Notifications",
    status: "planned",
    blurb:
      "Send alerts and updates to your channels, and let your team act on them without opening the app.",
  },
  {
    name: "QuickBooks Online",
    Icon: Calculator,
    category: "Accounting",
    status: "planned",
    blurb: "Keep customers, invoices, and payments in sync with your accounting.",
  },
  {
    name: "Metrc",
    Icon: ShieldCheck,
    category: "Compliance",
    status: "planned",
    blurb: "State track-and-trace for compliant package and transfer reporting.",
  },
];

export default async function IntegrationsPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Integrations</h1>
        <p className="text-sm text-muted">
          Connect Distru to the tools you already use. Integrations work across the whole platform - the pages, the public API, and the Copilot all benefit from them.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2">
          {INTEGRATIONS.map((it) => {
            const card = (
              <div className="card flex h-full flex-col transition-colors data-[live=true]:hover:border-accent" data-live={it.status === "available"}>
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-lg" style={{ background: "var(--color-surface2)" }}>
                    <it.Icon size={18} style={{ color: "var(--color-accent)" }} />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{it.name}</div>
                    <div className="text-xs text-muted">{it.category}</div>
                  </div>
                  <span
                    className="badge ml-auto shrink-0"
                    style={{ color: it.status === "available" ? "var(--color-accent)" : "var(--color-muted)" }}
                  >
                    {it.status === "available" ? "Available" : "Coming soon"}
                  </span>
                </div>
                <p className="mt-2.5 flex-1 text-sm text-muted">{it.blurb}</p>
                <div className="mt-3 pt-1">
                  {it.status === "available" ? (
                    <span className="text-sm font-medium" style={{ color: "var(--color-accent)" }}>
                      Set up →
                    </span>
                  ) : (
                    <span className="text-sm text-muted opacity-60">Not yet available</span>
                  )}
                </div>
              </div>
            );
            return it.href ? (
              <Link key={it.name} href={it.href} className="block">
                {card}
              </Link>
            ) : (
              <div key={it.name}>{card}</div>
            );
          })}
        </div>
        <p className="mx-auto mt-6 max-w-4xl text-xs text-muted">
          Building your own? Mint a token under{" "}
          <Link href="/settings/api-tokens" className="underline" style={{ color: "var(--color-accent)" }}>
            Settings, API tokens
          </Link>{" "}
          and point any MCP client or REST integration at your workspace. See the{" "}
          <Link href="/docs/integrations" className="underline" style={{ color: "var(--color-accent)" }}>
            integrations docs
          </Link>{" "}
          for details.
        </p>
      </div>
    </div>
  );
}
