import { Logo } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo className="text-lg" />
        </div>
        {children}
        <p className="mt-6 text-center text-xs text-muted">
          The agentic AI layer for the Distru cannabis ERP.
        </p>
      </div>
    </div>
  );
}
