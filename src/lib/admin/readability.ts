/** Admin UI sizing tokens (~+15% vs legacy micro labels). ponytail: class strings only. */
export const adminSurface = "admin-surface";

export const adminType = {
  pageSubtitle: "text-sm text-muted-foreground",
  sectionTitle: "text-base font-semibold tracking-tight text-foreground",
  sectionDesc: "text-sm text-muted-foreground leading-snug",
  groupLabel: "text-xs font-semibold uppercase tracking-wider text-muted-foreground",
  meta: "text-sm text-muted-foreground",
  caption: "text-xs text-muted-foreground leading-snug",
  label: "text-sm font-medium",
} as const;

export const adminCtrl = {
  /** Compact row actions — was h-7 + 10–11px text */
  sm: "h-8 text-xs",
  input: "h-10 text-sm",
} as const;

/** Finance / data grids — keep density; opt out of admin-surface text bumps */
export const tableDense = "table-dense";
