import { useEffect, useState } from "react";
import { parseMoneyInput, fmtEur } from "@/lib/money/formatMoney";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export const AGREED_PRICE_HELPER =
  "Aktuálna dohodnutá cena s klientom za tento deal. Môžete ju meniť počas realizácie. Nie je auditovaný príjem — reálne úhrady evidujte v záložke Platby.";

export const ENTITY_PAYMENTS_TAB_NOTE =
  "Evidencia prijatých platieb (aj po častiach). Do provízií a financií sa započítava len suma s badge Potvrdená platba (payment_fact).";

interface Props {
  value: number;
  onSave: (next: number) => Promise<void>;
  label?: string;
  compact?: boolean;
}

/** Core contract amount on project/marketing — stored as agreed_fee, not audited revenue. */
export function AgreedPriceField({
  value,
  onSave,
  label = "Dohodnutá cena (€)",
  compact = false,
}: Props) {
  const [draft, setDraft] = useState(value > 0 ? String(value) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(value > 0 ? String(value) : "");
  }, [value]);

  const save = async () => {
    const next = parseMoneyInput(draft);
    setSaving(true);
    try {
      await onSave(next);
      setDraft(next > 0 ? String(next) : "");
    } finally {
      setSaving(false);
    }
  };

  const wrapper = compact
    ? "space-y-1.5"
    : "rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1.5";

  return (
    <div className={wrapper}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex gap-2 items-center">
        <Input
          type="number"
          step="0.1"
          min={0}
          className="h-8 max-w-[140px] text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="0"
        />
        <Button size="sm" variant="outline" className="h-8" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Uložiť"}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">{AGREED_PRICE_HELPER}</p>
    </div>
  );
}

export function formatAgreedPrice(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!n || n <= 0) return "—";
  return fmtEur(n);
}
