/** Dev-only admin flow logging (Batch RC3). No-op in production builds. */
export function adminDebugLog(scope: string, message: string, data?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  if (data) {
    console.debug(`[crm:${scope}] ${message}`, data);
  } else {
    console.debug(`[crm:${scope}] ${message}`);
  }
}
