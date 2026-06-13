import { buildAuditSummary } from "@/lib/audit/auditLogFormat";

describe("rc6.6 audit log", () => {
  it("builds truncated summary", () => {
    const s = buildAuditSummary("role_assigned", "user abc → admin");
    expect(s).toContain("role_assigned");
    expect(s.length).toBeLessThanOrEqual(500);
  });
});
