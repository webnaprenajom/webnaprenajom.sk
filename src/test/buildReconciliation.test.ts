import { describe, expect, it } from "vitest";
import { buildReconciliation } from "@/lib/finance/buildReconciliation";

const emptyBase = () => ({
  commissions: [] as Parameters<typeof buildReconciliation>[0]["commissions"],
  expenses: [],
  websites: [],
  payments: [],
  paymentRecords: [],
  payoutRecords: [],
  costRecords: [],
  projects: [],
  marketing: [],
  tasks: [],
  hosting: [],
});

describe("buildReconciliation entity gaps", () => {
  it("flags project with agreed_fee but no payment_fact", () => {
    const { issues } = buildReconciliation({
      ...emptyBase(),
      projects: [
        {
          id: "p-1",
          title: "Web klienta",
          client_name: "Klient",
          customer_email: "a@b.sk",
          agreed_fee: 500,
          status: "in_progress",
        },
      ],
    });
    expect(issues.some((i) => i.kind === "entity_missing_payment_fact" && i.sourceId === "p-1")).toBe(
      true,
    );
  });

  it("skips project when legacy_import payment exists (no duplicate entity_missing)", () => {
    const { issues } = buildReconciliation({
      ...emptyBase(),
      projects: [
        {
          id: "p-1",
          title: "Web",
          client_name: "K",
          customer_email: null,
          agreed_fee: 500,
          status: "in_progress",
        },
      ],
      paymentRecords: [
        {
          id: "pay-1",
          source_table: "project_notes",
          source_id: "p-1",
          customer_email: null,
          client_name: "K",
          amount: 500,
          paid_at: "2026-06-01",
          reference: null,
          truth_level: "legacy_import",
          imported_from: null,
        },
      ],
    });
    expect(issues.filter((i) => i.kind === "entity_missing_payment_fact")).toHaveLength(0);
    expect(issues.some((i) => i.kind === "legacy_no_reference")).toBe(true);
  });

  it("flags marketing agreed_fee gap", () => {
    const { issues } = buildReconciliation({
      ...emptyBase(),
      marketing: [
        {
          id: "m-1",
          title: "Kampaň",
          client_name: "K",
          customer_email: null,
          agreed_fee: 200,
          status: "active",
        },
      ],
    });
    expect(
      issues.some(
        (i) =>
          i.kind === "entity_missing_payment_fact" &&
          i.sourceTable === "marketing_records" &&
          i.sourceId === "m-1",
      ),
    ).toBe(true);
  });

  it("flags hosting conservatively (active, monthly, standalone, commissionable)", () => {
    const { issues } = buildReconciliation({
      ...emptyBase(),
      hosting: [
        {
          id: "h-1",
          client_name: "Host klient",
          customer_email: null,
          provider: "Wedos",
          monthly_price: 15,
          yearly_price: null,
          note: null,
          active: true,
          rental_website_id: null,
          commissionable: true,
        },
      ],
    });
    expect(issues.some((i) => i.sourceTable === "hosting_records" && i.sourceId === "h-1")).toBe(
      true,
    );
  });

  it("skips hosting bundled with rental or inactive", () => {
    const bundled = buildReconciliation({
      ...emptyBase(),
      hosting: [
        {
          id: "h-1",
          client_name: "K",
          customer_email: null,
          provider: "X",
          monthly_price: 20,
          yearly_price: null,
          note: null,
          active: true,
          rental_website_id: "rental-1",
          commissionable: true,
        },
      ],
    });
    expect(bundled.issues.filter((i) => i.kind === "entity_missing_payment_fact")).toHaveLength(0);

    const inactive = buildReconciliation({
      ...emptyBase(),
      hosting: [
        {
          id: "h-2",
          client_name: "K",
          customer_email: null,
          provider: "X",
          monthly_price: 20,
          yearly_price: null,
          note: null,
          active: false,
          rental_website_id: null,
          commissionable: true,
        },
      ],
    });
    expect(inactive.issues.filter((i) => i.kind === "entity_missing_payment_fact")).toHaveLength(0);
  });

  it("flags task deposit and full gaps separately (legacy finance only)", () => {
    const { issues } = buildReconciliation({
      ...emptyBase(),
      tasks: [
        {
          id: "t-1",
          title: "Úloha",
          client_name: "K",
          amount: 500,
          deposit: 100,
          status: "paid",
        },
      ],
    });
    expect(issues.some((i) => i.kind === "task_missing_payment_deposit")).toBe(true);
    expect(issues.some((i) => i.kind === "task_missing_payment_full")).toBe(true);
  });

  it("entity_payment_ahead_of_workflow is info-only (early status + payment_fact)", () => {
    const { issues } = buildReconciliation({
      ...emptyBase(),
      tasks: [
        {
          id: "t-1",
          title: "Úloha",
          client_name: "K",
          amount: 300,
          deposit: 0,
          status: "todo",
        },
      ],
      paymentRecords: [
        {
          id: "pay-1",
          source_table: "tasks",
          source_id: "t-1:full",
          customer_email: null,
          client_name: "K",
          amount: 300,
          paid_at: "2026-06-01",
          reference: null,
          truth_level: "payment_fact",
          imported_from: null,
        },
      ],
    });
    const ahead = issues.find((i) => i.kind === "entity_payment_ahead_of_workflow");
    expect(ahead).toBeDefined();
    expect(ahead?.severity).toBe("info");
  });
});

describe("buildReconciliation rental regression", () => {
  it("still flags rental paid month without payment_records", () => {
    const year = 2026;
    const { issues } = buildReconciliation({
      ...emptyBase(),
      websites: [{ id: "w-1", name: "Site", client_name: "K", monthly_price: 30 }],
      payments: [
        {
          id: "rp-1",
          website_id: "w-1",
          year,
          month: 3,
          amount: 30,
          status: "paid",
          custom_price: null,
        },
      ],
      filterYear: year,
    });
    expect(issues.some((i) => i.kind === "workflow_incoming")).toBe(true);
  });

  it("still flags commission paid without payout", () => {
    const { issues } = buildReconciliation({
      ...emptyBase(),
      commissions: [
        {
          id: "c-1",
          title: "Provízia",
          implementer: "Maroš",
          amount: 50,
          payment_status: "paid",
        },
      ],
    });
    expect(issues.some((i) => i.kind === "workflow_outgoing_commission")).toBe(true);
  });
});
