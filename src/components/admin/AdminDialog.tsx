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
  stickyFooter,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  /** Keep footer pinned to the bottom of the scrollable dialog body. */
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${sizeClass} w-[calc(100vw-1.5rem)] sm:w-full max-h-[90vh] overflow-y-auto`}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </DialogHeader>
        <div className="space-y-4">{children}</div>
        {footer && (
          <DialogFooter
            className={`flex-col sm:flex-row gap-2 ${stickyFooter ? "sticky bottom-0 bg-background border-t pt-3" : ""}`}
          >
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
