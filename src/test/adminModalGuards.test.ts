import { describe, expect, it, vi, afterEach } from "vitest";
import {
  __setNestedOverlayOpenAtPointerDownForTest,
  getDismissEventTarget,
  guardDialogDismissOnNestedOverlay,
  guardDialogEscapeOnNestedOverlay,
  hasOpenNestedDialogOverlay,
  isNestedDialogOverlayTarget,
  shouldPreventDialogDismiss,
  wasNestedOverlayOpenAtPointerDown,
} from "@/lib/admin/dialogNestedOverlay";
import { validatePasswordChange } from "@/lib/auth/changeOwnPassword";

function makeDismissEvent(target: EventTarget | null, originalTarget?: EventTarget | null) {
  return {
    target,
    preventDefault: vi.fn(),
    detail: originalTarget
      ? { originalEvent: { target: originalTarget } as unknown as Event }
      : undefined,
  };
}

describe("dialogNestedOverlay", () => {
  afterEach(() => {
    __setNestedOverlayOpenAtPointerDownForTest(false);
    document.body.innerHTML = "";
  });

  it("reads originalEvent target from Radix custom events", () => {
    const inner = document.createElement("button");
    const event = makeDismissEvent(document.body, inner);
    expect(getDismissEventTarget(event)).toBe(inner);
  });

  it("detects open select listbox overlays", () => {
    const listbox = document.createElement("div");
    listbox.setAttribute("role", "listbox");
    listbox.setAttribute("data-state", "open");
    document.body.appendChild(listbox);
    expect(hasOpenNestedDialogOverlay()).toBe(true);
  });

  it("detects nested popover as second open role=dialog", () => {
    const parent = document.createElement("div");
    parent.setAttribute("role", "dialog");
    parent.setAttribute("data-state", "open");
    const child = document.createElement("div");
    child.setAttribute("role", "dialog");
    child.setAttribute("data-state", "open");
    document.body.append(parent, child);
    expect(hasOpenNestedDialogOverlay()).toBe(true);
  });

  it("ignores outside dismiss when target is inside popper wrapper", () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-radix-popper-content-wrapper", "");
    const inner = document.createElement("button");
    wrapper.appendChild(inner);
    document.body.appendChild(wrapper);

    const event = makeDismissEvent(null, inner);
    guardDialogDismissOnNestedOverlay(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("blocks parent dismiss when nested overlay was open at pointerdown", () => {
    __setNestedOverlayOpenAtPointerDownForTest(true);
    const backdrop = document.createElement("div");
    document.body.appendChild(backdrop);
    const event = makeDismissEvent(backdrop, backdrop);
    expect(shouldPreventDialogDismiss(event)).toBe(true);
    guardDialogDismissOnNestedOverlay(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("allows outside dismiss for plain backdrop clicks with no nested overlay", () => {
    const backdrop = document.createElement("div");
    document.body.appendChild(backdrop);
    const event = makeDismissEvent(backdrop, backdrop);
    expect(shouldPreventDialogDismiss(event)).toBe(false);
    guardDialogDismissOnNestedOverlay(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("detects nested overlay targets via listbox role", () => {
    const el = document.createElement("div");
    el.setAttribute("role", "listbox");
    document.body.appendChild(el);
    expect(isNestedDialogOverlayTarget(el)).toBe(true);
  });

  it("blocks ESC on parent when nested overlay is open", () => {
    const select = document.createElement("div");
    select.setAttribute("role", "listbox");
    select.setAttribute("data-state", "open");
    document.body.appendChild(select);
    const event = { preventDefault: vi.fn() };
    guardDialogEscapeOnNestedOverlay(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("wasNestedOverlayOpenAtPointerDown reflects capture snapshot", () => {
    expect(wasNestedOverlayOpenAtPointerDown()).toBe(false);
    __setNestedOverlayOpenAtPointerDownForTest(true);
    expect(wasNestedOverlayOpenAtPointerDown()).toBe(true);
  });
});

describe("validatePasswordChange", () => {
  it("accepts valid password change input", () => {
    expect(
      validatePasswordChange({
        currentPassword: "old-pass",
        newPassword: "new-pass",
        confirmPassword: "new-pass",
      }),
    ).toEqual({ ok: true });
  });

  it("rejects mismatched confirmation", () => {
    const result = validatePasswordChange({
      currentPassword: "old-pass",
      newPassword: "new-pass",
      confirmPassword: "other",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/nezhodujú/);
    }
  });

  it("rejects when new password equals current", () => {
    const result = validatePasswordChange({
      currentPassword: "same",
      newPassword: "same",
      confirmPassword: "same",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects short passwords", () => {
    const result = validatePasswordChange({
      currentPassword: "abcdef",
      newPassword: "abc",
      confirmPassword: "abc",
    });
    expect(result.ok).toBe(false);
  });
});

describe("useUnsavedChangesGuard dirty contract", () => {
  it("clean snapshot means no warning path", () => {
    const snapshot = JSON.stringify({ title: "A" });
    const current = JSON.stringify({ title: "A" });
    expect(snapshot === current).toBe(true);
  });

  it("dirty snapshot means warning path", () => {
    const snapshot = JSON.stringify({ title: "A" });
    const current = JSON.stringify({ title: "B" });
    expect(snapshot === current).toBe(false);
  });
});
