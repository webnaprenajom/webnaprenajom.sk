import { createHash } from "node:crypto";
import type { ParsedCsvRow } from "./types.js";

/** Stable hash for idempotent change detection. */
export function computeRowHash(row: ParsedCsvRow): string {
  const sorted = Object.keys(row)
    .sort()
    .reduce<ParsedCsvRow>((acc, key) => {
      acc[key] = row[key] ?? "";
      return acc;
    }, {});
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}
