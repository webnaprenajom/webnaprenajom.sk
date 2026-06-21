import { fmtEur } from "@/lib/money/formatMoney";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import { useAccessContext } from "@/hooks/useAccessContext";
import { canEditOperatingCosts } from "@/lib/rbac/writePermissions";

interface Props {
  value: number;
  onSave: (next: number) => Promise<void>;
  label?: string;
}

export function OperatingCostField({ value, onSave, label = "Prevádzkové náklady (€)" }: Props) {
  const access = useAccessContext();
  const canEdit = canEditOperatingCosts(access);
  const [draft, setDraft] = useState(String(value ?? 0));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!canEdit) return;
    const next = Math.max(0, parseFloat(draft.replace(",", ".")) || 0);
    setSaving(true);
    try {
      await onSave(next);
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <p className="text-sm flex items-center gap-1.5 text-muted-foreground">
          <Lock className="w-3.5 h-3.5" />
          {fmtEur(Number(value ?? 0))} · úpravu môže len admin
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex gap-2 items-center">
        <Input
          type="number"
          step="0.1"
          min={0}
          className="h-8 max-w-[140px] text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== String(value ?? 0)) void save();
          }}
        />
        <Button size="sm" variant="outline" className="h-8" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Uložiť"}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Interné náklady dealu — odpočítavajú sa od tržieb (payment_records) pri výpočte zisku pre provízie.
      </p>
    </div>
  );
}
