"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { organization } from "@/lib/auth-client";
import { Logo } from "@/components/brand";

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace"
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [samples, setSamples] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await organization.create({ name, slug });
    if (error || !data) {
      setLoading(false);
      setError(error?.message ?? "Could not create workspace");
      return;
    }
    await organization.setActive({ organizationId: data.id });
    await fetch("/api/org/provision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ samples }),
    });
    router.push("/chat");
    router.refresh();
  }

  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo className="text-lg" />
        </div>
        <form onSubmit={onSubmit} className="card space-y-4">
          <div>
            <h1 className="text-lg font-semibold">Create your workspace</h1>
            <p className="text-sm text-[var(--color-muted)]">
              Each workspace is an isolated Distru tenant.
            </p>
          </div>
          <div>
            <label className="label">Workspace name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Green Leaf Collective"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <input
              type="checkbox"
              checked={samples}
              onChange={(e) => setSamples(e.target.checked)}
            />
            Seed a sample catalog + inventory to explore
          </label>
          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
          <button className="btn btn-primary w-full" disabled={loading || !name}>
            {loading ? "Setting up…" : "Create workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
