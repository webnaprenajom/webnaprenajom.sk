import { beforeEach, describe, expect, it, vi } from "vitest";

const { maybeSingle, insertSelect, insert, updateEq, update, deleteIn, from } = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const insertSelect = vi.fn(() => ({ maybeSingle }));
  const insert = vi.fn(() => ({ select: insertSelect }));
  const updateEq = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ eq: updateEq }));
  const deleteIn = vi.fn(async () => ({ error: null }));
  const from = vi.fn(() => ({ insert, update, delete: vi.fn(() => ({ in: deleteIn })) }));
  return { maybeSingle, insertSelect, insert, updateEq, update, deleteIn, from };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from },
}));

vi.mock("@/lib/crmLookup/resolveFormCustomerLink", () => ({
  resolveFormCustomerLink: vi.fn(async () => ({
    customer_id: "cust-1",
    customer_email: "klient@firma.sk",
    client_name: "Klient s.r.o.",
    lead_id: null,
    warnings: [],
  })),
}));

import { saveCustomerCredential, saveCustomerCredentialBatch } from "@/lib/customerCredentialsSave";
import { createEmptyFormItem, emptyCredentialFormState } from "@/lib/customerCredentials";

describe("saveCustomerCredential (single)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockResolvedValue({ data: { id: "cred-new" }, error: null });
    insertSelect.mockReturnValue({ maybeSingle });
  });

  it("inserts into customer_credentials only — never project_notes", async () => {
    const result = await saveCustomerCredential({
      customer_id: "cust-1",
      customer_email: "klient@firma.sk",
      client_name: "Klient s.r.o.",
      category: "web_admin",
      label: "Admin účet",
      login: "admin",
      password: "heslo",
    });

    expect(result).toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("customer_credentials");
    expect(from).not.toHaveBeenCalledWith("project_notes");
  });

  it("rejects save without label before hitting database", async () => {
    const result = await saveCustomerCredential({
      customer_id: "cust-1",
      customer_email: "klient@firma.sk",
      category: "wordpress",
      label: "",
      login: "admin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("označenie");
    expect(from).not.toHaveBeenCalled();
  });
});

describe("saveCustomerCredentialBatch (multi)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockResolvedValue({ data: { id: "cred-new" }, error: null });
    insertSelect.mockReturnValue({ maybeSingle });
  });

  it("batch-inserts multiple rows in one save", async () => {
    const form = emptyCredentialFormState({
      customer_id: "cust-1",
      customer_email: "klient@firma.sk",
      client_name: "Klient s.r.o.",
      items: [
        { ...createEmptyFormItem(), label: "WP admin", login: "a", password: "1" },
        { ...createEmptyFormItem("hosting"), label: "FTP", login: "b", password: "2" },
        createEmptyFormItem(),
      ],
    });

    const result = await saveCustomerCredentialBatch(form);
    expect(result).toEqual({ ok: true, savedCount: 2 });
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[0][0]).toMatchObject({ label: "WP admin", batch_id: expect.any(String) });
    expect(insert.mock.calls[1][0]).toMatchObject({ label: "FTP", batch_id: insert.mock.calls[0][0].batch_id });
    expect(from).not.toHaveBeenCalledWith("project_notes");
  });

  it("updates existing rows and deletes removed db ids", async () => {
    const form = emptyCredentialFormState({
      customer_id: "cust-1",
      customer_email: "klient@firma.sk",
      batch_id: "batch-99",
      items: [
        { ...createEmptyFormItem(), key: "k1", dbId: "db-1", label: "Admin", login: "a", password: "p" },
      ],
    });

    const result = await saveCustomerCredentialBatch(form, ["db-2"]);
    expect(result.ok).toBe(true);
    expect(deleteIn).toHaveBeenCalledWith("id", ["db-2"]);
    expect(update).toHaveBeenCalled();
    expect(updateEq).toHaveBeenCalledWith("id", "db-1");
  });

  it("rejects when all blocks are empty", async () => {
    const result = await saveCustomerCredentialBatch(
      emptyCredentialFormState({
        customer_id: "cust-1",
        customer_email: "klient@firma.sk",
        items: [createEmptyFormItem(), createEmptyFormItem()],
      }),
    );
    expect(result.ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
});
