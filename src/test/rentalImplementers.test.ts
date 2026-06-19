import { describe, expect, it } from "vitest";
import {
  normalizeRentalImplementerPaymentStatus,
  normalizeRentalImplementers,
  serializeRentalImplementerForSave,
} from "@/lib/rentalImplementers";

describe("rentalImplementers", () => {
  it("defaults missing payment_status to unpaid", () => {
    const rows = normalizeRentalImplementers([{ name: "Peter", percentage: 30 }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].payment_status).toBe("unpaid");
  });

  it("preserves paid payment_status", () => {
    expect(normalizeRentalImplementerPaymentStatus("paid")).toBe("paid");
    expect(normalizeRentalImplementerPaymentStatus("unpaid")).toBe("unpaid");
    expect(normalizeRentalImplementerPaymentStatus(undefined)).toBe("unpaid");
  });

  it("serializes payment_status into JSON payload", () => {
    const payload = serializeRentalImplementerForSave({
      name: "Peter",
      percentage: 25,
      payment_status: "paid",
      payment_form: "",
      note: "",
    });
    expect(payload.payment_status).toBe("paid");
    expect(payload.name).toBe("Peter");
  });
});
