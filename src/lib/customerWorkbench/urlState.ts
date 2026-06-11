import type { CommunicationTimelineFilter } from "@/lib/communication/events";
import type { WorkbenchTabId } from "./types";
import { WORKBENCH_TABS } from "./constants";

export const WORKBENCH_TAB_PARAM = "tab";
export const WORKBENCH_COMM_FILTER_PARAM = "comm";

const VALID_TABS = new Set<string>(WORKBENCH_TABS.map((t) => t.id));

const VALID_COMM_FILTERS = new Set<string>([
  "all",
  "inbound",
  "outbound",
  "unlinked",
  "threaded",
]);

export function parseWorkbenchTab(params: URLSearchParams): WorkbenchTabId {
  const raw = params.get(WORKBENCH_TAB_PARAM);
  if (raw && VALID_TABS.has(raw)) return raw as WorkbenchTabId;
  return "prehlad";
}

export function parseWorkbenchCommFilter(params: URLSearchParams): CommunicationTimelineFilter {
  const raw = params.get(WORKBENCH_COMM_FILTER_PARAM);
  if (raw && VALID_COMM_FILTERS.has(raw) && raw !== "all") {
    return raw as CommunicationTimelineFilter;
  }
  return "all";
}

export interface WorkbenchUrlUpdate {
  tab?: WorkbenchTabId;
  commFilter?: CommunicationTimelineFilter;
}

/** Apply workbench URL updates; omits default values to keep URLs clean. */
export function applyWorkbenchUrlUpdate(
  prev: URLSearchParams,
  update: WorkbenchUrlUpdate,
): URLSearchParams {
  const next = new URLSearchParams(prev);

  if (update.tab !== undefined) {
    if (update.tab === "prehlad") next.delete(WORKBENCH_TAB_PARAM);
    else next.set(WORKBENCH_TAB_PARAM, update.tab);

    if (update.tab !== "komunikacia") {
      next.delete(WORKBENCH_COMM_FILTER_PARAM);
    }
  }

  if (update.commFilter !== undefined) {
    if (update.commFilter === "all") next.delete(WORKBENCH_COMM_FILTER_PARAM);
    else next.set(WORKBENCH_COMM_FILTER_PARAM, update.commFilter);
  }

  return next;
}

export function workbenchTabLabel(tab: WorkbenchTabId): string {
  return WORKBENCH_TABS.find((t) => t.id === tab)?.label ?? tab;
}
