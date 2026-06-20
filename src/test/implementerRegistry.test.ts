import { describe, expect, it } from "vitest";
import {
  buildImplementerRegistryEntries,
  implementerRegistryNameTaken,
  mergeImplementerCatalog,
  normalizeImplementerName,
} from "@/lib/admin/implementerRegistry";
import type { CrmManagedUser } from "@/lib/admin/crmUserDirectory";

describe("implementerRegistry", () => {
  it("normalizes and rejects invalid names", () => {
    expect(normalizeImplementerName("  Ján  ")).toBe("Ján");
    expect(normalizeImplementerName("x")).toBeNull();
    expect(normalizeImplementerName("bad__off__name")).toBeNull();
  });

  it("merges seed, registry, and assigned profiles", () => {
    const catalog = mergeImplementerCatalog(
      [{ name: "Ján", active: true }],
      [
        {
          userId: "u1",
          email: "a@x.com",
          authDisplayName: null,
          roleRowId: "r1",
          role: "administrator",
          teamDisplayName: "A",
          implementerName: "Eva",
          profileActive: true,
          inactiveProfile: false,
          orphanActiveProfile: false,
          displayName: "A",
          missingProfile: false,
          riskFlags: [],
        } as CrmManagedUser,
      ],
    );
    expect(catalog).toContain("Peter");
    expect(catalog).toContain("Ján");
    expect(catalog).toContain("Eva");
  });

  it("detects active registry name collision", () => {
    expect(implementerRegistryNameTaken([{ name: "Ján", active: true }], "ján")).toBe(true);
    expect(implementerRegistryNameTaken([{ name: "Ján", active: false }], "Ján")).toBe(false);
  });

  it("builds assignment status per name", () => {
    const entries = buildImplementerRegistryEntries(
      [{ name: "Peter", active: true }, { name: "Voľný", active: true }],
      [
        {
          userId: "u1",
          email: "p@x.com",
          authDisplayName: null,
          roleRowId: "r1",
          role: "administrator",
          teamDisplayName: "P",
          implementerName: "Peter",
          profileActive: true,
          inactiveProfile: false,
          orphanActiveProfile: false,
          displayName: "P",
          missingProfile: false,
          riskFlags: [],
        } as CrmManagedUser,
      ],
    );
    const peter = entries.find((e) => e.name === "Peter");
    const free = entries.find((e) => e.name === "Voľný");
    expect(peter?.assignedUserId).toBe("u1");
    expect(free?.assignedUserId).toBeNull();
  });
});
