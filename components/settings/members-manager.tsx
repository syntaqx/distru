"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search, Truck, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { ASSIGNABLE_ROLES, ROLE_COLOR, roleLabel } from "@/lib/roles";
import { inviteMemberAction } from "@/app/(app)/settings/members/actions";

export type MemberRow = {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  roles: string[];
  joinedAt: string;
  isDriver: boolean;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function RoleChips({ roles }: { roles: string[] }) {
  if (roles.length === 0) return <span className="text-xs text-muted">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <span
          key={r}
          className="badge text-xs"
          style={{ color: ROLE_COLOR[r] ?? "var(--color-muted)", borderColor: ROLE_COLOR[r] ?? undefined }}
        >
          {roleLabel(r)}
        </span>
      ))}
    </div>
  );
}

export function MembersManager({ rows }: { rows: MemberRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [inviting, setInviting] = useState(false);

  const query = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      rows.filter(
        (m) =>
          !query ||
          m.name.toLowerCase().includes(query) ||
          m.email.toLowerCase().includes(query) ||
          m.roles.some((r) => r.includes(query)),
      ),
    [rows, query],
  );

  const drivers = rows.filter((m) => m.isDriver).length;

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["People", rows.length],
          ["Drivers", drivers],
          ["Admins", rows.filter((m) => m.roles.includes("owner") || m.roles.includes("admin")).length],
        ].map(([label, value]) => (
          <div key={label as string} className="card">
            <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            placeholder="Search people, email, role…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={() => setInviting(true)}>
          <UserPlus size={16} /> Add person
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-160 text-sm">
          <thead>
            <tr className="text-left text-muted" style={{ background: "var(--color-surface)" }}>
              <th className="px-4 py-2.5 font-medium">Person</th>
              <th className="px-4 py-2.5 font-medium">Roles</th>
              <th className="px-4 py-2.5 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr
                key={m.memberId}
                className="cursor-pointer border-t transition-colors hover:bg-surface2"
                style={{ background: "var(--color-surface)" }}
                onClick={() => router.push(`/settings/members/${m.memberId}`)}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold"
                      style={{ background: "var(--color-surface2)", color: "var(--color-accent)" }}
                      aria-hidden
                    >
                      {initials(m.name)}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/settings/members/${m.memberId}`}
                        className="block truncate font-medium hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {m.name}
                        {m.isDriver && <Truck size={13} className="ml-1.5 inline align-[-2px] text-muted" />}
                      </Link>
                      <div className="truncate text-xs text-muted">{m.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <RoleChips roles={m.roles} />
                </td>
                <td className="px-4 py-2.5 text-muted">{new Date(m.joinedAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-muted">
                  No people match “{q}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <InviteDialog
        open={inviting}
        onOpenChange={setInviting}
        onDone={() => {
          setInviting(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<string[]>(["member"]);
  const [isDriver, setIsDriver] = useState(false);
  const [phone, setPhone] = useState("");
  const [license, setLicense] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleRole(key: string) {
    setRoles((prev) => (prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]));
  }

  function reset() {
    setName("");
    setEmail("");
    setRoles(["member"]);
    setIsDriver(false);
    setPhone("");
    setLicense("");
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await inviteMemberAction({
        name,
        email,
        roles,
        driver: isDriver ? { phone: phone || null, licenseNumber: license || null } : null,
      });
      if (res.ok) {
        reset();
        onDone();
      } else {
        setError(res.error ?? "Could not add the person.");
      }
    });
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add a person" className="max-w-lg">
      <div className="space-y-3 px-4 py-4">
        <p className="text-xs text-muted">
          Creates a real login for this workspace. Drivers get a driver profile so they can be
          assigned deliveries and sign into the driver app.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Blake" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jordan@greenleaf.test"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Roles</label>
          <div className="flex flex-wrap gap-1.5">
            {ASSIGNABLE_ROLES.map((r) => {
              const on = roles.includes(r.key);
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => toggleRole(r.key)}
                  className={`badge text-xs transition-colors ${on ? "" : "opacity-55"}`}
                  style={on ? { color: ROLE_COLOR[r.key], borderColor: ROLE_COLOR[r.key] } : undefined}
                  title={r.desc}
                  aria-pressed={on}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-2 pt-1 text-sm">
          <input type="checkbox" checked={isDriver} onChange={(e) => setIsDriver(e.target.checked)} />
          <Truck size={14} className="text-muted" /> Also a driver
        </label>
        {isDriver && (
          <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-2" style={{ background: "var(--color-surface2)" }}>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Phone</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(512) 555-0148" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">License #</label>
              <input className="input" value={license} onChange={(e) => setLicense(e.target.value)} placeholder="TX-8841203" />
            </div>
          </div>
        )}

        {error && <div className="text-sm text-danger">{error}</div>}
      </div>
      <div className="flex justify-end gap-2 border-t px-4 py-3">
        <button className="btn btn-outline" onClick={() => onOpenChange(false)} disabled={pending}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={submit} disabled={pending || !name.trim() || !email.trim()}>
          <Plus size={15} /> {pending ? "Adding…" : "Add person"}
        </button>
      </div>
    </Modal>
  );
}
