"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { motion, useReducedMotion } from "framer-motion";
import { AuthShowcase } from "@/components/auth/auth-showcase";
import { WorkflowViz } from "@/components/auth/workflow-viz";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — form */}
      <div className="flex flex-col px-6 py-10 sm:px-10 lg:px-16">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <Link href="/" className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-ai shadow-[0_6px_20px_-8px_rgba(124,92,255,0.8)]">
              <Icon name="Workflow" className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-semibold tracking-tight">AgentFlow<span className="text-brand"> AI</span></span>
          </Link>
        </motion.div>

        {/* Mobile value-prop — visible only below lg, where the side panel is hidden */}
        <div className="mt-8 lg:hidden">
          <AuthShowcase variant="compact" />
        </div>

        <div className="flex flex-1 items-start lg:items-center">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
            className="w-full max-w-sm mx-auto"
          >
            <h1 className="mt-8 text-2xl font-semibold tracking-tight lg:mt-0">{title}</h1>
            <p className="mt-2 text-sm text-fg-muted">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-7 text-center text-sm text-fg-muted">{footer}</div>}
          </motion.div>
        </div>
        <div className="text-xs text-fg-subtle">© {new Date().getFullYear()} AgentFlow AI</div>
      </div>

      {/* Right — showcase (desktop only) */}
      <div className="relative hidden lg:block mesh-bg overflow-hidden border-l border-border">
        <div className="grid-overlay absolute inset-0" />
        <div className="relative flex h-full items-center gap-10 px-16">
          <div className="flex-1">
            <AuthShowcase variant="full" />
          </div>
          <div className="hidden shrink-0 xl:block">
            <WorkflowViz />
          </div>
        </div>
      </div>
    </div>
  );
}