"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { ResendForm } from "./resend-form";

export function PendingCard() {
  return (
    <div className="space-y-5 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand to-ai text-white shadow-[0_8px_30px_-8px_rgba(124,92,255,0.7)]"
      >
        <Icon name="Mail" className="h-7 w-7" />
      </motion.div>
      <div>
        <h1 className="text-lg font-semibold">Check your email</h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          We sent a verification link to your inbox. Click it to activate your workspace.
        </p>
      </div>
      <p className="text-[11px] text-fg-subtle">
        Didn&apos;t get it? Check spam, or resend below.
      </p>
      <ResendForm />
    </div>
  );
}
