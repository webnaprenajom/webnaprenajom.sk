import type { KeyboardEvent } from "react";

/** Slovak-style date prefix for internal notes, e.g. "10.6.2026 - " */
export function formatNoteDatePrefix(date = new Date()): string {
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()} - `;
}

const DATE_PREFIX_RE = /^\d{1,2}\.\d{1,2}\.\d{4} - /;

export function noteTextareaFocusHandlers(
  value: string,
  setValue: (v: string) => void,
): {
  onFocus: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
} {
  return {
    onFocus: () => {
      if (!value.trim()) {
        setValue(formatNoteDatePrefix());
      }
    },
    onKeyDown: (e) => {
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.currentTarget;
      const pos = el.selectionStart ?? 0;
      const prefix = formatNoteDatePrefix();

      if (!value.trim()) {
        e.preventDefault();
        const next = prefix + e.key;
        setValue(next);
        requestAnimationFrame(() => {
          el.selectionStart = el.selectionEnd = next.length;
        });
        return;
      }

      const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
      const lineBeforeCursor = value.slice(lineStart, pos);
      if (lineBeforeCursor === "" && pos > 0 && value.charAt(pos - 1) === "\n") {
        if (!DATE_PREFIX_RE.test(value.slice(lineStart))) {
          e.preventDefault();
          const next = value.slice(0, pos) + prefix + e.key + value.slice(pos);
          setValue(next);
          const cursor = pos + prefix.length + 1;
          requestAnimationFrame(() => {
            el.selectionStart = el.selectionEnd = cursor;
          });
        }
      }
    },
  };
}
