import { describe, expect, it } from "vitest";
import {
  buildCrmManagedUsers,
  duplicateDisplayNameKeys,
  filterManagedUsers,
  resolveUserDisplayName,
  sortUsersForAccessReview,
  userMatchesSearch,
} from "@/lib/admin/crmUserDirectory";

describe("crmUserDirectory", () => {
  const directory = [
    { userId: "u1", email: "alice@example.com", authDisplayName: "Alice Nová" },
    { userId: "u2", email: "bob@example.com", authDisplayName: "Bob Novák" },
    { userId: "u3", email: "alice.dup@example.com", authDisplayName: "Alice Nová" },
  ];

  const roles = [
    { id: "r1", user_id: "u1", role: "admin" as const },
    { id: "r2", user_id: "u2", role: "user" as const },
    { id: "r3", user_id: "u3", role: "user" as const },
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

  it("flags missing profile for role=user", () => {
    const bob = managed.find((u) => u.userId === "u2")!;
    const aliceDup = managed.find((u) => u.userId === "u3")!;
    expect(bob.missingProfile).toBe(false);
    expect(aliceDup.missingProfile).toBe(true);
  });

  it("sorts risky users first then alphabetically", () => {
    const sorted = [...managed].sort(sortUsersForAccessReview);
    expect(sorted[0].missingProfile).toBe(true);
  });

  it("detects duplicate display names for disambiguation", () => {
    const dupes = duplicateDisplayNameKeys(managed);
    expect(dupes.has("alice nová")).toBe(true);
  });

  it("filters by role and mapping status", () => {
    const onlyUser = filterManagedUsers(managed, { search: "", role: "user", mapping: "all" });
    expect(onlyUser).toHaveLength(2);
    const missing = filterManagedUsers(managed, { search: "", role: "all", mapping: "missing" });
    expect(missing.every((u) => u.missingProfile)).toBe(true);
  });
});
