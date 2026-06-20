/**
 * Radix nested overlays (Select, Popover, …) portal outside DialogContent.
 * While open they call DismissableLayer with disableOutsidePointerEvents — dialog
 * body gets pointer-events:none and clicks fall through to the dialog overlay,
 * which Radix treats as an intentional dismiss. Guard parent dialog dismiss here.
 */

type DismissEvent = {
  preventDefault: () => void;
  target: EventTarget | null;
  detail?: { originalEvent?: Event };
};

const NESTED_OVERLAY_TARGET_SELECTOR = [
  "[data-radix-popper-content-wrapper]",
  '[role="listbox"]',
  "[cmdk-root]",
  '[role="menu"]',
].join(", ");

/** Radix CustomEvent — inspect the native pointer/focus target, not the synthetic event target. */
export function getDismissEventTarget(event: DismissEvent): EventTarget | null {
  const original = event.detail?.originalEvent?.target;
  if (original) return original;
  return event.target;
}

export function isNestedDialogOverlayTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(NESTED_OVERLAY_TARGET_SELECTOR);
}

/** Open portaled Select / Popover / menu overlays (not the parent dialog itself). */
export function hasOpenNestedDialogOverlay(): boolean {
  if (document.querySelector('[role="listbox"][data-state="open"]')) return true;

  // Popover content is role="dialog" — parent modal is also role="dialog".
  const openDialogs = document.querySelectorAll('[role="dialog"][data-state="open"]');
  if (openDialogs.length > 1) return true;

  for (const wrapper of document.querySelectorAll("[data-radix-popper-content-wrapper]")) {
    if (wrapper.querySelector('[data-state="open"]')) return true;
  }

  return false;
}

/** Snapshot at pointerdown capture — nested overlay may unmount before dialog handler runs. */
let nestedOverlayOpenAtPointerDown = false;

if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    () => {
      nestedOverlayOpenAtPointerDown = hasOpenNestedDialogOverlay();
    },
    true,
  );
}

export function wasNestedOverlayOpenAtPointerDown(): boolean {
  return nestedOverlayOpenAtPointerDown;
}

/** For tests — reset capture snapshot. */
export function __setNestedOverlayOpenAtPointerDownForTest(value: boolean): void {
  nestedOverlayOpenAtPointerDown = value;
}

export function shouldPreventDialogDismiss(event: DismissEvent): boolean {
  if (hasOpenNestedDialogOverlay()) return true;
  if (nestedOverlayOpenAtPointerDown) return true;
  if (isNestedDialogOverlayTarget(getDismissEventTarget(event))) return true;
  return false;
}

export function guardDialogDismissOnNestedOverlay(event: DismissEvent): void {
  if (shouldPreventDialogDismiss(event)) {
    event.preventDefault();
  }
}

export function guardDialogEscapeOnNestedOverlay(event: { preventDefault: () => void }): void {
  if (hasOpenNestedDialogOverlay()) {
    event.preventDefault();
  }
}
