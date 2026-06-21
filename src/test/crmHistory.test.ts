import { describe, expect, it } from "vitest";
import { filterHistoryEntries, collectHistoryFilterOptions } from "@/lib/history/filterHistory";
import { historyToCsv, historyToTxt } from "@/lib/history/export";
import {
  mergeHistoryEntries,
  normalizeAuditLog,
  normalizeLeadLog,
  type LeadLogRow,
} from "@/lib/history/normalize";
import type { AuditLogEntry } from "@/lib/audit/auditLog";
import type { HistoryEntry } from "@/lib/history/types";
import { DEFAULT_HISTORY_FILTERS } from "@/lib/history/types";

const leadRow: LeadLogRow = {
  id: "l1",
  lead_id: "lead-1",
  lead_name: "Acme",
  lead_email: "a@acme.sk",
  action: "updated",
  field: "status",
  old_value: "new",
  new_value: "won",
  changed_by_email: "owner@test.sk",
  changed_by_id: "u1",
  created_at: "2026-06-20T10:00:00.000Z",
};

const auditRow: AuditLogEntry = {
  id: "a1",
  actor_user_id: "u2",
  action_type: "entity_deleted",
  target_type: "rental_websites",
  target_id: "r1",
  summary: "Zmazaný prenájom: Site A",
  before_state: null,
  after_state: { title: "Site A" },
  created_at: "2026-06-21T12:00:00.000Z",
};

describe("crm history normalize", () => {
  it("normalizes lead_logs row", () => {
    const e = normalizeLeadLog(leadRow);
    expect(e.sourceKind).toBe("lead_logs");
    expect(e.entityType).toBe("lead");
    expect(e.actionLabel).toContain("Status");
    expect(e.summary).toContain("Acme");
  });

  it("normalizes admin_audit_log row with actor map", () => {
    const e = normalizeAuditLog(auditRow, new Map([["u2", "admin@test.sk"]]));
    expect(e.sourceKind).toBe("admin_audit_log");
    expect(e.actorName).toBe("admin@test.sk");
    expect(e.module).toBe("Prenájmy");
  });

  it("merges mixed sources by timestamp desc", () => {
    const merged = mergeHistoryEntries([
      normalizeLeadLog(leadRow),
      normalizeAuditLog(auditRow, new Map()),
    ]);
    expect(merged[0].sourceKind).toBe("admin_audit_log");
    expect(merged[1].sourceKind).toBe("lead_logs");
  });
});

describe("crm history filters", () => {
  const entries: HistoryEntry[] = [
    normalizeLeadLog(leadRow),
    normalizeAuditLog(auditRow, new Map([["u2", "admin@test.sk"]])),
  ];

  it("filters by module and search", () => {
    const filtered = filterHistoryEntries(entries, {
      ...DEFAULT_HISTORY_FILTERS,
      module: "Leady",
      search: "Acme",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].entityType).toBe("lead");
  });

  it("collects filter options from entries", () => {
    const opts = collectHistoryFilterOptions(entries);
    expect(opts.modules).toContain("Leady");
    expect(opts.modules).toContain("Prenájmy");
  });
});

describe("crm history export", () => {
  const entries = [normalizeLeadLog(leadRow)];

  it("exports CSV with required columns", () => {
    const csv = historyToCsv(entries);
    expect(csv).toContain("occurred_at");
    expect(csv).toContain("source_kind");
    expect(csv).toContain("lead_logs");
  });

  it("exports human-readable TXT blocks", () => {
    const txt = historyToTxt(entries);
    expect(txt).toContain("Acme");
    expect(txt).toContain("Aktor:");
    expect(txt).toContain("Modul:");
  });
});
