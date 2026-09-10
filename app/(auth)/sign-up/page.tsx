import { redirect } from "next/navigation";

// Sign-ups are disabled - this is a shared demo with a single pre-seeded account.
// (The demo user is created server-side by the seed, so this only closes the UI.)
export default function SignUpPage() {
  redirect("/login");
}
