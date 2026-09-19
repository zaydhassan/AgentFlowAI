import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/auth/session-provider";
import { ToastHost } from "@/components/ui/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AgentFlow AI — The AI-Native Automation Platform",
  description:
    "Build intelligent workflows that think, plan, reason, remember, and self-heal. The next generation of AI-native workflow automation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-bg text-fg"
        // Browser extensions (e.g. Bitdefender, password managers, VPN anti-
        // tracking) inject attributes such as `fdprocessedid` onto interactive
        // elements after SSR HTML arrives but before React hydrates, which
        // triggers spurious hydration-mismatch warnings. This flag is the
        // documented React escape hatch for third-party DOM mutation; it does
        // not change rendered output.
        suppressHydrationWarning
      >
        <SessionProvider>
          {children}
          <ToastHost />
        </SessionProvider>
      </body>
    </html>
  );
}
