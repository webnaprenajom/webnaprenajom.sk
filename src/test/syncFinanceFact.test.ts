import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RENTAL_CREDITS_SYNC_IMPORTED_FROM,
  RENTAL_PAYMENT_SYNC_IMPORTED_FROM,
  buildCostFactPayloadFromRentalCredits,
  buildPaymentFactPayloadFromRentalPayment,
  classifyLinkedCostFactReverse,
  classifyLinkedPaymentFactReverse,
  reverseCostFactForSource,
  reversePaymentFactForSource,
  syncRentalCreditsToFinance,
  syncRentalPaymentToFinance,
  upsertCostFactForSource,
  upsertPaymentFactForSource,
} from "@/lib/finance/syncFinanceFact";

const maybeSingle = vi.fn();
const eqSecond = vi.fn(() => ({ maybeSingle }));
const eqFirst = vi.fn(() => ({ eq: eqSecond }));
const select = vi.fn(() => ({ eq: eqFirst }));
const updateEq = vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle })) }));
const update = vi.fn(() => ({ eq: updateEq }));
const insertSelectMaybeSingle = vi.fn();
const insertSelect = vi.fn(() => ({ maybeSingle: insertSelectMaybeSingle }));
const insert = vi.fn(() => ({ select: insertSelect }));
const deleteEq = vi.fn(async () => deleteResult);
let deleteResult: { error: { message: string } | null } = { error: null };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select,
      update,
      insert,
      delete: vi.fn(() => ({ eq: deleteEq })),
    })),
  },
}));

const payment = {
  id: "pay-1",
  website_id: "site-1",
  year: 2026,
  month: 3,
  amount: 120,
  paid_at: "2026-03-15T10:00:00.000Z",
};

const website = {
  id: "site-1",
  name: "acme.sk",
  client_name: "ACME s.r.o.",
  customer_email: "acme@firma.sk",
};

describe("buildPaymentFactPayloadFromRentalPayment", () => {
  it("maps rental payment to payment_records insert payload", () => {
    const payload = buildPaymentFactPayloadFromRentalPayment(payment, website);
    expect(payload).toEqual({
      source_table: "rental_payments",
      source_id: "pay-1",
      rental_website_id: "site-1",
      amount: 120,
      paid_at: "2026-03-15T10:00:00.000Z",
      client_name: "ACME s.r.o.",
      customer_email: "acme@firma.sk",
      currency: "EUR",
      truth_level: "payment_fact",
      imported_from: RENTAL_PAYMENT_SYNC_IMPORTED_FROM,
      note: "Prenájom acme.sk · 3/2026",
      method: null,
      reference: null,
    });
  });

  it("returns null for zero or missing amount", () => {
    expect(buildPaymentFactPayloadFromRentalPayment({ ...payment, amount: 0 }, website)).toBeNull();
    expect(buildPaymentFactPayloadFromRentalPayment({ ...payment, amount: -5 }, website)).toBeNull();
  });
});

describe("classifyLinkedPaymentFactReverse", () => {
  it("deletes linked payment_fact rows", () => {
    expect(classifyLinkedPaymentFactReverse({ truth_level: "payment_fact" })).toBe("delete");
  });

  it("skips linked legacy_import rows", () => {
    expect(classifyLinkedPaymentFactReverse({ truth_level: "legacy_import" })).toBe("skip_legacy");
  });

  it("noops when no linked row exists", () => {
    expect(classifyLinkedPaymentFactReverse(null)).toBe("noop");
    expect(classifyLinkedPaymentFactReverse(undefined)).toBe("noop");
  });
});

describe("upsertPaymentFactForSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteResult = { error: null };
    maybeSingle.mockReset();
    insertSelectMaybeSingle.mockReset();
  });

  const basePayload = {
    source_table: "rental_payments",
    source_id: "pay-1",
    rental_website_id: "site-1",
    amount: 120,
    paid_at: "2026-03-15T10:00:00.000Z",
    truth_level: "payment_fact" as const,
    imported_from: RENTAL_PAYMENT_SYNC_IMPORTED_FROM,
  };

  it("updates when linked row already exists", async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: { id: "fact-1", truth_level: "payment_fact" }, error: null })
      .mockResolvedValueOnce({ data: { id: "fact-1" }, error: null });

    const result = await upsertPaymentFactForSource(basePayload);

    expect(result).toEqual({ ok: true, action: "updated", recordId: "fact-1" });
    expect(update).toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts when no linked row exists", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    insertSelectMaybeSingle.mockResolvedValueOnce({ data: { id: "fact-new" }, error: null });

    const result = await upsertPaymentFactForSource(basePayload);

    expect(result).toEqual({ ok: true, action: "inserted", recordId: "fact-new" });
    expect(insert).toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("promotes legacy_import via update without delete", async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: { id: "legacy-1", truth_level: "legacy_import" }, error: null })
      .mockResolvedValueOnce({ data: { id: "legacy-1" }, error: null });

    const result = await upsertPaymentFactForSource(basePayload);

    expect(result).toEqual({ ok: true, action: "updated", recordId: "legacy-1" });
    expect(update).toHaveBeenCalled();
    expect(deleteEq).not.toHaveBeenCalled();
  });
});

describe("reversePaymentFactForSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteResult = { error: null };
    maybeSingle.mockReset();
  });

  it("deletes linked payment_fact", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: "fact-1", truth_level: "payment_fact" }, error: null });

    const result = await reversePaymentFactForSource({
      source_table: "rental_payments",
      source_id: "pay-1",
    });

    expect(result).toEqual({ ok: true, action: "deleted" });
    expect(deleteEq).toHaveBeenCalled();
  });

  it("skips linked legacy_import", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: "legacy-1", truth_level: "legacy_import" }, error: null });

    const result = await reversePaymentFactForSource({
      source_table: "rental_payments",
      source_id: "pay-1",
    });

    expect(result).toEqual({ ok: true, action: "skipped_legacy_import" });
    expect(deleteEq).not.toHaveBeenCalled();
  });

  it("noops when linked row is missing", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await reversePaymentFactForSource({
      source_table: "rental_payments",
      source_id: "pay-1",
    });

    expect(result).toEqual({ ok: true, action: "skipped_no_link" });
    expect(deleteEq).not.toHaveBeenCalled();
  });
});

describe("syncRentalPaymentToFinance price refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockReset();
  });

  it("updates linked payment_fact when paid month amount changes", async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: { id: "fact-1", truth_level: "payment_fact" }, error: null })
      .mockResolvedValueOnce({ data: { id: "fact-1" }, error: null });

    const result = await syncRentalPaymentToFinance(
      { ...payment, status: "paid", amount: 175 },
      website,
    );

    expect(result).toEqual({ ok: true, action: "updated", recordId: "fact-1" });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 175, truth_level: "payment_fact" }),
    );
  });
});

const creditsCtx = {
  websiteId: "site-1",
  websiteName: "acme.sk",
  clientName: "ACME s.r.o.",
  year: 2026,
  creditsUsed: 100,
};

describe("buildCostFactPayloadFromRentalCredits", () => {
  it("maps rental credits to cost_records insert payload", () => {
    const payload = buildCostFactPayloadFromRentalCredits(creditsCtx);
    expect(payload).toEqual({
      source_table: "rental_credits",
      source_id: "site-1:2026",
      rental_website_id: "site-1",
      amount: 30,
      currency: "EUR",
      truth_level: "cost_fact",
      imported_from: RENTAL_CREDITS_SYNC_IMPORTED_FROM,
      note: "Kredity AI · acme.sk · 2026",
      category: "AI kredity",
      client_name: "ACME s.r.o.",
      incurred_at: "2026-12-31T00:00:00.000Z",
      paid_at: "2026-12-31T00:00:00.000Z",
      vendor: null,
      reference: null,
    });
  });

  it("returns null for zero or missing credits", () => {
    expect(buildCostFactPayloadFromRentalCredits({ ...creditsCtx, creditsUsed: 0 })).toBeNull();
    expect(buildCostFactPayloadFromRentalCredits({ ...creditsCtx, creditsUsed: -5 })).toBeNull();
  });
});

describe("classifyLinkedCostFactReverse", () => {
  it("deletes linked cost_fact rows", () => {
    expect(classifyLinkedCostFactReverse({ truth_level: "cost_fact" })).toBe("delete");
  });

  it("skips linked legacy_import rows", () => {
    expect(classifyLinkedCostFactReverse({ truth_level: "legacy_import" })).toBe("skip_legacy");
  });

  it("noops when no linked row exists", () => {
    expect(classifyLinkedCostFactReverse(null)).toBe("noop");
    expect(classifyLinkedCostFactReverse(undefined)).toBe("noop");
  });
});

describe("upsertCostFactForSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteResult = { error: null };
    maybeSingle.mockReset();
    insertSelectMaybeSingle.mockReset();
  });

  const baseCostPayload = {
    source_table: "rental_credits",
    source_id: "site-1:2026",
    rental_website_id: "site-1",
    amount: 30,
    incurred_at: "2026-12-31T00:00:00.000Z",
    paid_at: "2026-12-31T00:00:00.000Z",
    truth_level: "cost_fact" as const,
    imported_from: RENTAL_CREDITS_SYNC_IMPORTED_FROM,
  };

  it("updates when linked row already exists", async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: { id: "cost-1", truth_level: "cost_fact" }, error: null })
      .mockResolvedValueOnce({ data: { id: "cost-1" }, error: null });

    const result = await upsertCostFactForSource(baseCostPayload);

    expect(result).toEqual({ ok: true, action: "updated", recordId: "cost-1" });
    expect(update).toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts when no linked row exists", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    insertSelectMaybeSingle.mockResolvedValueOnce({ data: { id: "cost-new" }, error: null });

    const result = await upsertCostFactForSource(baseCostPayload);

    expect(result).toEqual({ ok: true, action: "inserted", recordId: "cost-new" });
    expect(insert).toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("reverseCostFactForSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteResult = { error: null };
    maybeSingle.mockReset();
  });

  it("deletes linked cost_fact", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: "cost-1", truth_level: "cost_fact" }, error: null });

    const result = await reverseCostFactForSource({
      source_table: "rental_credits",
      source_id: "site-1:2026",
    });

    expect(result).toEqual({ ok: true, action: "deleted" });
    expect(deleteEq).toHaveBeenCalled();
  });

  it("skips linked legacy_import", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: "legacy-1", truth_level: "legacy_import" }, error: null });

    const result = await reverseCostFactForSource({
      source_table: "rental_credits",
      source_id: "site-1:2026",
    });

    expect(result).toEqual({ ok: true, action: "skipped_legacy_import" });
    expect(deleteEq).not.toHaveBeenCalled();
  });

  it("noops when linked row is missing", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await reverseCostFactForSource({
      source_table: "rental_credits",
      source_id: "site-1:2026",
    });

    expect(result).toEqual({ ok: true, action: "skipped_no_link" });
    expect(deleteEq).not.toHaveBeenCalled();
  });
});

describe("syncRentalCreditsToFinance amount refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockReset();
  });

  it("updates linked cost_fact when credits amount changes", async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: { id: "cost-1", truth_level: "cost_fact" }, error: null })
      .mockResolvedValueOnce({ data: { id: "cost-1" }, error: null });

    const result = await syncRentalCreditsToFinance(website, 2026, 200);

    expect(result).toEqual({ ok: true, action: "updated", recordId: "cost-1" });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ amount: 60, truth_level: "cost_fact" }));
  });
});
