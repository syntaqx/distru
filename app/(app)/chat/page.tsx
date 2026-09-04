import { redirect } from "next/navigation";

// The Copilot now lives as a dock on every page - send old /chat links home.
export default function ChatRedirect() {
  redirect("/dashboard");
}
