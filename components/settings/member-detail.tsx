"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Mail, Navigation, Trash2, Truck } from "lucide-react";
import { ASSIGNABLE_ROLES, ROLE_COLOR } from "@/lib/roles";
import { RoleChips } from "@/components/settings/members-manager";
import {
  removeDriverProfileAction,
  removeMemberAction,
  setDriverProfileAction,
  updateMemberRolesAction,
} from "@/app/(app)/settings/members/actions";

export type MemberDetailData = {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  roles: string[];
  joinedAt: string;
  driver: { id: string; phone: string | null; licenseNumber: string | null } | null;
  driverStats: { total: number; delivered: number; active: number } | null;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function MemberDetail({ data }: { data: MemberDetailData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Access roles (everything except the driver pseudo-role) are edited here.
  const initialAccess = data.roles.filter((r) => r !== "driver");
  const [access, setAccess] = useState<string[]>(initialAccess);
  const dirty = access.slice().sort().join(",") !== initialAccess.slice().sort().join(",");

  const [isDriver, setIsDriver] = useState(!!data.driver);
  const [phone, setPhone] = useState(data.driver?.phone ?? "");
  const [license, setLicense] = useState(data.driver?.licenseNumber ?? "");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        after?.();
        router.refresh();
      } else {
        setError(res.error ?? "Something went wrong.");
      }
    });
  }

  function toggle(key: string) {
    setAccess((prev) => (prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/settings/members" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft size={15} /> All people
      </Link>

      <header className="mb-6 flex items-start gap-4">
        <span
          className="grid size-14 shrink-0 place-items-center rounded-full text-lg font-semibold"
          style={{ background: "var(--color-surface2)", color: "var(--color-accent)" }}
          aria-hidden
        >
          {initials(data.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">{data.name}</h1>
          <a href={`mailto:${data.email}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
            <Mail size={13} /> {data.email}
          </a>
          <div className="mt-2">
            <RoleChips roles={data.roles} />
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>
      )}

      {/* Roles */}
      <section className="card mb-4 p-4">
        <h2 className="text-sm font-semibold">Access roles</h2>
        <p className="mt-0.5 text-xs text-muted">
          Roles are additive — someone can be an admin and a driver at once. Managed labels for now;
          access is not yet restricted by role.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ASSIGNABLE_ROLES.map((r) => {
            const on = access.includes(r.key);
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => toggle(r.key)}
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
        {dirty && (
          <div className="mt-3 flex gap-2">
            <button
              className="btn btn-primary px-3 py-1.5 text-sm"
              disabled={pending}
              onClick={() => run(() => updateMemberRolesAction(data.memberId, access))}
            >
              <Check size={15} /> Save roles
            </button>
            <button className="btn btn-ghost px-3 py-1.5 text-sm" disabled={pending} onClick={() => setAccess(initialAccess)}>
              Cancel
            </button>
          </div>
        )}
      </section>

      {/* Driver profile */}
      <section className="card mb-4 p-4">
        <div className="flex items-center gap-2">
          <Truck size={16} className="text-muted" />
          <h2 className="text-sm font-semibold">Driver profile</h2>
          {data.driver && (
            <Link href="/fleet" className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
              <Navigation size={12} /> View in dispatch
            </Link>
          )}
        </div>

        {!isDriver && !data.driver ? (
          <div className="mt-2">
            <p className="text-xs text-muted">
              This person isn’t a driver. Make them one to assign deliveries and enable driver-app sign-in.
            </p>
            <button className="btn btn-outline mt-3 px-3 py-1.5 text-sm" onClick={() => setIsDriver(true)}>
              <Truck size={15} /> Make a driver
            </button>
          </div>
        ) : (
          <>
            {data.driverStats && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  ["Deliveries", data.driverStats.total],
                  ["Completed", data.driverStats.delivered],
                  ["Active", data.driverStats.active],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-lg border p-2" style={{ background: "var(--color-surface2)" }}>
                    <div className="text-lg font-semibold">{value}</div>
                    <div className="text-xs text-muted">{label}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Phone</label>
                <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(512) 555-0148" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">License #</label>
                <input className="input" value={license} onChange={(e) => setLicense(e.target.value)} placeholder="TX-8841203" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="btn btn-primary px-3 py-1.5 text-sm"
                disabled={pending}
                onClick={() =>
                  run(() => setDriverProfileAction(data.memberId, { phone: phone || null, licenseNumber: license || null }))
                }
              >
                <Check size={15} /> {data.driver ? "Save profile" : "Save driver"}
              </button>
              <button
                className="btn btn-ghost px-3 py-1.5 text-sm text-danger"
                disabled={pending}
                onClick={() => {
                  if (!data.driver) {
                    setIsDriver(false);
                    return;
                  }
                  if (confirm(`Remove ${data.name}'s driver profile?`)) {
                    run(() => removeDriverProfileAction(data.memberId), () => setIsDriver(false));
                  }
                }}
              >
                Remove driver
              </button>
            </div>
          </>
        )}
      </section>

      {/* Danger zone */}
      <section className="card p-4">
        <h2 className="text-sm font-semibold">Remove from workspace</h2>
        <p className="mt-0.5 text-xs text-muted">
          Revokes {data.name}’s access to this workspace. Their delivery history is kept.
        </p>
        <button
          className="btn btn-outline mt-3 px-3 py-1.5 text-sm text-danger"
          disabled={pending}
          onClick={() => {
            if (confirm(`Remove ${data.name} from this workspace?`)) {
              run(() => removeMemberAction(data.memberId), () => router.push("/settings/members"));
            }
          }}
        >
          <Trash2 size={15} /> Remove person
        </button>
      </section>
    </div>
  );
}
