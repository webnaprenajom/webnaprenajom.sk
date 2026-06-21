import { describe, expect, it } from "vitest";
import { normalizeAuditLog } from "@/lib/history/normalize";
import type { AuditLogEntry } from "@/lib/audit/auditLog";
import {
  buildHistoricalIdentityContext,
  HISTORICAL_ROLE_SUFFIX,
} from "@/lib/identity/historicalIdentity";

describe("history actor after user archive", () => {
  it("shows archived actor with historical suffix", () => {
    const entry: AuditLogEntry = {
      id: "a1",
      actor_user_id: "u-removed",
      action_type: "commission_status_changed",
      target_type: "commission",
      target_id: "c1",
      summary: "Provízia zaplatená",
      before_state: null,
      after_state: null,
      created_at: "2026-06-21T12:00:00Z",
    };
    const ctx = buildHistoricalIdentityContext({
      archives: [
        {
          user_id: "u-removed",
          email: "jan@firma.sk",
          display_name: "Ján Novák",
          historical_implementer_name: "Ján",
          removed_at: "2026-06-20T10:00:00Z",
          removed_by_user_id: "owner-1",
        },
      ],
      activeImplementerNames: ["Peter"],
    });
    const normalized = normalizeAuditLog(entry, new Map([["u-removed", "jan@firma.sk"]]), ctx);
    expect(normalized.actorName).toContain(HISTORICAL_ROLE_SUFFIX);
  });
});
