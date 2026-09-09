"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronsUpDown, LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme";

function initials(name?: string | null) {
  return (
    (name ?? "")
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U"
  );
}

export function UserMenu({ userName, userEmail }: { userName: string; userEmail: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--color-surface2)]"
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold"
          style={{ background: "var(--color-surface2)", color: "var(--color-muted)" }}
        >
          {initials(userName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{userName}</span>
          <span className="block truncate text-xs text-muted">{userEmail}</span>
        </span>
        <ChevronsUpDown size={15} className="text-muted" />
      </button>

      {open && (
        <>
          <button className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 z-20 mb-1 rounded-xl border p-1 shadow-lg" style={{ background: "var(--color-surface)" }}>
            <div className="border-b px-3 py-2">
              <div className="truncate text-sm font-medium">{userName}</div>
              <div className="truncate text-xs text-muted">{userEmail}</div>
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm">Theme</span>
              <ThemeToggle />
            </div>
            <Link
              href="/docs"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[var(--color-surface2)]"
            >
              <BookOpen size={15} /> Docs
            </Link>
            <button
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[var(--color-surface2)]"
              onClick={async () => {
                setOpen(false);
                await signOut();
                router.push("/sign-in");
                router.refresh();
              }}
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
