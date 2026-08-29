// Contact + brand values are env-overridable so a deploy can point them at a
// real domain/inbox without editing code. NEXT_PUBLIC_ prefix keeps them
// identical on server and client (the footer renders in a shared component).
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "zaydthirteen@gmail.com";

export const site = {
  name: "AgentFlow AI",
  shortName: "AgentFlow",
  tagline: "The AI-Native Automation Platform",
  description:
    "AgentFlow AI is the AI-native automation platform. Build workflows that think, plan, reason, remember, and self-heal — orchestrated by autonomous agents across 60+ integrations.",
  // Bumped in lockstep with the changelog page (app/changelog/page.tsx).
  version: "1.0.0",
  // Business contact inbox (used by the footer, contact page, and the
  // contact-form server action). Contact form submissions are delivered here.
  email: supportEmail,
  // Role-based legal inboxes shown on the privacy/terms/security pages.
  legal: {
    privacy: process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim() || "privacy@agentflow.ai",
    legal: process.env.NEXT_PUBLIC_LEGAL_EMAIL?.trim() || "legal@agentflow.ai",
    security: process.env.NEXT_PUBLIC_SECURITY_EMAIL?.trim() || "security@agentflow.ai",
  },
  socials: {
    github: process.env.NEXT_PUBLIC_SOCIAL_GITHUB?.trim() || "https://github.com/zaydhassan/AgentFlowAI",
    linkedin: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN?.trim() || "https://www.linkedin.com/company/agentflow-ai",
    x: process.env.NEXT_PUBLIC_SOCIAL_X?.trim() || "https://x.com/agentflowai",
  },
  // Footer navigation — every entry resolves to a real, implemented route.
  footerNav: [
    {
      title: "Product",
      links: [
        { label: "Workflow Builder", href: "/workflows" },
        { label: "Features", href: "/#features" },
        { label: "Pricing", href: "/pricing" },
        { label: "Templates", href: "/templates" },
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