import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { DismissableLayerBranch } from "@radix-ui/react-dismissable-layer";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, modal = false, onCloseAutoFocus, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <DismissableLayerBranch>
      <PopoverPrimitive.Content
        ref={ref}
        modal={modal}
        align={align}
        sideOffset={sideOffset}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus?.(event);
        }}
        className={cn(
          "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      />
    </DismissableLayerBranch>
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
