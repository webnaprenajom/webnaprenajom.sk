import type { MigrationReport, ReviewItem } from "./types.js";

const SENSITIVE_KEYS = new Set([
  "password",
  "username",
  "access_credentials",
  "signature",
  "signature_name",
]);

/** ponytail: shallow redact for reports — values replaced, structure kept */
export function redactReportForOutput(report: MigrationReport): MigrationReport {
  return {
    ...report,
    analysis: {
      ...report.analysis,
      sensitivePayloads: report.analysis.sensitivePayloads.map(redactReviewItem),
      customerMatchHints: report.analysis.customerMatchHints.map(redactReviewItem),
      orphanFkRisks: report.analysis.orphanFkRisks.map(redactReviewItem),
      uuidCollisions: report.analysis.uuidCollisions.map(redactReviewItem),
    },
    reconciliation: report.reconciliation
      ? {
          ...report.reconciliation,
          identityGaps: report.reconciliation.identityGaps.map(redactReviewItem),
          crossEmailCustomerLeadMismatches:
            report.reconciliation.crossEmailCustomerLeadMismatches.map(redactReviewItem),
        }
      : undefined,
  };
}

function redactReviewItem(item: ReviewItem): ReviewItem {
  return {
    ...item,
    candidates: redactUnknown(item.candidates),
  };
}

function redactUnknown(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(redactUnknown);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k) && typeof v === "string" && v.length > 0) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactUnknown(v);
      }
    }
    return out;
  }
  return value;
}
