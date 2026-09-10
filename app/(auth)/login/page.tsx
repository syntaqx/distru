"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { signIn } from "@/lib/auth-client";
import { SocialButtons } from "@/components/auth/social-buttons";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@distru.test");
  const [password, setPassword] = useState("distru1234");
  const [error, setError] = useState<string | null>(null);
  // "submitting" = awaiting auth; "redirecting" = auth ok, loading the app (which
  // in dev includes compiling the route). Both keep the button in a busy state so
  // there's never a silent wait.
  const [phase, setPhase] = useState<"idle" | "submitting" | "redirecting">("idle");
  const busy = phase !== "idle";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("submitting");
    setError(null);
    const { error } = await signIn.email({ email, password });
    if (error) {
      setPhase("idle");
      setError(error.message ?? "Sign in failed. Check your email and password.");
      return;
    }
    // Success: stay busy through the navigation + refresh (don't reset the
    // button), and start the top progress bar for the route load/compile.
    setPhase("redirecting");
    window.dispatchEvent(new Event("distru:nav:start"));
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-center text-xl font-semibold tracking-tight">Log in to Distru</h1>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            required
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            required
          />
        </div>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy && <Loader2 size={15} className="animate-spin" />}
          {phase === "submitting"
            ? "Signing in…"
            : phase === "redirecting"
              ? "Taking you in…"
              : "Continue with Email"}
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
