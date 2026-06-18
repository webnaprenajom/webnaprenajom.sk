import { describe, expect, it } from "vitest";
import {
  assertDeliveryHasCanonicalCustomer,
  DELIVERY_CUSTOMER_AMBIGUOUS_MSG,
  DELIVERY_CUSTOMER_REQUIRED_MSG,
} from "@/lib/crmLookup/entitySaveHelpers";

const CANONICAL_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("assertDeliveryHasCanonicalCustomer", () => {
  it("accepts canonical customer_id", () => {
    expect(assertDeliveryHasCanonicalCustomer({ customer_id: CANONICAL_ID })).toEqual({ ok: true });
  });

  it("accepts valid customer_email without customer_id", () => {
    expect(
      assertDeliveryHasCanonicalCustomer({
        customer_email: "Klient@Firma.sk",
      }),
    ).toEqual({ ok: true });
  });

  it("rejects missing id and email (client_name-only save simulated)", () => {
    expect(assertDeliveryHasCanonicalCustomer({})).toEqual({
      ok: false,
      message: DELIVERY_CUSTOMER_REQUIRED_MSG,
    });
  });

  it("rejects null id and null email", () => {
    expect(
      assertDeliveryHasCanonicalCustomer({
        customer_id: null,
        customer_email: null,
      }),
    ).toEqual({
      ok: false,
      message: DELIVERY_CUSTOMER_REQUIRED_MSG,
    });
  });

  it("rejects invalid email without customer_id", () => {
    expect(
      assertDeliveryHasCanonicalCustomer({
        customer_email: "not-an-email",
      }),
    ).toEqual({
      ok: false,
      message: DELIVERY_CUSTOMER_REQUIRED_MSG,
    });
  });

  it("rejects blocked/ambiguous warnings when customer_id is missing", () => {
    expect(
      assertDeliveryHasCanonicalCustomer({
        customer_email: "client@firma.sk",
        warnings: ["Nejednoznačné meno — vyberte klienta manuálne."],
      }),
    ).toEqual({
      ok: false,
      message: DELIVERY_CUSTOMER_AMBIGUOUS_MSG,
    });
  });

  it("accepts canonical customer_id even when warnings are present", () => {
    expect(
      assertDeliveryHasCanonicalCustomer({
        customer_id: CANONICAL_ID,
        warnings: ["Nejednoznačné meno — vyberte klienta manuálne."],
      }),
    ).toEqual({ ok: true });
  });

  it("accepts valid email with non-blocking warnings", () => {
    expect(
      assertDeliveryHasCanonicalCustomer({
        customer_email: "client@firma.sk",
        warnings: ["Lead sa nepodarilo načítať — uloží sa bez lead prepojenia."],
      }),
    ).toEqual({ ok: true });
  });

  it("rejects valid email when warnings indicate blocked create", () => {
    expect(
      assertDeliveryHasCanonicalCustomer({
        customer_email: "client@firma.sk",
        warnings: ["blocked_ambiguous: duplicate name match"],
      }),
    ).toEqual({
      ok: false,
      message: DELIVERY_CUSTOMER_AMBIGUOUS_MSG,
    });
  });
});
