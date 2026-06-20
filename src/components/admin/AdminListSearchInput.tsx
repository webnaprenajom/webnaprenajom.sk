import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

/** Shared CRM list search — matches Marketing / Projekty layout. */
export function AdminListSearchInput({
  value,
  onChange,
  placeholder = "Hľadať…",
  className,
  disabled,
}: Props) {
  return (
    <div className={cn("relative max-w-md", className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        className="pl-9"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
