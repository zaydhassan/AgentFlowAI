import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/page-shell";
import { PrivacyPage } from "@/components/marketing/privacy/privacy-page";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy — AgentFlow AI",
  description: "How AgentFlow AI collects, uses, and protects your data.",
};

// Legal content — do not edit without a policy review. Presentation (ids,
// icons, subtitles) lives alongside each section; the body copy is verbatim.
const sections = [
  {
    id: "data-we-collect",
    icon: "Database",
    subtitle: "Account, usage, billing, and technical data.",
    h: "Data we collect",
    body: [
      "Account data: name, email, and workspace membership you provide when signing up.",
      "Usage data: workflow configurations, execution logs, and node inputs/outputs you create while using the platform.",
      "Billing data: handled by our payment processor (Stripe). We never store full card numbers on our servers.",
      "Technical data: IP address, browser type, and product analytics (event-level, pseudonymized) to improve reliability.",
    ],
  },
  {
    id: "how-we-use-your-data",
    icon: "Workflow",
    subtitle: "To operate, support, and improve the platform.",
    h: "How we use your data",
    body: [
      "To operate the platform: run your workflows, persist state, and show execution history.",
      "To provide support: investigate issues you report and respond to your messages.",
      "To improve the product: aggregate, pseudonymized analytics on feature usage and error rates.",
      "We never sell your data, and we never train models on your private workflow content.",
    ],
  },
  {
    id: "ai-processing",
    icon: "Brain",
    subtitle: "How model providers handle your inputs and outputs.",
    h: "AI processing",
    body: [
      "Workflows may invoke AI models to process data you provide. We route requests through vetted model providers and apply data-handling terms appropriate to your plan.",
      "By default, inputs and outputs of your runs are retained so you can inspect, replay, and audit them. You can configure retention per workspace or purge history on demand.",
    ],
  },
  {
    id: "data-retention-deletion",
    icon: "History",
    subtitle: "Retention windows and how to delete your data.",
    h: "Data retention & deletion",
    body: [
      "Execution history is retained according to your plan's retention window and can be shortened in workspace settings.",
      "You can delete your account at any time from settings. Deletion removes your workspaces, workflows, and associated data within 30 days, except where retention is legally required.",
    ],
  },
  {
    id: "sharing-subprocessors",
    icon: "Share2",
    subtitle: "The subprocessors needed to run the service.",
    h: "Sharing & subprocessors",
    body: [
      "We share data only with subprocessors needed to run the service (e.g. hosting, email, payments) under data-processing agreements.",
      "We do not share your data with third parties for marketing purposes.",
    ],
  },
  {
    id: "security",
    icon: "ShieldCheck",
    subtitle: "Encryption and access controls.",
    h: "Security",
    body: [
      "Data is encrypted in transit (TLS) and at rest. Access is least-privilege and logged. See our Security page for the full program.",
    ],
  },
  {
    id: "your-rights",
    icon: "UserRound",
    subtitle: "Access, correction, export, and deletion.",
    h: "Your rights",
    body: [
      `Depending on your jurisdiction, you may have rights to access, correct, export, or delete your personal data. Email ${site.legal.privacy} to exercise these rights.`,
    ],
  },
  {
    id: "changes-to-this-policy",
    icon: "FileText",
    subtitle: "How we communicate policy updates.",
    h: "Changes to this policy",
    body: [
      "We'll update this page when the policy changes. For material changes we'll notify you in-product and by email at least 30 days in advance.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <MarketingPage>
      <PrivacyPage sections={sections} lastUpdated="July 9, 2026" email={site.legal.privacy} />
    </MarketingPage>
  );
}