import { describe, expect, it } from "vitest";
import {
  COMMISSION_SOURCE_LABELS,
  commissionMatchesSource,
  getCommissionLinkStatus,
  isCommissionLinked,
  resolveCommissionSourceLabel,
  sanitizeCommissionSourceFields,
  sourceDetailHref,
  validateCommissionSourceFields,
  type CommissionRow,
} from "@/lib/commissionSource";

describe("commissionSource — marketing & task", () => {
  it("exposes labels for new entity source types", () => {
    expect(COMMISSION_SOURCE_LABELS.marketing).toBe("Marketing");
    expect(COMMISSION_SOURCE_LABELS.task).toBe("Úloha");
  });

  it("builds detail hrefs for marketing and task", () => {
    expect(sourceDetailHref("marketing", "m-1")).toBe("/admin/marketing/m-1");
    expect(sourceDetailHref("task", "t-1")).toBe("/admin/tasks/t-1");
    expect(sourceDetailHref("other", "x")).toBeNull();
  });

  it("treats marketing/task with id as linked", () => {
    expect(getCommissionLinkStatus({ source_type: "marketing", source_id: "m-1" })).toBe("linked");
    expect(getCommissionLinkStatus({ source_type: "task", source_id: "t-1" })).toBe("linked");
    expect(isCommissionLinked({ source_type: "task", source_id: "t-1" })).toBe(true);
  });

  it("sanitizes marketing/task source pairs", () => {
    expect(sanitizeCommissionSourceFields("marketing", "m-1")).toEqual({
      source_type: "marketing",
      source_id: "m-1",
    });
    expect(sanitizeCommissionSourceFields("task", "t-1")).toEqual({
      source_type: "task",
      source_id: "t-1",
    });
    expect(sanitizeCommissionSourceFields("marketing", "")).toEqual({
      source_type: null,
      source_id: null,
    });
  });

  it("validates entity id requirement for marketing/task", () => {
    expect(validateCommissionSourceFields("marketing", "").valid).toBe(false);
    expect(validateCommissionSourceFields("task", "t-1").valid).toBe(true);
  });

  it("matches and resolves labels with optional context maps", () => {
    const row: CommissionRow = {
      id: "c-1",
      title: "Fallback title",
      implementer: "Peter",
      amount: 50,
      payment_status: "unpaid",
      note: null,
      date: "2026-06-01",
      source_type: "marketing",
      source_id: "m-1",
    };
    expect(commissionMatchesSource(row, "marketing", "m-1")).toBe(true);
    expect(
      resolveCommissionSourceLabel(row, {
        marketing: new Map([["m-1", { title: "Kampaň Google" }]]),
      }),
    ).toBe("Kampaň Google");
    expect(resolveCommissionSourceLabel(row)).toBe("Marketing · Fallback title");
  });
});
