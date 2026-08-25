import Link from "next/link";
import { MarketingPage } from "@/components/marketing/page-shell";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const DESTINATIONS = [
  { label: "Documentation", href: "/docs", icon: "BookOpen", desc: "Concepts, guides, reference" },
  { label: "Workflow Builder", href: "/workflows", icon: "Workflow", desc: "Visual agent orchestration" },
  { label: "Pricing", href: "/pricing", icon: "CreditCard", desc: "Plans for every stage" },
  { label: "Changelog", href: "/changelog", icon: "GitBranch", desc: "What shipped, week by week" },
];

export default function NotFound() {
  return (
    <MarketingPage>
      <section className="relative mesh-bg overflow-hidden">
        <div className="relative mx-auto max-w-3xl px-5 lg:px-8 py-28 text-center">
          <p className="text-6xl font-bold tracking-tight text-brand-gradient sm:text-7xl">404</p>
          <h1 className="mt-4 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            This page wandered off the graph
          </h1>
          <p className="mx-auto mt-4 max-w-md text-fg-muted">
            The route you followed doesn&apos;t resolve to a node. Try one of these instead.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/">
              <Button variant="ai" size="md">
                <Icon name="Home" className="h-4 w-4" /> Back to home
              </Button>
            </Link>
            <Link href="/docs">
              <Button variant="secondary" size="md">
                <Icon name="BookOpen" className="h-4 w-4" /> Read the docs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 lg:px-8 pb-24">
        <div className="grid gap-3 sm:grid-cols-2">
          {DESTINATIONS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="group flex items-start gap-3 rounded-2xl border border-border bg-surface-2/40 p-5 transition-colors hover:border-border-strong hover:bg-surface-2 focus-ring"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                <Icon name={d.icon} className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg transition-colors group-hover:text-brand">
                  {d.label}
                </span>
                <span className="mt-0.5 block text-xs text-fg-muted">{d.desc}</span>
              </span>
              <Icon
                name="ArrowRight"
                className="ml-auto mt-1 h-4 w-4 shrink-0 text-fg-subtle transition-all group-hover:translate-x-0.5 group-hover:text-brand"
              />
            </Link>
          ))}
        </div>
      </section>
    </MarketingPage>
  );
}