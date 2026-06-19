import { cn } from "@/lib/utils";
import { NoteTextarea } from "@/components/admin/NoteTextarea";

/** Visible viewport ≈ first ~1000 chars before inner scroll (ponytail: fixed height heuristic). */
export const ADMIN_LONG_TEXT_VISIBLE_CHARS = 1000;
export const ADMIN_LONG_TEXT_MIN_HEIGHT = "min-h-[17.5rem]";
export const ADMIN_LONG_TEXT_MAX_HEIGHT = "max-h-[17.5rem]";

export interface AdminLongTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  label?: string;
  placeholder?: string;
  className?: string;
  /** Show character count under field */
  showCount?: boolean;
  /** Use date-prefix-on-focus behavior from NoteTextarea */
  withDatePrefix?: boolean;
}

/**
 * Unified notes / description / remark field for admin modals.
 * ~1000 chars visible without scroll; scrollbar appears when content exceeds viewport.
 */
export function AdminLongTextField({
  value,
  onChange,
  id,
  label,
  placeholder,
  className,
  showCount = true,
  withDatePrefix = true,
}: AdminLongTextFieldProps) {
  const fieldClass = cn(
    ADMIN_LONG_TEXT_MIN_HEIGHT,
    ADMIN_LONG_TEXT_MAX_HEIGHT,
    "overflow-y-auto resize-none",
    className,
  );

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
      )}
      {withDatePrefix ? (
        <NoteTextarea
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={fieldClass}
        />
      ) : (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            fieldClass,
          )}
        />
      )}
      {showCount && (
        <p className="text-[11px] text-muted-foreground text-right tabular-nums">
          {value.length.toLocaleString("sk-SK")} znakov
        </p>
      )}
    </div>
  );
}
