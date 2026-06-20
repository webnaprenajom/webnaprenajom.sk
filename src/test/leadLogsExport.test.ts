import { describe, it, expect } from "vitest";
import { leadLogsToCsv, leadLogsToTxt } from "@/lib/leads/leadLogsExport";

const sample = [
  {
    id: "log-1",
    lead_id: "lead-1",
    lead_name: "ACME",
    lead_email: "acme@test.sk",
    action: "updated",
    field: "status",
    old_value: "new",
    new_value: "won",
    changed_by_email: "maros@test.sk",
    changed_by_id: "user-1",
    created_at: "2026-06-20T10:00:00.000Z",
  },
];

describe("leadLogsExport", () => {
  it("csv includes header and escaped values", () => {
    const csv = leadLogsToCsv(sample);
    expect(csv).toContain("Dátum");
    expect(csv).toContain("updated");
    expect(csv).toContain("acme@test.sk");
  });

  it("txt is human-readable activity dump", () => {
    const txt = leadLogsToTxt(sample);
    expect(txt).toContain("maros@test.sk");
    expect(txt).toContain("new → won");
    expect(txt).toContain("ACME");
  });
});
