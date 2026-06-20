import { describe, expect, it } from "vitest";
import {
  isLeadLogsPermissionError,
  leadLogsEmptyMessage,
  leadLogsScopeDescription,
  resolveLeadLogsLoadState,
} from "@/lib/leads/leadLogsPresentation";

describe("leadLogsPresentation", () => {
  it("detects RLS permission errors", () => {
    expect(isLeadLogsPermissionError("permission denied for table lead_logs")).toBe(true);
    expect(isLeadLogsPermissionError("network timeout")).toBe(false);
  });

  it("resolves load states", () => {
    expect(resolveLeadLogsLoadState({ loading: true, error: null, rowCount: 0, role: "owner" })).toBe(
      "loading",
    );
    expect(resolveLeadLogsLoadState({ loading: false, error: null, rowCount: 3, role: "owner" })).toBe(
      "ok",
    );
    expect(
      resolveLeadLogsLoadState({ loading: false, error: null, rowCount: 0, role: "administrator" }),
    ).toBe("empty");
  });

  it("scopes help text by role", () => {
    expect(leadLogsScopeDescription("owner")).toContain("lead_logs");
    expect(leadLogsScopeDescription("owner")).not.toContain("všetky zmeny");
    expect(leadLogsScopeDescription("administrator")).toContain("priradené");
  });

  it("empty message differs for administrator", () => {
    expect(leadLogsEmptyMessage("administrator", false)).toContain("priradené");
    expect(leadLogsEmptyMessage("owner", false)).toContain("žiadne záznamy");
  });
});
