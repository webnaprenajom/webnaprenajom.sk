import { describe, expect, it } from "vitest";
import {
  canOfferMarketingPaymentCreate,
  canOfferProjectPaymentCreate,
  canOfferTaskPaymentCreate,
  entityHasLinkedPaymentInRows,
  marketingPaymentCreateHint,
  projectPaymentCreateHint,
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

  it("prefillFromTask blocks duplicate source", () => {
    const ctx = financeCtxWithPayments([
      { id: "pay-1", source_table: "project_notes", source_id: "p-1" },
    ]);
    expect(
      prefillFromProject(
        { id: "p-1", title: "X", client_name: null, customer_email: null, agreed_fee: 100 },
        ctx,
      ),
    ).toBeNull();
  });
});

describe("entity payment create hints", () => {
  it("project gated without agreed_fee", () => {
    expect(canOfferProjectPaymentCreate({ agreed_fee: null }, false)).toBe(false);
    expect(projectPaymentCreateHint({ agreed_fee: null }, false)).toMatch(/prehľade/i);
  });

  it("project blocks duplicate linked payment", () => {
    expect(canOfferProjectPaymentCreate({ agreed_fee: 500 }, true)).toBe(false);
    expect(projectPaymentCreateHint({ agreed_fee: 500 }, true)).toMatch(/už existuje/i);
  });

  it("marketing gated without agreed_fee", () => {
    expect(canOfferMarketingPaymentCreate({ agreed_fee: 0 }, false)).toBe(false);
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
