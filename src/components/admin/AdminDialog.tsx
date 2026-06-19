import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ReactNode } from "react";

/** Unified admin dialog shell (Batch RC6) — consistent width and mobile behavior. */
export function AdminDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  stickyFooter = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  /** Keep action buttons visible while body scrolls (long forms). */
  stickyFooter?: boolean;
}) {
  const sizeClass =
    size === "sm"
      ? "max-w-md"
      : size === "lg"
        ? "max-w-2xl"
        : size === "xl"
          ? "max-w-4xl"
          : size === "2xl"
            ? "max-w-5xl"
            : "max-w-lg";

  const contentClass = stickyFooter
    ? `${sizeClass} w-[calc(100vw-1.5rem)] sm:w-full max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden`
    : `${sizeClass} w-[calc(100vw-1.5rem)] sm:w-full max-h-[90vh] overflow-y-auto`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentClass}>
        <DialogHeader className={stickyFooter ? "px-6 pt-6 shrink-0" : undefined}>
          <DialogTitle>{title}</DialogTitle>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </DialogHeader>
        <div
          className={
            stickyFooter
              ? "space-y-4 px-6 overflow-y-auto flex-1 min-h-0"
              : "space-y-4"
          }
        >
          {children}
        </div>
        {footer && (
          <DialogFooter
            className={
              stickyFooter
                ? "sticky bottom-0 shrink-0 border-t bg-background px-6 py-4 flex-col sm:flex-row gap-2"
                : "flex-col sm:flex-row gap-2"
            }
          >
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
