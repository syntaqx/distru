"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth-client";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signUp.email({ name, email, password });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Sign up failed");
      return;
    }
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Create your account</h1>
        <p className="text-sm text-[var(--color-muted)]">Start running your catalog with AI.</p>
      </div>
      <div>
        <label className="label">Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="label">Password</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
      </div>
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      <button className="btn btn-primary w-full" disabled={loading}>
        {loading ? "Creating…" : "Create account"}
      </button>
      <p className="text-center text-sm text-[var(--color-muted)]">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-[var(--color-accent)] hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
