import { KeyRound, Lock } from "lucide-react";
import { siApple, siGoogle } from "simple-icons";
import type { LucideIcon } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

type SimpleIcon = { title: string; path: string };

/** Render a simple-icons brand glyph in the current text color. */
function BrandGlyph({ icon }: { icon: SimpleIcon }) {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor" aria-hidden focusable="false">
      <path d={icon.path} />
    </svg>
  );
}

type Provider =
  | { kind: "brand"; label: string; icon: SimpleIcon }
  | { kind: "lucide"; label: string; Icon: LucideIcon };

const PROVIDERS: Provider[] = [
  { kind: "brand", label: "Google", icon: siGoogle },
  { kind: "brand", label: "Apple", icon: siApple },
  { kind: "lucide", label: "SAML SSO", Icon: Lock },
  { kind: "lucide", label: "a passkey", Icon: KeyRound },
];

const TOOLTIP = "Not available in this demo - use the pre-filled demo account";

/**
 * Decorative social/SSO options - they mirror what a real deployment would offer,
 * but are disabled (this is a demo with a single shared account). Each is wrapped
 * in a span that acts as the tooltip trigger, and the button is `pointer-events-
 * none` so hover reaches the span (disabled buttons don't emit pointer events).
 */
export function SocialButtons() {
  return (
    <div className="space-y-2">
      {PROVIDERS.map((p) => (
        <Tooltip key={p.label} content={TOOLTIP}>
          <span className="block cursor-not-allowed">
            <button
              type="button"
              disabled
              tabIndex={-1}
              className="btn btn-outline pointer-events-none w-full justify-center gap-2 opacity-55"
            >
              {p.kind === "brand" ? <BrandGlyph icon={p.icon} /> : <p.Icon size={15} />}
              Continue with {p.label}
            </button>
          </span>
        </Tooltip>
      ))}
    </div>
  );
}
