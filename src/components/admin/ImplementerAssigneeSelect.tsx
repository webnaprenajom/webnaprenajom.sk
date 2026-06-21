import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useImplementerSelectOptions } from "@/hooks/useImplementerSelectOptions";

type Props = {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  label?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
};

/** Registry-backed realizátor select — keeps stored legacy value visible when editing. */
export function ImplementerAssigneeSelect({
  value,
  onChange,
  label = "Realizátor",
  allowEmpty = true,
  emptyLabel = "— Nepriradené —",
}: Props) {
  const { options, isKnown } = useImplementerSelectOptions(value);

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={value?.trim() || (allowEmpty ? "__none__" : undefined)}
        onValueChange={(v) => onChange(v === "__none__" ? null : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder={emptyLabel} />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty && <SelectItem value="__none__">{emptyLabel}</SelectItem>}
          {options.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
              {!isKnown(name) ? " (legacy)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
