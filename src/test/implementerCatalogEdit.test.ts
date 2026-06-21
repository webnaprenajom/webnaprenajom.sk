import { describe, expect, it } from "vitest";
import {
  listAssignableUsersForImplementer,
  validateImplementerCatalogEdit,
} from "@/lib/admin/implementerCatalogEdit";
import type { CrmManagedUser } from "@/lib/admin/crmUserDirectory";

const adminFree = {
  userId: "u-free",
  email: "free@x.com",
  authDisplayName: null,
  roleRowId: "r1",
  role: "administrator",
  teamDisplayName: null,
  implementerName: null,
  profileActive: false,
  inactiveProfile: false,
  orphanActiveProfile: false,
  displayName: "Free Admin",
  missingProfile: true,
  riskFlags: [],
} as CrmManagedUser;

const adminPeter = {
  userId: "u-peter",
  email: "p@x.com",
  authDisplayName: null,
  roleRowId: "r2",
  role: "administrator",
  teamDisplayName: "P",
  implementerName: "Peter",
  profileActive: true,
  inactiveProfile: false,
  orphanActiveProfile: false,
  displayName: "Peter Admin",
  missingProfile: false,
  riskFlags: [],
} as CrmManagedUser;

const adminEva = {
  userId: "u-eva",
  email: "e@x.com",
  authDisplayName: null,
  roleRowId: "r3",
  role: "administrator",
  teamDisplayName: "E",
  implementerName: "Eva",
  profileActive: true,
  inactiveProfile: false,
  orphanActiveProfile: false,
  displayName: "Eva Admin",
  missingProfile: false,
  riskFlags: [],
} as CrmManagedUser;

const ownerFree = {
  userId: "u-owner",
  email: "o@x.com",
  authDisplayName: null,
  roleRowId: "r4",
  role: "owner",
  teamDisplayName: null,
  implementerName: null,
  profileActive: false,
  inactiveProfile: false,
  orphanActiveProfile: false,
  displayName: "Owner User",
  missingProfile: false,
  riskFlags: [],
} as CrmManagedUser;

const ownerScope = { actorIsOwner: true as const };
const adminSelfScope = { actorIsOwner: false as const, actorUserId: "u-free" };

describe("implementerCatalogEdit", () => {
  it("lists assignable administrators without conflicting implementer", () => {
    const users = listAssignableUsersForImplementer(
      [adminFree, adminPeter, adminEva],
      "Peter",
      "u-peter",
      ownerScope,
    );
    expect(users.map((u) => u.userId)).toContain("u-free");
    expect(users.map((u) => u.userId)).toContain("u-peter");
    expect(users.map((u) => u.userId)).not.toContain("u-eva");
  });

  it("owner scope includes owner accounts without implementer", () => {
    const users = listAssignableUsersForImplementer(
      [adminFree, ownerFree, adminEva],
      "Nový",
      null,
      ownerScope,
    );
    expect(users.map((u) => u.userId)).toContain("u-owner");
    expect(users.map((u) => u.userId)).toContain("u-free");
    expect(users.map((u) => u.userId)).not.toContain("u-eva");
  });

  it("administrator scope is limited to self only", () => {
    const users = listAssignableUsersForImplementer(
      [adminFree, adminPeter, ownerFree],
      "Nový",
      null,
      adminSelfScope,
    );
    expect(users.map((u) => u.userId)).toEqual(["u-free"]);
  });

  it("allows owner to assign implementer to owner account", () => {
    const result = validateImplementerCatalogEdit({
      entry: {
        name: "Nový",
        inRegistry: true,
        active: true,
        assignedUserId: null,
      },
      draft: { name: "Nový", assignedUserId: "u-owner" },
      registry: [{ name: "Nový", active: true }],
      managedUsers: [ownerFree],
      scope: ownerScope,
    });
    expect(result.ok).toBe(true);
  });

  it("blocks administrator actor from assigning other accounts", () => {
    const result = validateImplementerCatalogEdit({
      entry: {
        name: "Nový",
        inRegistry: true,
        active: true,
        assignedUserId: null,
      },
      draft: { name: "Nový", assignedUserId: "u-peter" },
      registry: [{ name: "Nový", active: true }],
      managedUsers: [adminPeter],
      scope: adminSelfScope,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/vlastné priradenie/i);
  });

  it("allows rename with historical warning", () => {
    const result = validateImplementerCatalogEdit({
      entry: {
        name: "Peter",
        inRegistry: true,
        active: true,
        assignedUserId: "u-peter",
      },
      draft: { name: "Petr", assignedUserId: "u-peter" },
      registry: [{ name: "Peter", active: true }],
      managedUsers: [adminPeter],
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.includes("Historické"))).toBe(true);
  });

  it("blocks rename collision with another active registry name", () => {
    const result = validateImplementerCatalogEdit({
      entry: {
        name: "Voľný",
        inRegistry: true,
        active: true,
        assignedUserId: null,
      },
      draft: { name: "Peter", assignedUserId: null },
      registry: [
        { name: "Voľný", active: true },
        { name: "Peter", active: true },
      ],
      managedUsers: [adminPeter],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/už v registri/i);
  });

  it("blocks assigning account that already has a different implementer", () => {
    const result = validateImplementerCatalogEdit({
      entry: {
        name: "Nový",
        inRegistry: true,
        active: true,
        assignedUserId: null,
      },
      draft: { name: "Nový", assignedUserId: "u-eva" },
      registry: [{ name: "Nový", active: true }],
      managedUsers: [adminEva],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/už používa realizátora Eva/i);
  });

  it("allows assign to free administrator", () => {
    const result = validateImplementerCatalogEdit({
      entry: {
        name: "Nový",
        inRegistry: true,
        active: true,
        assignedUserId: null,
      },
      draft: { name: "Nový", assignedUserId: "u-free" },
      registry: [{ name: "Nový", active: true }],
      managedUsers: [adminFree],
    });
    expect(result.ok).toBe(true);
  });
});
