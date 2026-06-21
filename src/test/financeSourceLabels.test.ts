import { describe, expect, it } from "vitest";
import { buildFinanceSnapshot } from "@/lib/finance/buildFinanceSnapshot";
import {
  aggregateConfirmedEntityPayments,
  financeSourceTableLabel,
  formatReconciliationSourceHint,
  resolveFinanceOriginKind,
  resolvePaymentRecordOrigin,
  resolveTaskPaymentSublabel,
} from "@/lib/finance/financeSourceLabels";

describe("financeSourceLabels", () => {
  it("maps source_table to user labels", () => {
    expect(financeSourceTableLabel("hosting_records")).toBe("Hosting");
    expect(financeSourceTableLabel("project_notes")).toBe("Projekty");
    expect(financeSourceTableLabel("tasks")).toBe("Úlohy");
    expect(financeSourceTableLabel("marketing_records")).toBe("Marketing");
  });

  it("parses task composite source_id sublabels", () => {
    expect(resolveTaskPaymentSublabel("uuid-1:deposit")).toBe("Záloha");
    expect(resolveTaskPaymentSublabel("uuid-1:full")).toBe("Doplatok / úhrada");
    expect(resolveTaskPaymentSublabel("uuid-1")).toBeNull();
  });

  it("resolvePaymentRecordOrigin for task deposit", () => {
    const view = resolvePaymentRecordOrigin({
      source_table: "tasks",
      source_id: "t-1:deposit",
    });
    expect(view.entityKind).toBe("task");
    expect(view.detail).toContain("Úlohy");
    expect(view.detail).toContain("Záloha");
  });

  it("aggregateConfirmedEntityPayments counts only payment_fact", () => {
    const totals = aggregateConfirmedEntityPayments([
      { source_table: "hosting_records", source_id: "h1", amount: 50, truth_level: "payment_fact" },
      { source_table: "project_notes", source_id: "p1", amount: 200, truth_level: "payment_fact" },
      { source_table: "tasks", source_id: "t1:deposit", amount: 100, truth_level: "payment_fact" },
      { source_table: "marketing_records", source_id: "m1", amount: 80, truth_level: "payment_fact" },
      { source_table: "rental_payments", source_id: "r1", amount: 30, truth_level: "payment_fact" },
      { source_table: "project_notes", source_id: "p2", amount: 999, truth_level: "legacy_import" },
    ]);
    expect(totals.hosting).toMatchObject({ amount: 50, count: 1 });
    expect(totals.project).toMatchObject({ amount: 200, count: 1 });
    expect(totals.task).toMatchObject({ amount: 100, count: 1 });
    expect(totals.marketing).toMatchObject({ amount: 80, count: 1 });
    expect(totals.rental).toMatchObject({ amount: 30, count: 1 });
  });

  it("formatReconciliationSourceHint for task variants", () => {
    expect(formatReconciliationSourceHint("tasks", "id:deposit")).toBe("Úlohy · Záloha");
    expect(formatReconciliationSourceHint("project_notes", "id")).toBe("Projekty");
  });

  it("resolveFinanceOriginKind", () => {
    expect(resolveFinanceOriginKind("marketing_records")).toBe("marketing");
    expect(resolveFinanceOriginKind(null)).toBe("unlinked");
  });
});

describe("buildFinanceSnapshot entity payments", () => {
  it("exposes entityPaymentsConfirmed on totals", () => {
    const snap = buildFinanceSnapshot({
      commissions: [],
      expenses: [],
      websites: [],
      payments: [],
      projects: [
        {
          id: "p-1",
          title: "Projekt",
          client_name: "Klient",
          customer_email: null,
          agreed_fee: 500,
          status: "active",
        },
      ],
      paymentRecords: [
        {
          id: "pay-1",
          source_table: "project_notes",
          source_id: "p-1",
          customer_email: null,
          client_name: "Klient",
          rental_website_id: null,
          amount: 500,
          currency: "EUR",
          paid_at: "2026-06-01T12:00:00Z",
          method: null,
          reference: null,
          note: null,
          truth_level: "payment_fact",
          imported_from: null,
        },
      ],
    });
    expect(snap.totals.entityPaymentsConfirmed.project).toMatchObject({
      amount: 500,
      count: 1,
    });
    const ledger = snap.rows.find((r) => r.id === "payment-record-pay-1");
    expect(ledger?.linkedOriginLabel).toBe("Projekty");
    expect(ledger?.title).toContain("Projekty");
  });

  it("excludes orphan entity payments when parent deal missing", () => {
    const snap = buildFinanceSnapshot({
      commissions: [],
      expenses: [],
      websites: [],
      payments: [],
      projects: [],
      paymentRecords: [
        {
          id: "pay-orphan",
          source_table: "project_notes",
          source_id: "p-deleted",
          customer_email: null,
          client_name: "Klient",
          rental_website_id: null,
          amount: 500,
          currency: "EUR",
          paid_at: "2026-06-01T12:00:00Z",
          method: null,
          reference: null,
          note: null,
          truth_level: "payment_fact",
          imported_from: null,
        },
      ],
    });
    expect(snap.totals.paymentsConfirmed).toBe(0);
    expect(snap.totals.entityPaymentsConfirmed.project.amount).toBe(0);
  });
});
