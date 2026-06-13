import { describe, expect, it } from "vitest";
import { buildSummaryFromEvents, parseSummaryBullets } from "@/lib/communication/summaryModel";

describe("rc6 communication summary", () => {
  it("parses bullet arrays from strings or objects", () => {
    expect(parseSummaryBullets(["Do it", { text: "Agreed", id: "x" }])).toEqual([
      { id: "b-0", text: "Do it" },
      { id: "x", text: "Agreed" },
    ]);
  });

  it("builds rolling summary from recent events", () => {
    const summary = buildSummaryFromEvents("cust-1", [
      {
        kind: "email_in",
        title: "Dotaz",
        body_preview: "Potrebujem faktúru",
        occurred_at: "2026-06-01T10:00:00Z",
      },
      {
        kind: "note",
        title: "Interná poznámka",
        body_preview: "Volal klient",
        occurred_at: "2026-06-02T10:00:00Z",
      },
    ]);
    expect(summary.customer_id).toBe("cust-1");
    expect(summary.rolling_summary).toContain("Dotaz");
    expect(summary.next_steps.some((s) => s.text.includes("odpoveď"))).toBe(true);
  });

  it("preserves existing next steps when merging", () => {
    const summary = buildSummaryFromEvents(
      "cust-1",
      [],
      { next_steps: [{ id: "keep", text: "Zavolať v piatok" }] },
    );
    expect(summary.next_steps.some((s) => s.text === "Zavolať v piatok")).toBe(true);
  });
});
