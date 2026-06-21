import { describe, expect, it } from "vitest";
import {
  canOfferMarketingPaymentCreate,
  canOfferProjectPaymentCreate,
  canOfferTaskPaymentCreate,
  countConfirmedPayments,
  entityHasLinkedPaymentInRows,
  entityPaymentAddHint,
  hostingPaymentCreateHint,
  marketingPaymentCreateHint,
  projectPaymentCreateHint,
  resolveEntityAgreedPrice,
  sumConfirmedPayments,
  sumConfirmedPaymentsForSource,
  taskPaymentCreateHint,
  taskPaymentSourceId,
} from "@/lib/finance/entityPaymentBridge";
import {
  financeCtxWithPayments,
  prefillFromMarketing,
  prefillFromProject,
  prefillFromTask,
} from "@/lib/finance/factDrafts";

describe("entity payment fact drafts", () => {
  const emptyCtx = financeCtxWithPayments([]);

  it("prefillFromProject uses agreed_fee and project_notes source", () => {
    const draft = prefillFromProject(
      {
        id: "p-1",
        title: "Web klienta",
        client_name: "Firma",
        customer_email: "a@b.sk",
        agreed_fee: 1500,
      },
      emptyCtx,
    );
    expect(draft).toMatchObject({
      kind: "payment",
      amount: "1500",
      source_table: "project_notes",
      source_id: "p-1",
      client_name: "Firma",
    });
  });

  it("prefillFromProject returns null without agreed_fee", () => {
    expect(
      prefillFromProject(
        { id: "p-1", title: "X", client_name: null, customer_email: null, agreed_fee: null },
        emptyCtx,
      ),
    ).toBeNull();
  });

  it("prefillFromProject uses remaining after partial confirmed payment", () => {
    const ctx = financeCtxWithPayments([
      {
        id: "pay-1",
        amount: 400,
        truth_level: "payment_fact",
        source_table: "project_notes",
        source_id: "p-1",
      },
    ]);
    const draft = prefillFromProject(
      {
        id: "p-1",
        title: "Web",
        client_name: "A",
        customer_email: null,
        agreed_fee: 1000,
      },
      ctx,
    );
    expect(draft?.amount).toBe("600");
  });

  it("prefillFromMarketing uses agreed_fee", () => {
    const draft = prefillFromMarketing(
      {
        id: "m-1",
        title: "Google Q2",
        client_name: "Klient",
        customer_email: null,
        agreed_fee: 400,
      },
      emptyCtx,
    );
    expect(draft).toMatchObject({
      source_table: "marketing_records",
      source_id: "m-1",
      amount: "400",
    });
  });

  it("prefillFromTask deposit variant", () => {
    const draft = prefillFromTask(
      { id: "t-1", title: "Logo", client_name: "A", amount: 1000, deposit: 300 },
      "deposit",
      "x@y.sk",
      emptyCtx,
    );
    expect(draft).toMatchObject({
      amount: "300",
      source_table: "tasks",
      source_id: taskPaymentSourceId("t-1", "deposit"),
      note: expect.stringContaining("Záloha"),
    });
  });

  it("prefillFromTask full uses remaining when deposit fact linked", () => {
    const ctx = financeCtxWithPayments([
      {
        id: "pay-1",
        source_table: "tasks",
        source_id: taskPaymentSourceId("t-1", "deposit"),
      },
    ]);
    const draft = prefillFromTask(
      { id: "t-1", title: "Logo", client_name: "A", amount: 1000, deposit: 300 },
      "full",
      null,
      ctx,
    );
    expect(draft).toMatchObject({
      amount: "700",
      source_id: taskPaymentSourceId("t-1", "full"),
      note: expect.stringContaining("Doplatok"),
    });
  });
});

describe("entity payment create hints", () => {
  it("project gated without agreed_fee", () => {
    expect(canOfferProjectPaymentCreate({ agreed_fee: null })).toBe(false);
    expect(projectPaymentCreateHint({ agreed_fee: null })).toMatch(/prehľade/i);
  });

  it("project allows another payment after partial confirmed", () => {
    expect(canOfferProjectPaymentCreate({ agreed_fee: 500 })).toBe(true);
    expect(projectPaymentCreateHint({ agreed_fee: 500 })).toBeNull();
  });

  it("marketing gated without agreed_fee", () => {
    expect(canOfferMarketingPaymentCreate({ agreed_fee: 0 })).toBe(false);
  });

  it("task deposit and full hints", () => {
    expect(taskPaymentCreateHint({ amount: 1000, deposit: 0 }, "deposit", false, false)).toMatch(
      /zálohu/i,
    );
    expect(
      canOfferTaskPaymentCreate({ amount: 1000, deposit: 300 }, "deposit", false, false),
    ).toBe(true);
    expect(
      canOfferTaskPaymentCreate({ amount: 300, deposit: 300 }, "full", false, true),
    ).toBe(false);
  });

  it("entityHasLinkedPaymentInRows", () => {
    const rows = [{ source_table: "tasks", source_id: taskPaymentSourceId("t-1", "deposit") }];
    expect(entityHasLinkedPaymentInRows("tasks", taskPaymentSourceId("t-1", "deposit"), rows)).toBe(
      true,
    );
    expect(entityHasLinkedPaymentInRows("tasks", taskPaymentSourceId("t-1", "full"), rows)).toBe(
      false,
    );
  });
});

describe("confirmed payment totals", () => {
  it("sumConfirmedPayments ignores legacy_import", () => {
    const total = sumConfirmedPayments([
      { amount: 200, truth_level: "payment_fact" },
      { amount: 100, truth_level: "legacy_import" },
    ]);
    expect(total).toBe(200);
    expect(countConfirmedPayments([{ truth_level: "payment_fact" }, { truth_level: "legacy_import" }])).toBe(
      1,
    );
  });

  it("sumConfirmedPaymentsForSource sums only matching source", () => {
    const rows = [
      {
        amount: 300,
        truth_level: "payment_fact",
        source_table: "project_notes",
        source_id: "p-1",
      },
      {
        amount: 200,
        truth_level: "payment_fact",
        source_table: "project_notes",
        source_id: "p-1",
      },
      {
        amount: 999,
        truth_level: "payment_fact",
        source_table: "project_notes",
        source_id: "p-2",
      },
    ];
    expect(sumConfirmedPaymentsForSource(rows, "project_notes", "p-1")).toBe(500);
  });

  it("resolveEntityAgreedPrice prefers agreed_fee over monthly/yearly", () => {
    expect(
      resolveEntityAgreedPrice({ agreed_fee: 500, monthly_price: 20, yearly_price: 200 }),
    ).toBe(500);
    expect(resolveEntityAgreedPrice({ agreed_fee: null, monthly_price: 15, yearly_price: 120 })).toBe(
      15,
    );
    expect(resolveEntityAgreedPrice({ agreed_fee: null, monthly_price: null, yearly_price: 99 })).toBe(
      99,
    );
  });

  it("hostingPaymentCreateHint requires resolvable price", () => {
    expect(hostingPaymentCreateHint({ agreed_fee: null, monthly_price: null, yearly_price: null })).toMatch(
      /prehľade/i,
    );
    expect(hostingPaymentCreateHint({ agreed_fee: 100, monthly_price: null, yearly_price: null })).toBeNull();
  });

  it("entityPaymentAddHint blocks when fully paid", () => {
    expect(entityPaymentAddHint(1000, 1000)).toMatch(/plne uhradená/i);
    expect(entityPaymentAddHint(1000, 400)).toBeNull();
    expect(entityPaymentAddHint(null, 0)).toMatch(/prehľade/i);
  });
});
