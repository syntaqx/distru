"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Boxes, Building2, LayoutDashboard, LogOut, Sparkles, Zap } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { Logo } from "@/components/brand";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", Icon: Boxes },
  { href: "/companies", label: "Companies", Icon: Building2 },
  { href: "/integrations", label: "Integrations", Icon: Zap },
];

export function Sidebar({
  orgName,
  userName,
  userEmail,
  onToggleCopilot,
  copilotOpen,
}: {
  orgName: string;
  userName: string;
  userEmail: string;
  onToggleCopilot: () => void;
  copilotOpen: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r" style={{ background: "var(--color-surface)" }}>
      <div className="p-4">
        <Logo />
      </div>
      <div className="mx-3 mb-2 rounded-lg border px-3 py-2" style={{ background: "var(--color-bg)" }}>
        <div className="text-[11px] uppercase tracking-wide text-muted">Workspace</div>
        <div className="truncate text-sm font-medium">{orgName}</div>
      </div>

      <div className="px-3 pb-1">
        <button
          onClick={onToggleCopilot}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          style={
            copilotOpen
              ? { background: "var(--color-accent)", color: "var(--color-accentfg)" }
              : { background: "var(--color-surface2)", color: "var(--color-fg)" }
          }
          title="Toggle Copilot (⌘/Ctrl+J)"
        >
          <Sparkles size={16} />
          Copilot
          <span className="ml-auto text-[11px] opacity-70">⌘J</span>
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          const { Icon } = item;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
              style={
                active
                  ? { background: "var(--color-surface2)", color: "var(--color-fg)" }
                  : { color: "var(--color-muted)" }
              }
            >
              <Icon size={16} style={{ color: active ? "var(--color-accent)" : undefined }} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <div className="mb-2 px-1">
          <div className="truncate text-sm font-medium">{userName}</div>
          <div className="truncate text-xs text-muted">{userEmail}</div>
        </div>
        <button
          className="btn btn-outline w-full text-sm"
          onClick={async () => {
            await signOut();
            router.push("/sign-in");
            router.refresh();
          }}
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </aside>
  );
}
