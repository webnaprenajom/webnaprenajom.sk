import { describe, expect, it } from "vitest";
import {
  buildImplementerRegistryEntries,
  evaluateImplementerRegistryRemove,
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

  it("merges registry rows and assigned profiles without legacy seed when registry exists", () => {
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
    expect(catalog).not.toContain("Peter");
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
    expect(free?.canRemove).toBe(false);
    expect(free?.removeBlockReason).toMatch(/deaktivujte/i);
  });

  it("allows remove for inactive unassigned registry row", () => {
    const entries = buildImplementerRegistryEntries(
      [{ name: "Starý", active: false }],
      [],
    );
    const row = entries.find((e) => e.name === "Starý");
    expect(row?.canRemove).toBe(true);
    expect(row?.removeBlockReason).toBeNull();
  });

  it("blocks remove when team profile still holds the name", () => {
    const managed = [
      {
        userId: "u2",
        email: "x@y.com",
        authDisplayName: null,
        roleRowId: null,
        role: null,
        teamDisplayName: "X",
        implementerName: "Viazaný",
        profileActive: false,
        inactiveProfile: true,
        orphanActiveProfile: false,
        displayName: "X User",
        missingProfile: false,
        riskFlags: [],
      } as CrmManagedUser,
    ];
    const eligibility = evaluateImplementerRegistryRemove(
      {
        name: "Viazaný",
        active: false,
        inRegistry: true,
        assignedUserId: null,
      },
      managed,
    );
    expect(eligibility.canRemove).toBe(false);
    expect(eligibility.removeBlockReason).toMatch(/profil/i);
  });
});
