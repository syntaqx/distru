import Link from "next/link";
import { Logo } from "@/components/brand";

/**
 * Root fallback 404 (outside the app shell) — for unmatched non-app paths and
 * logged-out visitors. In-app 404s use `(app)/not-found`, which keeps the nav.
 */
export default function RootNotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo className="text-lg" />
      <div className="text-5xl font-bold tracking-tight text-muted">404</div>
      <p className="max-w-sm text-sm text-muted">
        This page doesn&apos;t exist. Head back and we&apos;ll get you where you need to go.
      </p>
      <Link href="/" className="btn btn-primary">
        Go home
      </Link>
    </div>
  );
}
