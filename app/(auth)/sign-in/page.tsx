"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { SocialButtons } from "@/components/auth/social-buttons";

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
    <div className="space-y-5">
      <h1 className="text-center text-xl font-semibold tracking-tight">Log in to Distru</h1>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Signing in…" : "Continue with Email"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <SocialButtons />
    </div>
  );
}
