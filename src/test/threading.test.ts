import { describe, it, expect } from "vitest";
import {
  normalizeEmailSubject,
  normalizeMessageId,
  parseReferencesHeader,
  subjectThreadKey,
  buildOutboundThreadId,
  threadLookupCandidates,
  communicationThreadLabel,
  THREAD_RESOLUTION_ORDER,
} from "@/lib/communication/threading";
import type { CommunicationEventRow } from "@/lib/communication/types";

const baseRow = (overrides: Partial<CommunicationEventRow>): CommunicationEventRow => ({
  id: "1",
  customer_id: "c1",
  customer_email: "client@test.sk",
  kind: "email_in",
  title: "Re: Ponuka",
  body_preview: null,
  metadata: {},
  source_table: null,
  source_id: null,
  message_id: "msg-1",
  in_reply_to: null,
  thread_id: null,
  sender_email: "client@test.sk",
  recipient_email: "info@webnaprenajom.sk",
  occurred_at: "2026-06-01T10:00:00Z",
  created_at: "2026-06-01T10:00:00Z",
  updated_at: "2026-06-01T10:00:00Z",
  ...overrides,
});

describe("email threading helpers", () => {
  it("normalizes reply subjects", () => {
    expect(normalizeEmailSubject("Re: Re: Ponuka webu")).toBe("ponuka webu");
    expect(normalizeEmailSubject("ODP: Dotaz")).toBe("dotaz");
  });

  it("parses References header ids", () => {
    const refs = parseReferencesHeader("<a@x.com> <b@y.com> c@z.com");
    expect(refs).toEqual(["a@x.com", "b@y.com", "c@z.com"]);
  });

  it("builds subject thread key", () => {
    expect(subjectThreadKey("ponuka", "Client@Test.sk")).toBe("subject:ponuka:client@test.sk");
  });

  it("prefers resend id for outbound thread", () => {
    expect(buildOutboundThreadId("re_abc", "ponuka", "a@b.cz")).toBe("resend:re_abc");
    expect(buildOutboundThreadId(null, "ponuka", "a@b.cz")).toBe("subject:ponuka:a@b.cz");
  });

  it("orders thread lookup candidates", () => {
    const ids = threadLookupCandidates("<reply@x.com>", "<ref1@x.com> <ref2@x.com>", "<self@x.com>");
    expect(ids[0]).toBe("reply@x.com");
    expect(ids).toContain("ref1@x.com");
    expect(ids[ids.length - 1]).toBe("self@x.com");
  });

  it("documents resolution order", () => {
    expect(THREAD_RESOLUTION_ORDER.length).toBeGreaterThanOrEqual(5);
  });

  it("labels thread match from metadata", () => {
    expect(
      communicationThreadLabel(
        baseRow({ in_reply_to: "parent@x.com", thread_id: "parent@x.com" }),
      ),
    ).toBe("Odpoveď vo vlákne");

    expect(
      communicationThreadLabel(
        baseRow({
          metadata: { thread_match: "resend_outbound" },
          thread_id: "resend:re_123",
        }),
      ),
    ).toBe("Vlákno (odchozí e-mail)");

    expect(
      communicationThreadLabel(
        baseRow({ thread_id: "subject:ponuka:client@test.sk" }),
      ),
    ).toBe("Vlákno (predmet)");
  });
});
