import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StatusChipProps {
  label: ReactNode;
  className?: string;
  /** Subtle leading dot when it aids scanability */
  dot?: boolean;
}

/** Compact status pill — shared tint/border/radius for CRM state labels. */
export function StatusChip({ label, className, dot = false }: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-full items-center gap-1.5 rounded-md border px-2 text-[10px] font-medium leading-none",
        className,
      )}
    >
      {dot && <span className="size-1.5 shrink-0 rounded-full bg-current opacity-75" aria-hidden />}
      <span className="truncate">{label}</span>
    </span>
  );
}
