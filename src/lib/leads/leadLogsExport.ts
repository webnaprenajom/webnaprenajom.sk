export type LeadLogExportRow = {
  id: string;
  lead_id: string | null;
  lead_name: string | null;
  lead_email: string | null;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by_email: string | null;
  changed_by_id: string | null;
  created_at: string;
};

function csvEscape(cell: string): string {
  return `"${cell.replace(/"/g, '""')}"`;
}

function formatLogTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("sk-SK");
}

export function leadLogsToCsv(rows: LeadLogExportRow[]): string {
  const headers = [
    "Dátum",
    "Akcia",
    "Pole",
    "Lead",
    "E-mail leadu",
    "Pôvodná hodnota",
    "Nová hodnota",
    "Kto zmenil",
    "Lead ID",
    "Log ID",
  ];
  const body = rows.map((r) =>
    [
      formatLogTimestamp(r.created_at),
      r.action,
      r.field ?? "",
      r.lead_name ?? "",
      r.lead_email ?? "",
      r.old_value ?? "",
      r.new_value ?? "",
      r.changed_by_email ?? "systém",
      r.lead_id ?? "",
      r.id,
    ]
      .map((c) => csvEscape(String(c)))
      .join(","),
  );
  return [headers.map(csvEscape).join(","), ...body].join("\n");
}

export function leadLogsToTxt(rows: LeadLogExportRow[]): string {
  if (rows.length === 0) return "Žiadne záznamy na export.\n";
  const lines = rows.map((r) => {
    const who = r.changed_by_email ?? "systém";
    const lead = r.lead_name || r.lead_email || r.lead_id || "—";
    const field = r.field ? ` · pole ${r.field}` : "";
    const delta =
      r.old_value || r.new_value
        ? `\n    ${r.old_value ?? "—"} → ${r.new_value ?? "—"}`
        : "";
    return `[${formatLogTimestamp(r.created_at)}] ${who} · ${r.action}${field} · ${lead}${delta}`;
  });
  return `${lines.join("\n\n")}\n`;
}

export function downloadLeadLogsExport(
  rows: LeadLogExportRow[],
  format: "csv" | "txt",
  filenamePrefix = "crm-historia-leadov",
) {
  const date = new Date().toISOString().slice(0, 10);
  const content = format === "csv" ? leadLogsToCsv(rows) : leadLogsToTxt(rows);
  const mime = format === "csv" ? "text/csv;charset=utf-8;" : "text/plain;charset=utf-8;";
  const blob = new Blob([format === "csv" ? "\ufeff" + content : content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}-${date}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
