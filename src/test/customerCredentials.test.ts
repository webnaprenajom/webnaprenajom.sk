import { describe, expect, it } from "vitest";
import {
  credentialDisplayLabel,
  credentialHasSecret,
  credentialLabelSelfCheck,
  createEmptyFormItem,
  emptyCredentialFormState,
  filledCredentialItems,
  isCredentialItemBlank,
  legacyCredentialLegacyColumnKey,
  legacyCredentialSourceKey,
  validateCredentialDraft,
  validateCredentialFormItems,
} from "@/lib/customerCredentials";
import {
  buildCustomerCredentialPayload,
  resolveBatchIdForSave,
} from "@/lib/customerCredentialsSave";

describe("customerCredentials", () => {
  it("passes label self-check", () => {
    expect(() => credentialLabelSelfCheck()).not.toThrow();
  });

  it("formats display labels", () => {
    expect(credentialDisplayLabel({ category: "hosting", label: "FTP" })).toBe("Hosting — FTP");
    expect(credentialDisplayLabel({ category: "other", label: "Banka" })).toBe("Banka");
  });

  it("detects secret fields", () => {
    expect(credentialHasSecret({ url: "", login: "a", password: "" })).toBe(true);
    expect(credentialHasSecret({ url: "", login: "", password: "" })).toBe(false);
  });

  it("requires label for every credential", () => {
    expect(validateCredentialDraft({ label: "", login: "a" })).toBe("Zadaj označenie prístupu");
    expect(validateCredentialDraft({ label: "WP admin", login: "a" })).toBeNull();
  });

  it("builds stable legacy backfill keys (idempotent reruns)", () => {
    expect(legacyCredentialSourceKey("pn-1", "cred-9")).toBe("project_notes:pn-1:cred-9");
    expect(legacyCredentialLegacyColumnKey("pn-1")).toBe("project_notes:pn-1:legacy");
  });
});

describe("multi-credential form validation", () => {
  it("detects blank items", () => {
    expect(isCredentialItemBlank(createEmptyFormItem())).toBe(true);
    expect(
      isCredentialItemBlank({ ...createEmptyFormItem(), label: "FTP", login: "", password: "", url: "", note: "" }),
    ).toBe(false);
  });

  it("filters filled items and skips empty blocks", () => {
    const items = [
      { ...createEmptyFormItem(), label: "Admin", login: "a" },
      createEmptyFormItem(),
      { ...createEmptyFormItem(), label: "FTP", password: "x" },
    ];
    expect(filledCredentialItems(items)).toHaveLength(2);
  });

  it("requires at least one filled block", () => {
    expect(validateCredentialFormItems([createEmptyFormItem(), createEmptyFormItem()])).toBe(
      "Pridaj aspoň jeden vyplnený prístup",
    );
  });

  it("validates each filled block label and secret", () => {
    const err = validateCredentialFormItems([
      { ...createEmptyFormItem(), label: "", login: "a" },
    ]);
    expect(err).toContain("Prístup #1");
  });

  it("allows add/remove blocks in form state", () => {
    const form = emptyCredentialFormState();
    expect(form.items).toHaveLength(1);
    const withTwo = { ...form, items: [...form.items, createEmptyFormItem()] };
    expect(withTwo.items).toHaveLength(2);
    const afterRemove = { ...withTwo, items: withTwo.items.slice(0, 1) };
    expect(afterRemove.items).toHaveLength(1);
  });
});

describe("buildCustomerCredentialPayload", () => {
  const linked = {
    customer_id: "cust-1",
    customer_email: "klient@firma.sk",
    client_name: "Klient s.r.o.",
    lead_id: "lead-1",
  };

  const form = {
    linked_entity_type: "project" as const,
    linked_entity_id: "proj-42",
    lead_id: null,
  };

  it("creates payload without project title", () => {
    const payload = buildCustomerCredentialPayload(
      {
        key: "k1",
        category: "wordpress",
        label: "WP admin",
        url: "",
        login: "admin",
        password: "secret",
        note: "",
      },
      form,
      linked,
      "batch-1",
    );
    expect(payload).toMatchObject({
      customer_id: "cust-1",
      label: "WP admin",
      batch_id: "batch-1",
      linked_entity_type: "project",
    });
    expect(payload).not.toHaveProperty("title");
  });

  it("assigns batch_id only for multi-save or existing batch", () => {
    expect(resolveBatchIdForSave(emptyCredentialFormState(), 1)).toBeNull();
    expect(resolveBatchIdForSave(emptyCredentialFormState(), 2)).toBeTruthy();
    expect(resolveBatchIdForSave(emptyCredentialFormState({ batch_id: "b-existing" }), 1)).toBe("b-existing");
  });
});
