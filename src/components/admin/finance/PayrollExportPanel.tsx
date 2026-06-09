import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Download } from "lucide-react";
import { buildPayrollExportRows, downloadPayrollCsv } from "@/lib/finance/payrollExport";

interface PayrollExportPanelProps {
  payoutRecords: Array<{
    id: string;
    implementer: string | null;
    paid_at: string;
    amount: number;
    currency: string;
    reference: string | null;
    note: string | null;
    truth_level: string;
  }>;
}

export function PayrollExportPanel({ payoutRecords }: PayrollExportPanelProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [implementer, setImplementer] = useState("");

  const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const periodEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const implementers = useMemo(() => {
    const set = new Set<string>();
    payoutRecords
      .filter((r) => r.truth_level === "payout_fact")
      .forEach((r) => {
        if (r.implementer) set.add(r.implementer);
      });
    return [...set].sort();
  }, [payoutRecords]);

  const rows = useMemo(
    () =>
      buildPayrollExportRows({
        payoutRecords,
        periodStart,
        periodEnd,
        implementerFilter: implementer || undefined,
      }),
    [payoutRecords, periodStart, periodEnd, implementer],
  );

  const exportCsv = () => {
    if (rows.length === 0) {
      toast({
        title: "Žiadne confirmed payout facts",
        description: `V období ${periodStart} — ${periodEnd} nie sú payout_fact záznamy.`,
        variant: "destructive",
      });
      return;
    }
    downloadPayrollCsv(rows, `payroll-${year}-${String(month).padStart(2, "0")}`);
    toast({ title: "Payroll export stiahnutý", description: `${rows.length} payout_fact riadkov` });
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Payroll export</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Iba confirmed payout_facts. Bez legacy_import, workflow-only a settlement drafts.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
          ))}
        </select>
        <select
          value={implementer}
          onChange={(e) => setImplementer(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[140px]"
        >
          <option value="">Všetci implementéri</option>
          {implementers.map((imp) => (
            <option key={imp} value={imp}>{imp}</option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="w-4 h-4 mr-2" />
          Export payroll CSV ({rows.length})
        </Button>
      </div>
      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground">V zvolenom období nie sú confirmed payout facts.</p>
      )}
    </section>
  );
}
