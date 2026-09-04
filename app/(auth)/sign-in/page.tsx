"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@distru.test");
  const [password, setPassword] = useState("distru1234");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn.email({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Sign in failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Welcome back</h1>
        <p className="text-sm text-[var(--color-muted)]">Sign in to your workspace.</p>
      </div>
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="label">Password</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      <button className="btn btn-primary w-full" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm text-[var(--color-muted)]">
        No account?{" "}
        <Link href="/sign-up" className="text-[var(--color-accent)] hover:underline">
          Create one
        </Link>
      </p>
      <div className="rounded-lg border border-dashed p-3 text-xs text-[var(--color-muted)]">
        Demo tenant is pre-filled - just click <span className="text-[var(--color-fg)]">Sign in</span>.
      </div>
    </form>
  );
}
