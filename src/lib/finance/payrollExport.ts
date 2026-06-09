export interface PayrollExportRow {
  payout_id: string;
  implementer: string;
  paid_at: string;
  amount: number;
  currency: string;
  reference: string;
  note: string;
  period_start: string;
  period_end: string;
  truth_level: string;
}

type PayoutRecord = {
  id: string;
  implementer: string | null;
  paid_at: string;
  amount: number;
  currency: string;
  reference: string | null;
  note: string | null;
  truth_level: string;
};

function inDateRange(iso: string, start: string, end: string): boolean {
  const d = iso.slice(0, 10);
  return d >= start && d <= end;
}

export function buildPayrollExportRows(input: {
  payoutRecords: PayoutRecord[];
  periodStart: string;
  periodEnd: string;
  implementerFilter?: string;
}): PayrollExportRow[] {
  const { payoutRecords, periodStart, periodEnd, implementerFilter } = input;

  return payoutRecords
    .filter((r) => r.truth_level === "payout_fact")
    .filter((r) => inDateRange(r.paid_at, periodStart, periodEnd))
    .filter((r) => !implementerFilter || r.implementer === implementerFilter)
    .sort((a, b) => (a.paid_at < b.paid_at ? -1 : a.paid_at > b.paid_at ? 1 : 0))
    .map((r) => ({
      payout_id: r.id,
      implementer: r.implementer ?? "",
      paid_at: r.paid_at.slice(0, 10),
      amount: Number(r.amount || 0),
      currency: r.currency || "EUR",
      reference: r.reference ?? "",
      note: r.note ?? "",
      period_start: periodStart,
      period_end: periodEnd,
      truth_level: r.truth_level,
    }));
}

export function payrollExportToCsv(rows: PayrollExportRow[]): string {
  const headers = [
    "payout_id",
    "implementer",
    "paid_at",
    "amount",
    "currency",
    "reference",
    "note",
    "period_start",
    "period_end",
    "truth_level",
  ];
  const lines = rows.map((r) =>
    [
      r.payout_id,
      r.implementer,
      r.paid_at,
      r.amount.toFixed(2),
      r.currency,
      r.reference,
      r.note,
      r.period_start,
      r.period_end,
      r.truth_level,
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(","),
  );
  return ["\ufeff" + headers.join(","), ...lines].join("\n");
}

export function downloadPayrollCsv(rows: PayrollExportRow[], filenamePrefix = "payroll-payout-facts") {
  const csv = payrollExportToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
