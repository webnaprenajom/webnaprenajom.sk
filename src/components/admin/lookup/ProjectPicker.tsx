import { useMemo } from "react";
import { EntitySearchPicker } from "./EntitySearchPicker";
import type { LookupResult } from "@/lib/crmLookup/types";

export interface ProjectPickerProps {
  projectId?: string | null;
  projectTitle?: string | null;
  onChange: (value: { project_id: string | null; project_title: string | null }) => void;
}

export function ProjectPicker({ projectId, projectTitle, onChange }: ProjectPickerProps) {
  const selected = useMemo((): LookupResult | null => {
    if (!projectId) return null;
    return {
      kind: "project",
      id: projectId,
      label: projectTitle || "Projekt",
    };
  }, [projectId, projectTitle]);

  return (
    <EntitySearchPicker
      kind="project"
      value={selected}
      onSelect={(result) =>
        onChange({
          project_id: result?.id ?? null,
          project_title: result?.label ?? null,
        })
      }
    />
  );
}
