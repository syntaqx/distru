import Link from "next/link";
import { Compass, LayoutDashboard } from "lucide-react";

/**
 * 404 for anything under the app shell. Because it lives inside the `(app)`
 * route group, Next renders it within `(app)/layout` -> AppChrome, so the
 * sidebar, topbar, and Copilot stay put and you never lose your navigation on a
 * missing page. Triggered by `notFound()` in a page (e.g. a bad record id) or by
 * the catch-all route for a mistyped in-app URL.
 */
export default function AppNotFound() {
  return (
    <div className="grid h-full place-items-center p-6">
      <div className="max-w-md text-center">
        <Compass size={40} className="mx-auto text-muted" />
        <div className="mt-3 text-5xl font-bold tracking-tight text-muted">404</div>
        <h1 className="mt-2 text-lg font-semibold">Page not found</h1>
        <p className="mt-1 text-sm text-muted">
          This page doesn&apos;t exist or may have moved. Your workspace and its
          navigation are still right here — pick up wherever you like.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/dashboard" className="btn btn-primary">
            <LayoutDashboard size={15} /> Go to dashboard
          </Link>
          <Link href="/inventory" className="btn btn-outline">
            Inventory
          </Link>
        </div>
      </div>
    </div>
  );
}
