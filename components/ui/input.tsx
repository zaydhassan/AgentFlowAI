import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    suppressHydrationWarning
    className={cn(
      "h-9 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-fg-subtle focus-ring transition-colors",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    suppressHydrationWarning
    className={cn(
      "w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus-ring transition-colors resize-none",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";