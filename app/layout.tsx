import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/auth/session-provider";
import { ToastHost } from "@/components/ui/toast";
import { InlineScript } from "@/components/ui/inline-script";
import { ThemeProvider } from "@/components/theme-provider";

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

// Runs synchronously in <head> before paint to apply the persisted theme
// and avoid a flash of the wrong colors on reload.
const themeBootScript = `
(function() {
  try {
    var stored = localStorage.getItem('agentflow-theme');
    var resolved;
    if (stored === 'light') {
      resolved = 'light';
    } else if (stored === 'dark') {
      resolved = 'dark';
    } else {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    var root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <InlineScript html={themeBootScript} />
      </head>
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
          <ThemeProvider>
            {children}
          </ThemeProvider>
          <ToastHost />
        </SessionProvider>
      </body>
    </html>
  );
}
