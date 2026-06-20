import { describe, expect, it } from "vitest";
import {
  PROJECT_LIST_SELECT,
  buildProjectNoteDeliveryPayload,
} from "@/components/admin/projectNotes/shared";

describe("buildProjectNoteDeliveryPayload", () => {
  it("omits legacy credential columns from project_notes writes", () => {
    const payload = buildProjectNoteDeliveryPayload(
      {
        title: " Nový web ",
        project_type: "wordpress",
        url: "https://example.sk",
        notes: "Poznámka",
        status: "in_progress",
        lead_id: "lead-1",
      },
      {
        client_name: "Firma s.r.o.",
        customer_email: "info@firma.sk",
        customer_id: "cust-1",
        lead_id: "lead-1",
      },
    );

    expect(payload).toEqual({
      title: "Nový web",
      client_name: "Firma s.r.o.",
      customer_email: "info@firma.sk",
      customer_id: "cust-1",
      lead_id: "lead-1",
      project_type: "wordpress",
      url: "https://example.sk",
      notes: "Poznámka",
      status: "in_progress",
    });
    expect(Object.keys(payload)).not.toContain("username");
    expect(Object.keys(payload)).not.toContain("password");
    expect(Object.keys(payload)).not.toContain("access_credentials");
  });
});

describe("PROJECT_LIST_SELECT", () => {
  it("excludes legacy credential columns from list load", () => {
    const cols = PROJECT_LIST_SELECT.split(",").map((c) => c.trim());
    expect(cols).not.toContain("username");
    expect(cols).not.toContain("password");
    expect(cols).not.toContain("access_credentials");
    expect(cols).toContain("title");
    expect(cols).toContain("agreed_fee");
  });
});
