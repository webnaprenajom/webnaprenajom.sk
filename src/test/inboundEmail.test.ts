import { describe, it, expect } from "vitest";
import {
  parseEmailAddress,
  normalizeMessageId,
  deriveThreadId,
  buildInboundPreview,
  stripHtmlToText,
  inboundThreadHint,
  inboundAddressDetail,
} from "@/lib/communication/inbound";
import { communicationEventToTimeline } from "@/lib/communication/events";
import type { CommunicationEventRow } from "@/lib/communication/types";

describe("inbound email helpers", () => {
  it("parses angle-bracket addresses", () => {
    expect(parseEmailAddress("Acme <Client@Example.com>")).toBe("client@example.com");
    expect(parseEmailAddress("plain@test.sk")).toBe("plain@test.sk");
  });

  it("normalizes message ids", () => {
    expect(normalizeMessageId("<abc@mail.com>")).toBe("abc@mail.com");
  });

  it("derives thread from in-reply-to first", () => {
    expect(deriveThreadId("<parent@x.com>", "<child@x.com>")).toBe("parent@x.com");
    expect(deriveThreadId(null, "<root@x.com>")).toBe("root@x.com");
  });

  it("builds preview from html", () => {
    expect(buildInboundPreview(null, "<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("stripHtmlToText removes tags", () => {
    expect(stripHtmlToText("<div>Test</div>")).toBe("Test");
  });
});

describe("inbound timeline mapping", () => {
  const row: CommunicationEventRow = {
    id: "in-1",
    customer_id: "c1",
    customer_email: "client@test.sk",
    sender_email: "client@test.sk",
    recipient_email: "info@webnaprenajom.sk",
    kind: "email_in",
    title: "Re: Ponuka",
    body_preview: "Áno, mám záujem",
    message_id: "msg-1",
    in_reply_to: "parent-msg",
    thread_id: "parent-msg",
    metadata: { provider_email_id: "resend-uuid", attachment_count: 1 },
    source_table: "leads",
    source_id: "lead-1",
    occurred_at: "2026-06-01T10:00:00Z",
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-06-01T10:00:00Z",
  };

  it("shows address and thread hints", () => {
    expect(inboundAddressDetail(row)).toContain("Od: client@test.sk");
    expect(inboundThreadHint(row)).toBe("Odpoveď vo vlákne");
  });

  it("maps to communication timeline category", () => {
    const event = communicationEventToTimeline(row);
    expect(event.category).toBe("communication");
    expect(event.label).toBe("Re: Ponuka");
    expect(event.meta?.communication_kind).toBe("email_in");
    expect(event.meta?.link_status).toBe("linked");
    expect(event.meta?.is_threaded).toBe(true);
    expect(event.detail).toContain("Od: client@test.sk");
    expect(event.detail).toContain("Odpoveď vo vlákne");
  });
});
