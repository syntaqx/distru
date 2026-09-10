import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { env } from "@/lib/env";
import { InlineScript } from "@/components/inline-script";

// No-flash theme: set data-theme from localStorage before first paint. Rendered
// inline in the SERVER layout head (not a Client Component) so it executes during
// HTML parsing - the pattern Next documents for preventing flash before hydration.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const DESCRIPTION =
  "A faithful recreation of the Distru seed-to-sale cannabis ERP, reimagined with an AI Copilot that runs your catalog, inventory, sales, and automations.";

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: { default: "Distru", template: "%s · Distru" },
  description: DESCRIPTION,
  applicationName: "Distru",
  // A demo recreation, not a real product - keep it out of search indexes.
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: "Distru",
    title: "Distru - the ERP with an AI Copilot",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Distru - the ERP with an AI Copilot",
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <head>
        <InlineScript html={THEME_SCRIPT} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
