import { Textarea } from "@/components/ui/textarea";
import { noteTextareaFocusHandlers } from "@/lib/noteDatePrefix";

interface NoteTextareaProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  rows?: number;
}

/** Textarea with auto date prefix on focus (e.g. "10.6.2026 - "). */
export function NoteTextarea({
  value,
  onChange,
  id,
  placeholder,
  className,
  rows,
}: NoteTextareaProps) {
  const handlers = noteTextareaFocusHandlers(value, onChange);
  return (
    <Textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={handlers.onFocus}
      onKeyDown={handlers.onKeyDown}
      placeholder={placeholder}
      className={className}
      rows={rows}
    />
  );
}
