// Tiny client-only wrappers around framer-motion. These exist so the
// landing page (a server component) can use motion-based animations
// without having to mark the entire file as "use client".

"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

type FadeProps = Omit<HTMLMotionProps<"div">, "initial" | "whileInView" | "viewport" | "transition" | "animate"> & {
  children: ReactNode;
  delay?: number;
  y?: number;
  duration?: number;
  className?: string;
};

export function FadeIn({ children, delay = 0, y = 16, duration = 0.5, className, ...rest }: FadeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration, delay }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// For above-the-fold elements that animate in on mount.
export function HeroFade({ children, delay = 0, y = 16, duration = 0.5, className, ...rest }: FadeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
