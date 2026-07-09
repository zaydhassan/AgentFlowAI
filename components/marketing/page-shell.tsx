// Shared shell for public marketing pages (about, contact, legal, docs, …).
// Provides the fixed marketing navbar, a content region offset to clear it,
// and the shared footer — one consistent frame across every public page.
import { MarketingNav } from "@/components/marketing/nav";
import { Footer } from "@/components/marketing/footer";

export function MarketingPage({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Skip link for keyboard users */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface-2 focus:px-4 focus:py-2 focus:text-sm focus:text-fg focus:shadow-lg"
      >
        Skip to content
      </a>
      <MarketingNav />
      <main id="main" className="flex-1 pt-20">
        {children}
      </main>
      <Footer />
    </div>
  );
}