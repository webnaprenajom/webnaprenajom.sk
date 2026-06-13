export function buildAuditSummary(actionType: string, detail: string): string {
  return `${actionType}: ${detail}`.slice(0, 500);
}
