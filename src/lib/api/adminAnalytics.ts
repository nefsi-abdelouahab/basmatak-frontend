import { z } from 'zod';
import type { AxiosInstance, AxiosResponse } from 'axios';
import { downloadBlob } from './download';

// F14 admin-overview module: one typed function per admin dashboard endpoint
// (base `/api/v1`). Verified read-only against backend/src (no edits):
// - admin/analytics.controller (`@Roles('admin')`):
//   GET /admin/analytics/overview → AdminAnalyticsOverview (analytics.service);
//   GET /admin/analytics/series (`AnalyticsSeriesQueryDto.days`, 1–90 enforced
//   server-side, default 30) → { days, points[] }; GET /admin/analytics/queue
//   → AdminAnalyticsQueue.
// - admin/stats.controller: GET /admin/stats/overview (the v1 stats route,
//   distinct from /admin/analytics/overview) → AdminStatsOverview.
// - admin/audit.controller: GET /admin/audit-logs (`AuditLogsQueryDto`:
//   ?actor=&entityType=&entityId=&date=&q=&sort=newest|oldest, cursor
//   `cursor`/`limit`/`pageSize`, plus `format=csv` — CSV is NOT consumed here)
//   → CursorPage<AdminAuditRow> = { items: [{ log, actorName, targetName }] }.
// - GET /health and GET /system/status are F0's (`./system` `getHealth` /
//   `getSystemStatus`) — imported by the page, never redefined here. F16 consumes
//   the same two; one schema, no drift.
//
// DISCIPLINES enforced in this file (see design.md decisions 3/4/7):
// - Every figure comes from a response field. No numeric literal in this file
//   stands in for a backend figure, and no "peak"/"record" value is produced.
// - Overlapping concepts (pendingVerifications on both the stats overview and
//   the queue; gateFreezes on both analytics and stats) are rendered per-endpoint
//   and NEVER summed, averaged, or reconciled — each item carries its `source`.
// - The attention queue is a neutral read-only list: navigation hrefs only, no
//   mutating helper, no sanction/compliance/enforcement vocabulary.
// - `cursorPage` is defined locally (not imported from tasks.ts) so this module
//   has no cross-session import edge.

export const DeltaCountSchema = z
  .object({
    current: z.number(),
    previous: z.number(),
    deltaPercent: z.number().nullable(),
  })
  .passthrough();

export type DeltaCount = z.infer<typeof DeltaCountSchema>;

export const TOTAL_KEYS = [
  'users',
  'organizations',
  'opportunities',
  'applications',
  'submissions',
] as const;

export type TotalKey = (typeof TOTAL_KEYS)[number];

const statusCountsSchema = z.record(z.string(), z.number());

export const AdminAnalyticsOverviewSchema = z
  .object({
    totals: z.object({
      users: DeltaCountSchema,
      organizations: DeltaCountSchema,
      opportunities: DeltaCountSchema,
      applications: DeltaCountSchema,
      submissions: DeltaCountSchema,
    }),
    activeParticipants: z.number(),
    perStatus: z
      .object({
        users: statusCountsSchema,
        organizations: z
          .object({
            byStatus: statusCountsSchema,
            byVerificationStatus: statusCountsSchema,
          })
          .passthrough(),
        opportunities: statusCountsSchema,
        applications: statusCountsSchema,
        submissions: statusCountsSchema,
      })
      .passthrough(),
    verificationReady: z
      .object({
        total: z.number(),
        byOrganization: z
          .array(
            z
              .object({ organizationId: z.string(), count: z.number() })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough(),
    gateFreezes: z.number(),
    // null when fewer than 5 verifications were decided in the 90-day window.
    medianDecisionHours: z.number().nullable(),
  })
  .passthrough();

export type AdminAnalyticsOverview = z.infer<typeof AdminAnalyticsOverviewSchema>;

export const AnalyticsSeriesPointSchema = z
  .object({
    date: z.string(),
    signups: z.number(),
    applications: z.number(),
    verifications: z.number(),
  })
  .passthrough();

export type AnalyticsSeriesPoint = z.infer<typeof AnalyticsSeriesPointSchema>;

export const AdminAnalyticsSeriesSchema = z
  .object({
    days: z.number(),
    points: z.array(AnalyticsSeriesPointSchema),
  })
  .passthrough();

export type AdminAnalyticsSeries = z.infer<typeof AdminAnalyticsSeriesSchema>;

export const AdminAnalyticsQueueSchema = z
  .object({
    pendingVerifications: z.number(),
    openReports: z.number(),
    underReviewSubmissions: z.number(),
    suspendedUsers: z.number(),
    suspendedOrganizations: z.number(),
    maintenanceMode: z.boolean(),
  })
  .passthrough();

export type AdminAnalyticsQueue = z.infer<typeof AdminAnalyticsQueueSchema>;

export const AdminStatsOverviewSchema = z
  .object({
    counts: z
      .object({
        users: z.number(),
        volunteers: z.number(),
        organizations: z.number(),
        verifiedOrganizations: z.number(),
        opportunities: z.number(),
        pendingVerifications: z.number(),
      })
      .passthrough(),
    totalVolunteerHours: z.number(),
    verificationRate: z.number(),
    gateFreezes: z.number(),
  })
  .passthrough();

export type AdminStatsOverview = z.infer<typeof AdminStatsOverviewSchema>;

export const AuditLogEntrySchema = z
  .object({
    _id: z.union([z.string(), z.object({})]).optional(),
    id: z.string().optional(),
    actorId: z.string().nullable().optional(),
    action: z.string().nullable().optional(),
    method: z.string().optional(),
    path: z.string().optional(),
    entityType: z.string().nullable().optional(),
    entityId: z.string().nullable().optional(),
    createdAt: z.string().optional(),
  })
  .passthrough();

export const AdminAuditRowSchema = z
  .object({
    log: AuditLogEntrySchema,
    // Display names enriched by the backend (AdminAuditService.enrich). `null`
    // is a legitimate response — the caller renders a neutral placeholder and
    // MUST NOT fall back to the raw ObjectId as the label.
    actorName: z.string().nullable(),
    targetName: z.string().nullable(),
  })
  .passthrough();

export type AdminAuditRow = z.infer<typeof AdminAuditRowSchema>;

// Local cursor page (design decision 7). `limit`/`page`/`pages` are optional
// because the audit route answers the shared CursorPage shape.
export const cursorPage = <T extends z.ZodTypeAny>(item: T) =>
  z
    .object({
      items: z.array(item),
      nextCursor: z.string().nullable().optional(),
      limit: z.number().optional(),
      total: z.number(),
      page: z.number().optional(),
      pages: z.number().optional(),
    })
    .passthrough();

export type AdminAuditPage = z.infer<ReturnType<typeof cursorPage<typeof AdminAuditRowSchema>>>;

/** Backend bound for `GET /admin/analytics/series?days=` (AnalyticsSeriesQueryDto). */
export const SERIES_MIN_DAYS = 1;
export const SERIES_MAX_DAYS = 90;
export const SERIES_DEFAULT_DAYS = 30;

/** Newest-first audit rows requested for the dashboard strip. */
export const AUDIT_STRIP_LIMIT = 10;

/** Defensive clamp; the DTO rejects out-of-range values with 400. */
export function clampSeriesDays(days: number | undefined): number {
  if (days === undefined || !Number.isInteger(days)) return SERIES_DEFAULT_DAYS;
  return Math.min(SERIES_MAX_DAYS, Math.max(SERIES_MIN_DAYS, days));
}

/** Sentinel for "the previous window was empty" — distinct from a real `0`. */
export const DELTA_UNAVAILABLE = null;

/**
 * Formats a delta percentage for display. `null` (empty previous window)
 * returns the `DELTA_UNAVAILABLE` sentinel so the component renders the
 * "no comparison" state; it never collapses to a `"0%"` string, which would
 * read as a measured flat trend.
 */
export function formatDeltaPercent(deltaPercent: number | null | undefined): string | null {
  if (deltaPercent === null || deltaPercent === undefined || !Number.isFinite(deltaPercent)) {
    return DELTA_UNAVAILABLE;
  }
  const rounded = Math.round(deltaPercent * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

export interface DeltaCard {
  key: TotalKey;
  current: number;
  previous: number;
  deltaPercent: string | null;
}

/** One card per overview total, in the backend's declared entity order. */
export function deltaCards(totals: Record<TotalKey, DeltaCount>): DeltaCard[] {
  return TOTAL_KEYS.map((key) => {
    const delta = totals[key];
    return {
      key,
      current: delta.current,
      previous: delta.previous,
      deltaPercent: formatDeltaPercent(delta.deltaPercent),
    };
  });
}

export const SERIES_FIELDS = ['signups', 'applications', 'verifications'] as const;

export type SeriesField = (typeof SERIES_FIELDS)[number];

export type SeriesTotals = Record<SeriesField, number>;

/** Per-series sums over the returned points only. Empty window → all zeros. */
export function seriesTotals(points: AnalyticsSeriesPoint[]): SeriesTotals {
  const totals: SeriesTotals = { signups: 0, applications: 0, verifications: 0 };
  for (const point of points) {
    for (const field of SERIES_FIELDS) totals[field] += point[field];
  }
  return totals;
}

/**
 * Largest single point across the three series, used to scale the bars.
 * Derived from the response only — never a hardcoded ceiling and never a
 * "peak"/"record" figure. Returns 0 for an empty window, in which case the
 * component renders the empty state instead of drawing against a fake scale.
 */
export function seriesMax(points: AnalyticsSeriesPoint[]): number {
  let max = 0;
  for (const point of points) {
    for (const field of SERIES_FIELDS) {
      if (point[field] > max) max = point[field];
    }
  }
  return max;
}

export type AttentionKey =
  | 'pendingVerifications'
  | 'openReports'
  | 'underReviewSubmissions'
  | 'suspendedUsers'
  | 'suspendedOrganizations';

export interface AttentionItem {
  key: AttentionKey;
  count: number;
  /** Navigation-only target owned by the manage-screens session (F15). */
  href: string;
  /** Endpoint the count is read from — never reconciled with another card. */
  source: 'queue';
}

// The five real attention categories, in the order the queue endpoint declares
// them (so the mapping stays 1:1 with the contract). Hrefs point at the F15/F16
// manage and moderation routes; F14 asserts them but never follows them.
const ATTENTION_DEFS: readonly { key: AttentionKey; href: string }[] = [
  { key: 'pendingVerifications', href: '/admin/verifications' },
  { key: 'openReports', href: '/admin/reports' },
  { key: 'underReviewSubmissions', href: '/admin/volunteers' },
  { key: 'suspendedUsers', href: '/admin/volunteers' },
  { key: 'suspendedOrganizations', href: '/admin/organizations' },
];

export function attentionItems(queue: AdminAnalyticsQueue): AttentionItem[] {
  return ATTENTION_DEFS.map((def) => ({
    key: def.key,
    count: queue[def.key],
    href: def.href,
    source: 'queue' as const,
  }));
}

export interface AuditDisplayRow {
  key: string;
  actor: string | null;
  target: string | null;
  action: string | null;
  method: string | null;
  path: string | null;
  createdAt: string | null;
}

/**
 * Resolves audit display names. A `null`/blank name stays `null` so the
 * component renders its neutral placeholder; the row key is derived from the
 * log id and is never surfaced as a label.
 */
export function auditRows(page: AdminAuditPage): AuditDisplayRow[] {
  const items = page?.items ?? [];
  return items.map((row, index) => {
    const id = row.log?._id ?? row.log?.id;
    const rawKey = typeof id === 'string' ? id : id ? JSON.stringify(id) : `audit-${index}`;
    const actor = (row.actorName ?? '').trim();
    const target = (row.targetName ?? '').trim();
    return {
      key: rawKey,
      actor: actor === '' ? null : actor,
      target: target === '' ? null : target,
      action: row.log?.action ?? null,
      method: row.log?.method ?? null,
      path: row.log?.path ?? null,
      createdAt: row.log?.createdAt ?? null,
    };
  });
}

export const TURNAROUND_UNAVAILABLE = null;

/**
 * Turnaround figure. `medianDecisionHours: null` means the backend had fewer
 * than 5 decisions in the 90-day window, so it returns the
 * `TURNAROUND_UNAVAILABLE` sentinel — never `0`, never a fabricated duration.
 */
export function turnaroundValue(medianDecisionHours: number | null | undefined): number | null {
  if (
    medianDecisionHours === null ||
    medianDecisionHours === undefined ||
    !Number.isFinite(medianDecisionHours)
  ) {
    return TURNAROUND_UNAVAILABLE;
  }
  return medianDecisionHours;
}

export interface StatusCountEntry {
  status: string;
  count: number;
}

/** Real status counts from a `perStatus` record, sorted by count then name. */
export function statusCounts(counts: Record<string, number>): StatusCountEntry[] {
  return Object.entries(counts)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
}

export interface UptimeParts {
  days: number;
  hours: number;
  minutes: number;
}

/** Splits `uptimeSeconds` into whole days/hours/minutes (no invented value). */
export function uptimeParts(uptimeSeconds: number | null | undefined): UptimeParts | null {
  if (uptimeSeconds === null || uptimeSeconds === undefined || !Number.isFinite(uptimeSeconds)) {
    return null;
  }
  const total = Math.max(0, Math.floor(uptimeSeconds));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
  };
}

type HttpClient = Pick<AxiosInstance, 'get'>;

export async function getAdminStatsOverview(client: HttpClient): Promise<AdminStatsOverview> {
  const { data } = await client.get('/admin/stats/overview');
  return AdminStatsOverviewSchema.parse(data);
}

export async function getAdminAnalyticsOverview(
  client: HttpClient,
): Promise<AdminAnalyticsOverview> {
  const { data } = await client.get('/admin/analytics/overview');
  return AdminAnalyticsOverviewSchema.parse(data);
}

export async function getAdminAnalyticsSeries(
  client: HttpClient,
  days: number = SERIES_DEFAULT_DAYS,
): Promise<AdminAnalyticsSeries> {
  const { data } = await client.get('/admin/analytics/series', {
    params: { days: clampSeriesDays(days) },
  });
  return AdminAnalyticsSeriesSchema.parse(data);
}

export async function getAdminAnalyticsQueue(client: HttpClient): Promise<AdminAnalyticsQueue> {
  const { data } = await client.get('/admin/analytics/queue');
  return AdminAnalyticsQueueSchema.parse(data);
}

export interface AdminAuditFilters {
  actor?: string;
  entityType?: string;
  entityId?: string;
  date?: string;
  q?: string;
  sort?: 'newest' | 'oldest';
  limit?: number;
  cursor?: string;
}

export function buildAuditParams(filters: AdminAuditFilters = {}): Record<string, unknown> {
  const params: Record<string, unknown> = { limit: filters.limit ?? AUDIT_STRIP_LIMIT };
  if (filters.actor) params.actor = filters.actor;
  if (filters.entityType) params.entityType = filters.entityType;
  if (filters.entityId) params.entityId = filters.entityId;
  if (filters.date) params.date = filters.date;
  if (filters.q && filters.q.trim() !== '') params.q = filters.q.trim().slice(0, 254);
  if (filters.sort) params.sort = filters.sort;
  if (filters.cursor) params.cursor = filters.cursor;
  return params;
}

export async function listAdminAuditLogs(
  client: HttpClient,
  filters: AdminAuditFilters = {},
): Promise<AdminAuditPage> {
  const { data } = await client.get('/admin/audit-logs', {
    params: buildAuditParams(filters),
  });
  if (Array.isArray(data)) {
    return cursorPage(AdminAuditRowSchema).parse({
      items: data,
      nextCursor: null,
      total: data.length,
    });
  }
  return cursorPage(AdminAuditRowSchema).parse(data);
}

// CSV export params: the active filters plus format=csv (the export streams
// the filtered set server-side as a `text/csv` attachment, same window rule
// as the other admin CSV exports).
export function buildAuditCsvParams(filters: AdminAuditFilters = {}): Record<string, unknown> {
  return { ...buildAuditParams(filters), format: 'csv' };
}

// CSV streams through the single shared blob-download path
// (Content-Disposition filename, triggered save — never navigation).
// Header names are normalized to lowercase (F6 tasks.ts pattern).
export async function exportAdminAuditLogsCsv(
  client: HttpClient,
  filters: AdminAuditFilters = {},
): Promise<string> {
  return downloadBlob(async (url, config) => {
    const response = (await client.get(url, {
      params: config.params,
      responseType: 'blob',
    })) as AxiosResponse<Blob>;
    const raw = response.headers as unknown as {
      toJSON?: () => Record<string, unknown>;
      [key: string]: unknown;
    };
    const source: Record<string, unknown> =
      typeof raw?.toJSON === 'function' ? raw.toJSON() : { ...(raw as object) };
    const headers: Record<string, string | string[] | undefined> = {};
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'string' || Array.isArray(value)) {
        headers[key.toLowerCase()] = value as string | string[];
      }
    }
    return { data: response.data, headers };
  }, '/admin/audit-logs', buildAuditCsvParams(filters));
}
