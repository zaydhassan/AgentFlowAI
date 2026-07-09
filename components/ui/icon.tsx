"use client";

import * as Lucide from "lucide-react";
import type { LucideProps } from "lucide-react";

type IconName = keyof typeof Lucide;

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = (Lucide as unknown as Record<string, React.ComponentType<LucideProps>>)[name] as
    | React.ComponentType<LucideProps>
    | undefined;
  if (!Cmp) {
    // fall back to a neutral icon so missing names never break render
    const Fallback = (Lucide as unknown as Record<string, React.ComponentType<LucideProps>>).Circle;
    return <Fallback {...props} />;
  }
  return <Cmp {...props} />;
}

export type { IconName };