"use client";

export function OpenCopilotButton({
  className,
  children,
  title,
}: {
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      className={className}
      title={title}
      onClick={() => window.dispatchEvent(new CustomEvent("distru:copilot:open"))}
    >
      {children}
    </button>
  );
}
