// Query-key factory: every hook builds keys here so caches never collide
// across domains. Namespaced per domain: [domain, scope, params?].

export type QueryKey = readonly unknown[];

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, stable(v)]),
    );
  }
  return value;
}

export const queryKeys = {
  domain: (domain: string): QueryKey => [domain],
  list: (domain: string, params?: Record<string, unknown>): QueryKey =>
    params === undefined ? [domain, 'list'] : [domain, 'list', stable(params)],
  detail: (domain: string, id: string): QueryKey => [domain, 'detail', id],
  activity: (domain: string): QueryKey => [domain, 'activity'],
} as const;
