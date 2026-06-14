export type SectionResult<T> = {
  data: T;
  error: string | null;
  loaded: boolean;
};

export function emptySection<T>(data: T): SectionResult<T> {
  return { data, error: null, loaded: true };
}

export function mergeSectionErrors(...errors: (string | null | undefined)[]): string | null {
  const parts = errors.filter(Boolean) as string[];
  return parts.length ? parts.join("; ") : null;
}

/**
 * Wraps a Supabase (or similar) query so failures surface as section errors
 * instead of silent empty fallbacks.
 */
export async function fetchSection<T>(
  label: string,
  queryFn: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  empty: T,
): Promise<SectionResult<T>> {
  try {
    const res = await queryFn();
    if (res.error) {
      return { data: empty, error: `${label}: ${res.error.message}`, loaded: true };
    }
    return { data: (res.data ?? empty) as T, error: null, loaded: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { data: empty, error: `${label}: ${msg}`, loaded: true };
  }
}
