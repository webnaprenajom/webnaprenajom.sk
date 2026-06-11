import { describe, it, expect } from "vitest";
import {
  applyWorkbenchUrlUpdate,
  parseWorkbenchCommFilter,
  parseWorkbenchTab,
  workbenchTabLabel,
  WORKBENCH_COMM_FILTER_PARAM,
  WORKBENCH_TAB_PARAM,
} from "@/lib/customerWorkbench/urlState";

describe("workbench URL state", () => {
  it("defaults tab and comm filter", () => {
    expect(parseWorkbenchTab(new URLSearchParams())).toBe("prehlad");
    expect(parseWorkbenchCommFilter(new URLSearchParams())).toBe("all");
  });

  it("parses valid tab and comm deep links", () => {
    const params = new URLSearchParams("tab=komunikacia&comm=unlinked");
    expect(parseWorkbenchTab(params)).toBe("komunikacia");
    expect(parseWorkbenchCommFilter(params)).toBe("unlinked");
  });

  it("ignores invalid tab values", () => {
    expect(parseWorkbenchTab(new URLSearchParams("tab=invalid"))).toBe("prehlad");
  });

  it("omits default tab from URL updates", () => {
    const next = applyWorkbenchUrlUpdate(
      new URLSearchParams(`${WORKBENCH_TAB_PARAM}=financie`),
      { tab: "prehlad" },
    );
    expect(next.has(WORKBENCH_TAB_PARAM)).toBe(false);
  });

  it("clears comm filter when leaving komunikacia tab", () => {
    const prev = new URLSearchParams(`${WORKBENCH_TAB_PARAM}=komunikacia&${WORKBENCH_COMM_FILTER_PARAM}=inbound`);
    const next = applyWorkbenchUrlUpdate(prev, { tab: "ulohy" });
    expect(next.get(WORKBENCH_TAB_PARAM)).toBe("ulohy");
    expect(next.has(WORKBENCH_COMM_FILTER_PARAM)).toBe(false);
  });

  it("sets comm filter only on komunikacia tab", () => {
    const next = applyWorkbenchUrlUpdate(new URLSearchParams(), {
      tab: "komunikacia",
      commFilter: "threaded",
    });
    expect(next.get(WORKBENCH_TAB_PARAM)).toBe("komunikacia");
    expect(next.get(WORKBENCH_COMM_FILTER_PARAM)).toBe("threaded");
  });

  it("resolves Slovak tab labels", () => {
    expect(workbenchTabLabel("komunikacia")).toBe("Komunikácia");
    expect(workbenchTabLabel("prehlad")).toBe("Prehľad");
  });
});
