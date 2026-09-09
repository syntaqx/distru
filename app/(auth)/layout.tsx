import { Logo } from "@/components/brand";
import { DemoResetNotice } from "@/components/demo-reset-notice";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 pb-12 pt-[12vh]">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo className="text-lg" />
        </div>
        {children}
        <DemoResetNotice variant="banner" />
        <p className="mt-6 overflow-x-auto whitespace-nowrap text-center text-xs text-muted">
          A faithful recreation of{" "}
          <a
            href="https://distru.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Distru
          </a>
          , with a few tricks of its own.
        </p>
      </div>
    </div>
  );
}
