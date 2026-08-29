// "Why we exist" — the problem prose (existing About copy, preserved verbatim)
// plus Mission / Vision. Server component; static content, no client JS.

import { BlurReveal } from "@/components/marketing/motion";
import { Icon } from "@/components/ui/icon";

export function WhyExists() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-24 lg:px-8">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        {/* Left rail — section identity */}
        <BlurReveal>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">Why we exist</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            Automation stopped where judgment began.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-fg-muted">
            Until judgment is reliable, &ldquo;automation&rdquo; is just a different way to do it
            by hand. AgentFlow exists to close that gap.
          </p>
        </BlurReveal>

        {/* Right — the problem, verbatim from the previous About page */}
        <BlurReveal delay={0.08} className="space-y-5 text-fg-muted lg:text-lg">
          <p>
            Every team has the same backlog of work that <em>should</em> be automated: triaging
            tickets, enriching leads, summarizing docs, moving data between the eight tools they
            already pay for. Traditional automation platforms solved the easy version — fixed
            triggers, fixed steps, fixed outputs.
          </p>
          <p>
            But the moment a step needs judgment — &ldquo;is this urgent?&rdquo;, &ldquo;does this
            match the policy?&rdquo;, &ldquo;which record does this belong to?&rdquo; — those
            platforms break. Someone ends up back in the loop, doing it by hand.
          </p>
          <p>
            LLMs were supposed to fix this. Instead they gave us a new problem: they&rsquo;re
            powerful but unreliable, stateless by default, and impossible to observe once chained
            together. Teams bolted scripts onto chat windows and called it a product.
          </p>
        </BlurReveal>
      </div>

      {/* Mission / Vision */}
      <BlurReveal className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:mt-20 md:grid-cols-2">
        <div className="bg-surface-2/40 p-8 lg:p-10">
          <div className="inline-flex items-center gap-2 text-brand">
            <Icon name="Target" className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">Mission</span>
          </div>
          <p className="mt-4 text-lg text-fg">
            Make dependable AI automation accessible to every team — not just the ones with a
            platform engineering org.
          </p>
        </div>
        <div className="bg-surface-2/40 p-8 lg:p-10">
          <div className="inline-flex items-center gap-2 text-ai">
            <Icon name="Telescope" className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">Vision</span>
          </div>
          <p className="mt-4 text-lg text-fg">
            A world where &ldquo;there&rsquo;s an automation for that&rdquo; is the default answer
            to any repetitive task — and where every one of those automations is trustworthy enough
            to run while you sleep.
          </p>
        </div>
      </BlurReveal>
    </section>
  );
}