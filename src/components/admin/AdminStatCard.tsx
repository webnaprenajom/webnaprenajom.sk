import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AdminStatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  accent?: string;
  valueClassName?: string;
}

/** KPI summary tile — numeric emphasis, restrained surface. */
export function AdminStatCard({
  icon: Icon,
  label,
  value,
  accent = "text-primary",
  valueClassName,
}: AdminStatCardProps) {
  return (
    <div className="rounded-xl border border-border/80 bg-card/60 p-3.5 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
        <Icon className={cn("size-3.5 shrink-0", accent)} strokeWidth={2} />
        <span className="truncate">{label}</span>
      </div>
      <p className={cn("mt-1.5 text-2xl font-bold tabular-nums tracking-tight", valueClassName ?? accent)}>
        {value}
      </p>
    </div>
  );
}
