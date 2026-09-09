import { Leaf } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold ${className}`}>
      <span
        className="grid size-7 place-items-center rounded-lg"
        style={{ background: "var(--color-accent)", color: "var(--color-accentfg)" }}
      >
        <Leaf size={16} />
      </span>
      <span>Distru</span>
    </span>
  );
}
