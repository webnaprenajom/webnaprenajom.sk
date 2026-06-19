import { cn } from "@/lib/utils";
import { NoteTextarea } from "@/components/admin/NoteTextarea";

/** Fixed viewport — ~1000 chars visible before inner scroll (ponytail: height heuristic). */
export const ADMIN_LONG_TEXT_VISIBLE_CHARS = 1000;
export const ADMIN_LONG_TEXT_FIELD_HEIGHT = "h-[17.5rem]";

export interface AdminLongTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  label?: string;
  placeholder?: string;
  className?: string;
  showCount?: boolean;
  withDatePrefix?: boolean;
}

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
    ADMIN_LONG_TEXT_FIELD_HEIGHT,
    "min-h-0 max-h-[17.5rem] overflow-y-auto resize-none",
    className,
  );

  const nearLimit = value.length > ADMIN_LONG_TEXT_VISIBLE_CHARS;

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
        <p
          className={cn(
            "text-[11px] text-right tabular-nums",
            nearLimit ? "text-orange-600" : "text-muted-foreground",
          )}
        >
          {value.length.toLocaleString("sk-SK")} znakov
          {nearLimit ? " · posúvajte pre viac" : ` · do ~${ADMIN_LONG_TEXT_VISIBLE_CHARS.toLocaleString("sk-SK")} bez scrollu`}
        </p>
      )}
    </div>
  );
}
