import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

type CalloutType = "note" | "tip" | "warning";

const STYLES: Record<CalloutType, { icon: string; rail: string; iconColor: string; label: string }> = {
  note: { icon: "Info", rail: "border-info/40", iconColor: "text-info", label: "Note" },
  tip: { icon: "Lightbulb", rail: "border-brand/40", iconColor: "text-brand", label: "Tip" },
  warning: { icon: "AlertTriangle", rail: "border-warning/40", iconColor: "text-warning", label: "Warning" },
};

export function Callout({
  type = "note",
  title,
  children,
}: {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
}) {
  const s = STYLES[type];
  return (
    <div className={cn("my-6 rounded-r-xl border-l-2 bg-surface-2/40 px-4 py-3.5", s.rail)}>
      <div className="flex items-center gap-2 text-sm font-semibold text-fg">
        <Icon name={s.icon} className={cn("h-4 w-4", s.iconColor)} />
        {title ?? s.label}
      </div>
      <div className="mt-1.5 text-sm leading-relaxed text-fg-muted">{children}</div>
    </div>
  );
}