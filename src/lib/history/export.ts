import type { HistoryEntry } from "@/lib/history/types";

function csvEscape(cell: string): string {
  return `"${cell.replace(/"/g, '""')}"`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("sk-SK");
}

export function historyToCsv(rows: HistoryEntry[]): string {
  const headers = [
    "occurred_at",
    "actor_name",
    "actor_id",
    "module",
    "entity_type",
    "entity_id",
    "entity_label",
    "action_type",
    "action_label",
    "summary",
    "source_kind",
  ];
  const body = rows.map((r) =>
    [
      formatTimestamp(r.occurredAt),
      r.actorName ?? (r.actorType === "system" ? "systém" : ""),
      r.actorId ?? "",
      r.module,
      r.entityType,
      r.entityId ?? "",
      r.entityLabel ?? "",
      r.actionType,
      r.actionLabel,
      r.summary,
      r.sourceKind,
    ]
      .map((c) => csvEscape(String(c)))
      .join(","),
  );
  return [headers.map(csvEscape).join(","), ...body].join("\n");
}

function formatDetailBlock(detail: Record<string, unknown> | null): string {
  if (!detail) return "";
  const lines: string[] = [];
  if (detail.field) lines.push(`  Pole: ${detail.field}`);
  if (detail.old_value != null || detail.new_value != null) {
    lines.push(`  Zmena: ${detail.old_value ?? "—"} → ${detail.new_value ?? "—"}`);
  }
  if (detail.before) lines.push(`  Pred: ${JSON.stringify(detail.before)}`);
  if (detail.after) lines.push(`  Po: ${JSON.stringify(detail.after)}`);
  return lines.length ? `\n${lines.join("\n")}` : "";
}

export function historyToTxt(rows: HistoryEntry[]): string {
  if (rows.length === 0) return "Žiadne záznamy na export.\n";
  const blocks = rows.map((r) => {
    const who = r.actorName ?? (r.actorType === "system" ? "systém" : "—");
    const entity = r.entityLabel || r.entityId || r.entityType;
    return [
      `[${formatTimestamp(r.occurredAt)}]`,
      `Aktor: ${who}`,
      `Modul: ${r.module}`,
      `Akcia: ${r.actionLabel} (${r.actionType})`,
      `Entita: ${entity}`,
      `Súhrn: ${r.summary}`,
      `Zdroj: ${r.sourceKind}`,
    ].join("\n") + formatDetailBlock(r.detail);
  });
  return `${blocks.join("\n\n—\n\n")}\n`;
}

export function downloadHistoryExport(
  rows: HistoryEntry[],
  format: "csv" | "txt",
  filenamePrefix = "crm-historia",
) {
  const date = new Date().toISOString().slice(0, 10);
  const content = format === "csv" ? historyToCsv(rows) : historyToTxt(rows);
  const mime = format === "csv" ? "text/csv;charset=utf-8;" : "text/plain;charset=utf-8;";
  const blob = new Blob([format === "csv" ? "\ufeff" + content : content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}-${date}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
