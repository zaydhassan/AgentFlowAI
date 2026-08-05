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

// In-viewport reveal with a blur + translate-y, used for cinematic section
// transitions. `once` keeps it cheap (no re-triggering / re-render storms).
export function BlurReveal({
  children,
  delay = 0,
  y = 24,
  duration = 0.7,
  className,
  ...rest
}: FadeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y, filter: "blur(12px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// Stagger container — children fade/translate in sequence when the container
// enters the viewport. Pair with <StaggerItem>.
export function StaggerContainer({
  children,
  delay = 0,
  stagger = 0.08,
  className,
  ...rest
}: Omit<FadeProps, "y" | "duration"> & { stagger?: number }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, y = 20, className, ...rest }: FadeProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y, filter: "blur(8px)" },
        show: {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
        },
      }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
