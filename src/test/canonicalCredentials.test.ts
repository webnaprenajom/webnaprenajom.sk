import { describe, it, expect } from "vitest";
import {
  annotateNotesWithCanonicalCredentialFlags,
  projectIdsWithCanonicalCredentials,
} from "@/lib/customerWorkbench/canonicalCredentials";

describe("canonicalCredentials", () => {
  it("flags projects only from customer_credentials linked_entity", () => {
    const credentials = [
      {
        linked_entity_type: "project",
        linked_entity_id: "p1",
      },
      {
        linked_entity_type: "hosting",
        linked_entity_id: "h1",
      },
      {
        linked_entity_type: "project",
        linked_entity_id: "p2",
      },
    ];
    expect(projectIdsWithCanonicalCredentials(credentials)).toEqual(new Set(["p1", "p2"]));
  });

  it("annotateNotesWithCanonicalCredentialFlags ignores legacy-only project rows", () => {
    const notes = [
      { id: "p1", title: "A", has_credentials: true },
      { id: "p2", title: "B", has_credentials: true },
      { id: "p3", title: "C", has_credentials: true },
    ];
    const annotated = annotateNotesWithCanonicalCredentialFlags(notes, [
      { linked_entity_type: "project", linked_entity_id: "p2" },
    ]);
    expect(annotated).toEqual([
      { id: "p1", title: "A", has_credentials: false },
      { id: "p2", title: "B", has_credentials: true },
      { id: "p3", title: "C", has_credentials: false },
    ]);
  });
});
