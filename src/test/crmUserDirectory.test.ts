import { describe, expect, it } from "vitest";
import {
  buildCrmManagedUsers,
  canDemoteOwner,
  canRemoveOwnerRole,
  countOwners,
  duplicateDisplayNameKeys,
  filterManagedUsers,
  implementerNameTaken,
  isLastOwner,
  resolveUserDisplayName,
  sortUsersForAccessReview,
  userMatchesSearch,
  pendingAuthUserReviewMessage,
  type CrmManagedUser,
} from "@/lib/admin/crmUserDirectory";

describe("crmUserDirectory", () => {
  const directory = [
    { userId: "u1", email: "alice@example.com", authDisplayName: "Alice Nová" },
    { userId: "u2", email: "bob@example.com", authDisplayName: "Bob Novák" },
    { userId: "u3", email: "alice.dup@example.com", authDisplayName: "Alice Nová" },
    { userId: "u4", email: "owner2@example.com", authDisplayName: "Owner Two" },
  ];

  const roles = [
    { id: "r1", user_id: "u1", role: "owner" },
    { id: "r2", user_id: "u2", role: "administrator" },
    { id: "r3", user_id: "u3", role: "administrator" },
    { id: "r4", user_id: "u4", role: "owner" },
  ];

  const profiles = [
    { user_id: "u2", display_name: "Bob", implementer_name: "Bob Novák", active: true },
  ];

  const managed = buildCrmManagedUsers(directory, roles, profiles, ["Bob Novák"]);

  it("resolves display name from team profile then auth then email", () => {
    expect(
      resolveUserDisplayName({
        email: "x@y.com",
        authDisplayName: "Auth Name",
        teamDisplayName: "Team Name",
      }),
    ).toBe("Team Name");
    expect(resolveUserDisplayName({ email: "local@y.com", authDisplayName: null })).toBe("local");
  });

  it("filters by partial email and name", () => {
    const alice = managed.find((u) => u.userId === "u1")!;
    expect(userMatchesSearch(alice, "alice@")).toBe(true);
    expect(userMatchesSearch(alice, "nová")).toBe(true);
    expect(userMatchesSearch(alice, "zzz")).toBe(false);
  });

  it("flags missing profile for role=administrator", () => {
    const bob = managed.find((u) => u.userId === "u2")!;
    const aliceDup = managed.find((u) => u.userId === "u3")!;
    expect(bob.missingProfile).toBe(false);
    expect(bob.profileActive).toBe(true);
    expect(aliceDup.missingProfile).toBe(true);
    expect(aliceDup.inactiveProfile).toBe(false);
  });

  it("detects orphan active profile without CRM role", () => {
    const orphan = buildCrmManagedUsers(
      [{ userId: "ox", email: "orphan@x.com", authDisplayName: "Orphan" }],
      [],
      [{ user_id: "ox", display_name: "Orphan", implementer_name: "Peter", active: true }],
      ["Peter"],
    )[0];
    expect(orphan.orphanActiveProfile).toBe(true);
    expect(orphan.implementerName).toBe("Peter");
    expect(orphan.riskFlags.some((f) => f.includes("Orphan"))).toBe(true);
  });

  it("sorts risky users first then alphabetically", () => {
    const sorted = [...managed].sort(sortUsersForAccessReview);
    expect(sorted[0].missingProfile).toBe(true);
  });

  it("detects duplicate display names for disambiguation", () => {
    const dupes = duplicateDisplayNameKeys(managed);
    expect(dupes.has("alice nová")).toBe(true);
  });

  it("filters by canonical role and mapping status", () => {
    const onlyAdmin = filterManagedUsers(managed, {
      search: "",
      role: "administrator",
      mapping: "all",
    });
    expect(onlyAdmin).toHaveLength(2);
    const onlyOwner = filterManagedUsers(managed, { search: "", role: "owner", mapping: "all" });
    expect(onlyOwner).toHaveLength(2);
    const missing = filterManagedUsers(managed, { search: "", role: "all", mapping: "missing" });
    expect(missing.every((u) => u.missingProfile)).toBe(true);
  });

  it("counts owners and detects last owner", () => {
    expect(countOwners(managed)).toBe(2);
    expect(isLastOwner(managed, "u1")).toBe(false);
    const singleOwner = managed.filter((u) => u.userId !== "u4");
    expect(isLastOwner(singleOwner, "u1")).toBe(true);
  });

  it("detects implementer name collision", () => {
    expect(implementerNameTaken(managed, "Bob Novák", "u3")).toBe(true);
    expect(implementerNameTaken(managed, "Bob Novák", "u2")).toBe(false);
    expect(implementerNameTaken(managed, "Peter", "u2")).toBe(false);
  });
});

describe("owner user management guards", () => {
  const owners: CrmManagedUser[] = [
    {
      userId: "o1",
      email: "a@x.com",
      authDisplayName: null,
      roleRowId: "r1",
      role: "owner",
      teamDisplayName: null,
      implementerName: null,
      profileActive: false,
      inactiveProfile: false,
      orphanActiveProfile: false,
      displayName: "Owner A",
      missingProfile: false,
      riskFlags: [],
    },
  ];

  const twoOwners: CrmManagedUser[] = [
    ...owners,
    {
      userId: "o2",
      email: "b@x.com",
      authDisplayName: null,
      roleRowId: "r2",
      role: "owner",
      teamDisplayName: null,
      implementerName: null,
      profileActive: false,
      inactiveProfile: false,
      orphanActiveProfile: false,
      displayName: "Owner B",
      missingProfile: false,
      riskFlags: [],
    },
  ];

  it("blocks remove last owner", () => {
    expect(canRemoveOwnerRole(owners, owners[0])).toBe(false);
    expect(canRemoveOwnerRole(twoOwners, twoOwners[0])).toBe(true);
  });

  it("blocks demote last owner", () => {
    expect(canDemoteOwner(owners, "o1")).toBe(false);
    expect(canDemoteOwner(twoOwners, "o1")).toBe(true);
  });

  it("formats pending auth user review message", () => {
    expect(pendingAuthUserReviewMessage(0)).toBeNull();
    expect(pendingAuthUserReviewMessage(1)).toBe("Čaká 1 nový účet na priradenie CRM role");
    expect(pendingAuthUserReviewMessage(3)).toBe("Čaká 3 nové účty na priradenie CRM role");
    expect(pendingAuthUserReviewMessage(5)).toBe("Čaká 5 nových účtov na priradenie CRM role");
  });
});
