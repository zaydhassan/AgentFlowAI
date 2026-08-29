import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/page-shell";
import { AboutHero } from "@/components/about/about-hero";
import { WhyExists } from "@/components/about/why-exists";
import { Principles } from "@/components/about/principles";
import { PhilosophyStrip } from "@/components/about/philosophy-strip";
import { Architecture } from "@/components/about/architecture";
import { ArchitectureFlow } from "@/components/about/architecture-flow";
import { TechnologyStack } from "@/components/about/technology-stack";
import { Roadmap } from "@/components/about/roadmap";
import { AboutCta } from "@/components/about/about-cta";

export const metadata: Metadata = {
  title: "About — AgentFlow AI",
  description:
    "AgentFlow AI is the AI-native automation platform. Learn about our mission, the problem we solve, how the technology works, and where we're headed.",
};

// Story arc: ABOUT AGENTFLOW → WHY WE EXIST → WHAT WE BELIEVE → HOW THE
// TECHNOLOGY WORKS → HOW AGENTS FLOW → WHERE WE'RE GOING → JOIN THE JOURNEY.
// All content lives in components/about/*; this page composes them.
export default function AboutPage() {
  return (
    <MarketingPage>
      <AboutHero />
      <WhyExists />
      <Principles />
      <PhilosophyStrip />
      <Architecture />
      <ArchitectureFlow />
      <TechnologyStack />
      <Roadmap />
      <AboutCta />
    </MarketingPage>
  );
}