import { describe, expect, it } from "vitest";
import {
  FINANCE_DIAGNOSTIKA_TABS,
  financeReconciliationHref,
  financeRecordsHref,
  legacyParamToRecordKind,
  normalizeFinanceLegacyDeepLink,
  resolveFinanceDiagnostikaTab,
} from "@/lib/finance/financeDiagnostikaNav";
import {
  FINANCE_ADVISORY_DIAGNOSTIC_KINDS,
  filterOwnerPrimaryReconciliationIssues,
  isFinanceAdvisoryDiagnosticIssue,
} from "@/lib/finance/issuePresentation";
import type { ReconciliationIssue } from "@/lib/finance/types";

describe("financeDiagnostikaNav", () => {
  it("defaults diagnostika tab to reconciliation", () => {
    expect(resolveFinanceDiagnostikaTab(null)).toBe("reconciliation");
    expect(resolveFinanceDiagnostikaTab("unknown")).toBe("reconciliation");
    expect(resolveFinanceDiagnostikaTab("records")).toBe("records");
    expect(resolveFinanceDiagnostikaTab("settlement")).toBe("settlement");
  });

  it("exposes only batch-A owner tabs", () => {
    expect([...FINANCE_DIAGNOSTIKA_TABS]).toEqual(["reconciliation", "records", "settlement"]);
    expect(FINANCE_DIAGNOSTIKA_TABS).not.toContain("provizie");
    expect(FINANCE_DIAGNOSTIKA_TABS).not.toContain("governance");
  });

  it("maps legacy payments/payouts/costs to records tab", () => {
    expect(legacyParamToRecordKind("payments")).toBe("payment");
    expect(legacyParamToRecordKind("payouts")).toBe("payout");
    expect(legacyParamToRecordKind("costs")).toBe("cost");

    const payments = normalizeFinanceLegacyDeepLink(
      new URLSearchParams("legacy=payments"),
    );
    expect(payments.get("advanced")).toBe("1");
    expect(payments.get("tab")).toBe("records");
    expect(payments.get("recordsKind")).toBe("payment");
    expect(payments.get("legacy")).toBeNull();
  });

  it("strips legacy=commissions back to daily finance", () => {
    const next = normalizeFinanceLegacyDeepLink(
      new URLSearchParams("advanced=1&legacy=commissions"),
    );
    expect(next.get("legacy")).toBeNull();
    expect(next.get("advanced")).toBeNull();
  });

  it("builds reconciliation deep link", () => {
    expect(financeReconciliationHref()).toBe("/admin/finance?advanced=1&tab=reconciliation");
    expect(financeRecordsHref("payout")).toContain("tab=records");
    expect(financeRecordsHref("payout")).toContain("recordsKind=payout");
  });
});

describe("Zladenie presentation tiers", () => {
  const issue = (kind: ReconciliationIssue["kind"]): ReconciliationIssue => ({
    kind,
    title: "t",
    detail: "d",
  });

  it("keeps actionable kinds in owner-primary list", () => {
    const issues = [
      issue("workflow_incoming"),
      issue("legacy_no_reference"),
      issue("potential_duplicate"),
      issue("missing_counterparty"),
    ];
    const primary = filterOwnerPrimaryReconciliationIssues(issues);
    expect(primary.map((i) => i.kind)).toEqual(["workflow_incoming", "legacy_no_reference"]);
  });

  it("classifies advisory diagnostic kinds for collapsed section", () => {
    for (const kind of FINANCE_ADVISORY_DIAGNOSTIC_KINDS) {
      expect(isFinanceAdvisoryDiagnosticIssue(issue(kind))).toBe(true);
    }
    expect(isFinanceAdvisoryDiagnosticIssue(issue("workflow_incoming"))).toBe(false);
  });
});
