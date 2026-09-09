import { Leaf } from "lucide-react";

export function Logo({
  className = "",
  onAccent = false,
}: {
  className?: string;
  onAccent?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-semibold ${className}`}
      style={onAccent ? { color: "var(--color-accentfg)" } : undefined}
    >
      <span
        className="grid size-7 place-items-center rounded-lg"
        style={
          onAccent
            ? { background: "var(--color-accentfg)", color: "var(--color-accent)" }
            : { background: "var(--color-accent)", color: "var(--color-accentfg)" }
        }
      >
        <Leaf size={16} />
      </span>
      <span>Distru</span>
    </span>
  );
}
