import { describe, expect, it } from "vitest";
import type { AccessContext } from "@/lib/rbac/permissions";
import {
  filterDesignsForUser,
  filterForUser,
  filterHostingForUser,
  filterLeadsForUser,
  filterMarketingForUser,
  filterProjectsForUser,
  filterRentalsForUser,
  filterTasksForUser,
  rowVisibleToUser,
} from "@/lib/rbac/scopeHelpers";

const ownerCtx: AccessContext = {
  role: "owner",
  userId: "owner-1",
  implementerName: null,
};

const peterCtx: AccessContext = {
  role: "administrator",
  userId: "user-peter",
  implementerName: "Peter",
};

const noProfileCtx: AccessContext = {
  role: "administrator",
  userId: "user-x",
  implementerName: null,
};

describe("filterForUser (generic)", () => {
  const rows = [{ id: "1" }, { id: "2" }];

  it("returns empty array for empty rows", () => {
    expect(filterForUser([], peterCtx, () => ({ implementerName: "Peter" }))).toEqual([]);
  });

  it("owner sees all rows", () => {
    expect(filterForUser(rows, ownerCtx, () => ({}))).toHaveLength(2);
  });

  it("administrator matches implementerName case-insensitively", () => {
    const ctx = { ...peterCtx, implementerName: "peter" };
    const filtered = filterForUser(rows, ctx, () => ({ implementerName: "Peter" }));
    expect(filtered).toHaveLength(2);
  });

  it("administrator matches assignedTo UUID when implementerName is null", () => {
    const filtered = filterForUser(
      [{ id: "a" }, { id: "b" }],
      noProfileCtx,
      (row) => ({ assignedTo: row.id === "a" ? "user-x" : "other" }),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("a");
  });

  it("administrator with no profile and no UUID match returns empty", () => {
    expect(
      filterForUser([{ id: "1" }], noProfileCtx, () => ({ implementerName: "Peter" })),
    ).toEqual([]);
  });

  it("does not duplicate rows when multiple signals match", () => {
    const filtered = filterForUser(
      [{ id: "only" }],
      peterCtx,
      () => ({
        implementerName: "Peter",
        assignedTo: "Peter",
      }),
    );
    expect(filtered).toHaveLength(1);
  });
});

describe("filterLeadsForUser", () => {
  const leads = [
    { id: "l1", assigned_to: "Peter" },
    { id: "l2", assigned_to: "Maroš" },
    { id: "l3", assigned_to: null },
  ] as Parameters<typeof filterLeadsForUser>[0];

  it("owner sees all leads", () => {
    expect(filterLeadsForUser(leads, ownerCtx)).toHaveLength(3);
  });

  it("administrator sees leads assigned by name", () => {
    expect(filterLeadsForUser(leads, peterCtx)).toEqual([leads[0]]);
  });

  it("administrator without profile sees leads by UUID assigned_to", () => {
    const uuidLeads = [
      { id: "l1", assigned_to: "user-x" },
      { id: "l2", assigned_to: "other" },
    ] as Parameters<typeof filterLeadsForUser>[0];
    expect(filterLeadsForUser(uuidLeads, noProfileCtx)).toEqual([uuidLeads[0]]);
  });

  it("administrator without profile and no match returns empty", () => {
    expect(filterLeadsForUser(leads, noProfileCtx)).toEqual([]);
  });
});

describe("filterTasksForUser", () => {
  const tasks = [
    { id: "t1", assignee: "Peter" },
    { id: "t2", assignee: "Maroš" },
  ] as Parameters<typeof filterTasksForUser>[0];

  it("owner sees all tasks", () => {
    expect(filterTasksForUser(tasks, ownerCtx)).toHaveLength(2);
  });

  it("administrator sees tasks by assignee name", () => {
    expect(filterTasksForUser(tasks, peterCtx)).toEqual([tasks[0]]);
  });

  it("administrator without profile returns empty when no UUID match", () => {
    expect(filterTasksForUser(tasks, noProfileCtx)).toEqual([]);
  });
});

describe("filterRentalsForUser", () => {
  const rentals = [
    {
      id: "r1",
      implementers: [{ name: "Peter", percentage: 50 }, { name: "Maroš", percentage: 50 }],
    },
    { id: "r2", implementers: [{ name: "Maroš", percentage: 100 }] },
  ] as Parameters<typeof filterRentalsForUser>[0];

  it("owner sees all rentals", () => {
    expect(filterRentalsForUser(rentals, ownerCtx)).toHaveLength(2);
  });

  it("administrator sees rentals where implementers JSON includes their name", () => {
    expect(filterRentalsForUser(rentals, peterCtx)).toEqual([rentals[0]]);
  });

  it("administrator without profile returns empty", () => {
    expect(filterRentalsForUser(rentals, noProfileCtx)).toEqual([]);
  });
});

describe("filterHostingForUser", () => {
  const records = [
    { id: "h1", acquired_by: "Peter" },
    { id: "h2", acquired_by: "Maroš" },
  ] as Parameters<typeof filterHostingForUser>[0];

  it("owner sees all hosting records", () => {
    expect(filterHostingForUser(records, ownerCtx)).toHaveLength(2);
  });

  it("administrator sees records by acquired_by name", () => {
    expect(filterHostingForUser(records, peterCtx)).toEqual([records[0]]);
  });

  it("administrator without profile returns empty", () => {
    expect(filterHostingForUser(records, noProfileCtx)).toEqual([]);
  });
});

describe("filterProjectsForUser", () => {
  const notes = [{ id: "p1", title: "A" }, { id: "p2", title: "B" }] as Parameters<
    typeof filterProjectsForUser
  >[0];

  it("owner sees all projects", () => {
    expect(filterProjectsForUser(notes, ownerCtx)).toHaveLength(2);
  });

  it("administrator sees none (no ownership columns on project_notes)", () => {
    expect(filterProjectsForUser(notes, peterCtx)).toEqual([]);
  });
});

describe("filterMarketingForUser", () => {
  const records = [{ id: "m1", title: "Camp" }] as Parameters<typeof filterMarketingForUser>[0];

  it("owner sees all marketing records", () => {
    expect(filterMarketingForUser(records, ownerCtx)).toHaveLength(1);
  });

  it("administrator sees none (no ownership columns on marketing_records)", () => {
    expect(filterMarketingForUser(records, peterCtx)).toEqual([]);
  });
});

describe("filterDesignsForUser", () => {
  const designs = [{ id: "d1", client_name: "X" }] as Parameters<typeof filterDesignsForUser>[0];

  it("owner sees all designs", () => {
    expect(filterDesignsForUser(designs, ownerCtx)).toHaveLength(1);
  });

  it("administrator sees none (no ownership columns on design_proposals)", () => {
    expect(filterDesignsForUser(designs, peterCtx)).toEqual([]);
  });
});

describe("rowVisibleToUser", () => {
  it("createdBy UUID match works without implementerName", () => {
    expect(
      rowVisibleToUser({ createdBy: "user-x" }, noProfileCtx),
    ).toBe(true);
  });

  it("assignedTo name fallback matches implementerName", () => {
    expect(
      rowVisibleToUser({ assignedTo: "peter" }, { ...peterCtx, implementerName: "Peter" }),
    ).toBe(true);
  });
});
