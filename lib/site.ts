// Single source of truth for site-wide brand + navigation metadata.
// Update socials / email / version here once; the footer, contact page,
// and OG metadata all read from this.
//
// NOTE: social handles + the business email below are the brand-canonical
// defaults. Replace them with your real accounts before launch.

export const site = {
  name: "AgentFlow AI",
  shortName: "AgentFlow",
  tagline: "The AI-Native Automation Platform",
  description:
    "AgentFlow AI is the AI-native automation platform. Build workflows that think, plan, reason, remember, and self-heal — orchestrated by autonomous agents across 60+ integrations.",
  // Bumped in lockstep with the changelog page (app/changelog/page.tsx).
  version: "1.0.0",
  // Business contact inbox (used by the footer, contact page, and the
  // contact-form server action).
  email: "hello@agentflow.ai",
  socials: {
    github: "https://github.com/agentflow-ai",
    linkedin: "https://www.linkedin.com/company/agentflow-ai",
    x: "https://x.com/agentflowai",
  },
  // Footer navigation — every entry resolves to a real, implemented route.
  footerNav: [
    {
      title: "Product",
      links: [
        { label: "Features", href: "/#features" },
        { label: "Pricing", href: "/pricing" },
        { label: "Templates", href: "/marketplace" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", href: "/about" },
        { label: "Contact", href: "/contact" },
      ],
    },
    {
      title: "Developers",
      links: [
        { label: "Documentation", href: "/docs" },
        { label: "Developer Guide", href: "/docs#developer-guide" },
        { label: "Changelog", href: "/changelog" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
        { label: "Security", href: "/security" },
      ],
    },
  ] as const,
} as const;

export type FooterNav = (typeof site.footerNav)[number];