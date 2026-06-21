import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AdminIconButtonProps extends React.ComponentProps<typeof Button> {
  label: string;
}

/** Normalized table/action icon button — consistent hit target and hover. */
export const AdminIconButton = React.forwardRef<HTMLButtonElement, AdminIconButtonProps>(
  ({ className, label, size = "icon", variant = "ghost", children, ...props }, ref) => (
    <Button
      ref={ref}
      type="button"
      size={size}
      variant={variant}
      aria-label={label}
      title={label}
      className={cn(
        "size-8 shrink-0 text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  ),
);
AdminIconButton.displayName = "AdminIconButton";
