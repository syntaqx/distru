import { notFound } from "next/navigation";

/**
 * Lowest-priority catch-all under the app shell: any in-app URL that matches no
 * real route lands here and triggers `(app)/not-found`, so a mistyped path still
 * renders inside AppChrome (nav intact) instead of falling through to the bare
 * root 404. Real routes always win over this catch-all.
 */
export default function AppCatchAll() {
  notFound();
}
