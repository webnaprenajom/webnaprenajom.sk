import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EntitySearchPicker } from "@/components/admin/lookup/EntitySearchPicker";
import type { LookupResult } from "@/lib/crmLookup/types";
import {
  TASK_PARENT_LOOKUP_KIND,
  TASK_PARENT_TYPE_LABELS,
  TASK_PARENT_TYPES,
  isValidTaskParentType,
  parentFromLookup,
  type TaskParentType,
} from "@/lib/tasks/taskParentModel";

export type TaskParentFormValue = {
  parent_type: TaskParentType | "";
  parent_id: string;
  parent_label: string;
};

type Props = {
  value: TaskParentFormValue;
  onChange: (value: TaskParentFormValue) => void;
  fixedType?: TaskParentType;
  disabled?: boolean;
};

export function TaskParentPicker({ value, onChange, fixedType, disabled }: Props) {
  const parentType = fixedType ?? (value.parent_type || "");

  const lookupValue: LookupResult | null = useMemo(() => {
    if (!value.parent_id || !isValidTaskParentType(parentType)) return null;
    return {
      kind: TASK_PARENT_LOOKUP_KIND[parentType],
      id: value.parent_id,
      label: value.parent_label || value.parent_id,
    };
  }, [value.parent_id, value.parent_label, parentType]);

  return (
    <div className="space-y-2">
      {!fixedType && (
        <div>
          <label className="text-xs text-muted-foreground">Nadradená entita *</label>
          <Select
            value={parentType || "none"}
            onValueChange={(v) => {
              const next = v === "none" ? "" : (v as TaskParentType);
              onChange({ parent_type: next, parent_id: "", parent_label: "" });
            }}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Vyberte typ…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— vyberte typ —</SelectItem>
              {TASK_PARENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TASK_PARENT_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {fixedType && (
        <p className="text-xs text-muted-foreground">
          Nadradená entita: <strong>{TASK_PARENT_TYPE_LABELS[fixedType]}</strong>
        </p>
      )}
      {isValidTaskParentType(parentType) && (
        <div>
          <label className="text-xs text-muted-foreground">{TASK_PARENT_TYPE_LABELS[parentType]} *</label>
          <EntitySearchPicker
            kind={TASK_PARENT_LOOKUP_KIND[parentType]}
            value={lookupValue}
            onSelect={(row) => {
              if (!row) {
                onChange({ ...value, parent_type: parentType, parent_id: "", parent_label: "" });
                return;
              }
              const parent = parentFromLookup(row);
              if (!parent) return;
              onChange({
                parent_type: fixedType ?? parent.parent_type,
                parent_id: parent.parent_id,
                parent_label: parent.label || row.label,
              });
            }}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
