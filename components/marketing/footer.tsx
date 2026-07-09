// AgentFlow AI — application footer. Shared across all marketing surfaces.
// Server component (no client interactivity). Every link resolves to a real
// route — see lib/site.ts for the single source of truth.
import Link from "next/link";
import { LogoMark } from "@/components/ui/logo";
import { site } from "@/lib/site";

const focusClass =
  "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.72.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.72 0 0 .84-.27 2.75 1.05A9.4 9.4 0 0 1 12 6.84c.85 0 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.42.2 2.46.1 2.72.64.72 1.03 1.63 1.03 2.75 0 3.93-2.35 4.79-4.58 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.03 10.03 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M18.24 2.25h3.31l-7.23 8.28L23 21.75h-6.66l-5.22-6.82-5.97 6.82H1.84l7.73-8.84L1 2.25h6.83l4.72 6.23 5.69-6.23Zm-1.16 17.52h1.83L7.01 4.13H5.05l12.03 15.64Z" />
    </svg>
  );
}

function MailIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 6 7.5 6a3 3 0 0 0 5 0L22 6" />
    </svg>
  );
}

const socialLinks = [
  { label: "GitHub", href: site.socials.github, Icon: GithubIcon },
  { label: "LinkedIn", href: site.socials.linkedin, Icon: LinkedinIcon },
  { label: "X (Twitter)", href: site.socials.x, Icon: XIcon },
  { label: "Email", href: `mailto:${site.email}`, Icon: MailIcon },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-bg-soft/40">
      <h2 className="sr-only">Footer</h2>
      <div className="mx-auto max-w-7xl px-5 lg:px-8 py-12 grid grid-cols-2 gap-8 gap-y-10 md:grid-cols-6">
        <div className="col-span-2 md:col-span-2">
          <Link
            href="/"
            className={`inline-flex items-center gap-2.5 ${focusClass}`}
            aria-label="AgentFlow AI home"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-ai shadow-[0_6px_20px_-6px_rgba(124,92,255,0.8)]">
              <LogoMark className="h-4 w-4 text-white" />
            </span>
            <span className="text-base font-semibold tracking-tight">
              AgentFlow<span className="text-brand"> AI</span>
            </span>
          </Link>
          <p className="mt-4 max-w-xs text-sm text-fg-muted">
            The AI-native automation platform. Workflows that think, plan, reason, remember, and self-heal.
          </p>

          <div className="mt-5 flex items-center gap-2">
            {socialLinks.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                aria-label={label}
                className={`grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface-2/60 text-fg-muted hover:text-fg hover:border-border-strong transition-colors ${focusClass}`}
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <nav aria-label="Footer" className="col-span-2 md:col-span-4 grid grid-cols-2 gap-8 sm:grid-cols-4">
          {site.footerNav.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-fg-subtle mb-3">
                {group.title}
              </h3>
              <ul className="space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className={`inline-block text-sm text-fg-muted hover:text-fg transition-colors ${focusClass}`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-fg-subtle">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span>© {year} AgentFlow AI. All rights reserved.</span>
            <span className="hidden sm:inline" aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2/60 px-2 py-0.5 font-medium text-fg-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
                v{site.version}
              </span>
            </span>
          </div>
          <p className="order-3 sm:order-2 w-full sm:w-auto text-center sm:text-right">
            Built with <span className="text-rose-400" aria-hidden="true">❤</span><span className="sr-only">love</span> using Next.js &amp; FastAPI
          </p>
        </div>
      </div>
    </footer>
  );
}