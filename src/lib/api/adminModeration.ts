import { z } from 'zod';
import type { AxiosInstance, AxiosResponse } from 'axios';
import { CursorPageSchema } from './tasks';
import { downloadBlob } from './download';

// F16 admin-moderation module: one typed function per reports/moderation/
// settings backend endpoint (base `/api/v1`). Verified read-only against
// backend/src (no edits):
// - admin/reports.controller: GET /admin/reports (ReportsQueryDto:
//   ?status=&targetType=&priority=&assignedAdminId=&q=&from=&to=&sort=
//   (newest|oldest|priority), cursor `cursor`/`limit`/`pageSize`, plus
//   `format=csv` streamed as `text/csv` attachment); PATCH
//   /admin/reports/:reportId/assign (`{assignedAdminId}`); PATCH
//   /admin/reports/:reportId (`{status, resolution?, action?}` where status
//   is in_review|resolved|dismissed — terminal `resolved` calls run through
//   the composite so the suspend-on-report policy default applies; with
//   `action` present `status` MUST be `resolved` and `resolution` MUST be
//   present).
// - admin/users.controller: POST /admin/users/:userId/notice (`{message}`
//   required non-empty ≤1000, prefs-gated neutral `admin.notice` row).
// - admin/reviews.controller: PATCH /admin/reviews/:reviewId/hide (visible
//   → hidden; already-hidden 409; no status_histories row).
// - admin/settings.controller: GET /admin/settings (every row `{key,value}`);
//   PUT /admin/settings/:key (`{value}`, 16-key whitelist + per-key shape
//   validation → 400 UNKNOWN_SETTING_KEY / INVALID_SETTING_VALUE).
// - admin/ops.controller: POST /admin/ops/maintenance (`{enabled, message?}`
//   ≤500, single-flight) → `{enabled, message}`.
// - status-histories read: GET /admin/status-histories
//   (?entityType=&entityId=, both required) for the report history panel.
// - GET /system/status is public and owned by F0 `system.ts`
//   `getSystemStatus` (imported, never redefined) — the live read behind the
//   maintenance toggle + the public-503 spot-check note.
// Neutral action vocabulary only (moderation-action.dto.ts): the four
// registered types + the compatibility matrix. No sanction vocabulary
// anywhere ("Statutory Sanction / 100% compliance / Contact Secretariat"
// forbidden).

export const REPORT_STATUSES = ['open', 'in_review', 'resolved', 'dismissed'] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_RESOLVE_STATUSES = ['in_review', 'resolved', 'dismissed'] as const;

export type ReportResolveStatus = (typeof REPORT_RESOLVE_STATUSES)[number];

export const REPORT_TARGET_TYPES = [
  'opportunity',
  'user',
  'organization',
  'review',
  'submission',
] as const;

export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_PRIORITIES = ['low', 'normal', 'high'] as const;

export type ReportPriority = (typeof REPORT_PRIORITIES)[number];

export const REPORT_SORTS = ['newest', 'oldest', 'priority'] as const;

export type ReportSort = (typeof REPORT_SORTS)[number];

// Neutral moderation action registry (backend moderation-action.dto.ts).
export const MODERATION_ACTION_TYPES = [
  'unpublish_opportunity',
  'close_opportunity',
  'suspend_target',
  'notice',
] as const;

export type ModerationActionType = (typeof MODERATION_ACTION_TYPES)[number];

// Action-target compatibility matrix (backend MODERATION_ACTION_TARGETS).
export const MODERATION_ACTION_TARGETS: Record<ModerationActionType, readonly ReportTargetType[]> = {
  unpublish_opportunity: ['opportunity'],
  close_opportunity: ['opportunity'],
  suspend_target: ['user', 'organization'],
  notice: ['opportunity', 'user', 'organization', 'review', 'submission'],
};

export const ReporterSummarySchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    username: z.string().nullable().optional(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    nameFr: z.string().nullable().optional(),
    nameAr: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
  })
  .passthrough();

export type ReporterSummary = z.infer<typeof ReporterSummarySchema>;

export const ReportTargetSummarySchema = z
  .object({
    type: z.string().nullable().optional(),
    targetType: z.string().nullable().optional(),
    id: z.string().optional(),
    _id: z.string().optional(),
    targetId: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    nameFr: z.string().nullable().optional(),
    nameAr: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
  })
  .passthrough();

export type ReportTargetSummary = z.infer<typeof ReportTargetSummarySchema>;

export const AdminReportSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    status: z.string(),
    targetType: z.string().optional(),
    targetId: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    priority: z.string().nullable().optional(),
    assignedAdminId: z.string().nullable().optional(),
    resolution: z.string().nullable().optional(),
    reporterId: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    reporter: ReporterSummarySchema.nullable().optional(),
    target: ReportTargetSummarySchema.nullable().optional(),
    targetSummary: ReportTargetSummarySchema.nullable().optional(),
  })
  .passthrough();

export type AdminReport = z.infer<typeof AdminReportSchema>;

export const ModerationNoticePayloadSchema = z
  .object({
    userId: z.string(),
    message: z.string(),
  })
  .passthrough();

export type ModerationNoticePayload = z.infer<typeof ModerationNoticePayloadSchema>;

export const ModerationActionSchema = z
  .object({
    type: z.string(),
    payload: ModerationNoticePayloadSchema.nullable().optional(),
  })
  .passthrough();

export type ModerationAction = z.infer<typeof ModerationActionSchema>;

export const AdminSettingSchema = z
  .object({
    key: z.string(),
    value: z.unknown(),
  })
  .passthrough();

export type AdminSetting = z.infer<typeof AdminSettingSchema>;

export const MaintenanceStateSchema = z
  .object({
    enabled: z.boolean(),
    message: z.string().optional(),
  })
  .passthrough();

export type MaintenanceState = z.infer<typeof MaintenanceStateSchema>;

export const StatusHistoryRowSchema = z
  .object({
    from: z.string().nullable().optional(),
    to: z.string().nullable().optional(),
    actor: z.unknown().nullable().optional(),
    reason: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    createdAt: z.string().optional(),
  })
  .passthrough();

export type StatusHistoryRow = z.infer<typeof StatusHistoryRowSchema>;

export function reportIdOf(row: { id?: string; _id?: string }): string {
  return row.id ?? row._id ?? '';
}

// Target-entity id for consequence re-reads: the report's `targetId` first,
// then the embedded target summary id.
export function reportTargetIdOf(row: AdminReport): string {
  if (typeof row.targetId === 'string' && row.targetId !== '') return row.targetId;
  const target = row.target ?? row.targetSummary ?? undefined;
  if (!target) return '';
  return target.targetId ?? target.id ?? target._id ?? '';
}

export function reporterNameOf(reporter: ReporterSummary | null | undefined): string {
  if (!reporter) return '';
  return (
    reporter.username ??
    reporter.name ??
    reporter.nameFr ??
    reporter.nameAr ??
    [reporter.firstName, reporter.lastName].filter(Boolean).join(' ') ??
    ''
  );
}

export function targetLabelOf(target: ReportTargetSummary | null | undefined): string {
  if (!target) return '';
  return (
    target.title ??
    target.name ??
    target.nameFr ??
    target.nameAr ??
    target.username ??
    target.targetId ??
    target.id ??
    target._id ??
    ''
  );
}

export interface AdminReportFilters {
  status?: string;
  targetType?: string;
  priority?: string;
  assignedAdminId?: string;
  q?: string;
  from?: string;
  to?: string;
  sort?: string;
  cursor?: string;
  limit?: number;
}

// Pure param builder (unit-tested): drops unset/blank filters and rejects
// off-vocabulary status/targetType/priority/sort values (the backend
// IsIn-guards them with 400) so the query string carries only real
// constraints.
export function buildReportListParams(filters: AdminReportFilters): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (filters.status && (REPORT_STATUSES as readonly string[]).includes(filters.status)) {
    params.status = filters.status;
  }
  if (
    filters.targetType &&
    (REPORT_TARGET_TYPES as readonly string[]).includes(filters.targetType)
  ) {
    params.targetType = filters.targetType;
  }
  if (filters.priority && (REPORT_PRIORITIES as readonly string[]).includes(filters.priority)) {
    params.priority = filters.priority;
  }
  if (filters.assignedAdminId && filters.assignedAdminId.trim() !== '') {
    params.assignedAdminId = filters.assignedAdminId.trim();
  }
  if (filters.q && filters.q.trim() !== '') params.q = filters.q.trim().slice(0, 254);
  if (filters.from && filters.from.trim() !== '') params.from = filters.from.trim();
  if (filters.to && filters.to.trim() !== '') params.to = filters.to.trim();
  if (filters.sort && (REPORT_SORTS as readonly string[]).includes(filters.sort)) {
    params.sort = filters.sort;
  }
  if (filters.cursor) params.cursor = filters.cursor;
  if (filters.limit !== undefined) params.limit = filters.limit;
  return params;
}

// CSV export params: the active filters plus format=csv (the export streams
// the filtered set server-side as a `text/csv` attachment).
export function buildReportCsvParams(filters: AdminReportFilters): Record<string, unknown> {
  return { ...buildReportListParams(filters), format: 'csv' };
}

// Resolution notes: required (non-empty, ≤4000) whenever an action rides
// along; the resolve control stays disabled otherwise (backend would 400).
export function isResolutionValid(resolution: string): boolean {
  const trimmed = resolution.trim();
  return trimmed.length > 0 && trimmed.length <= 4000;
}

// Standalone notices: required non-empty ≤1000 (backend AdminNoticeDto).
export function isNoticeValid(message: string): boolean {
  const trimmed = message.trim();
  return trimmed.length > 0 && trimmed.length <= 1000;
}

// Maintenance messages: optional, ≤500 chars (backend MaintenanceToggleDto).
export function isMaintenanceMessageValid(message: string): boolean {
  return message.length <= 500;
}

// Compatibility matrix guard (unit-tested): unknown action types and
// action/target mismatches are blocked client-side before any request —
// the backend answers 400 INCOMPATIBLE_MODERATION_ACTION otherwise.
export function isCompatibleActionTarget(actionType: string, targetType: string): boolean {
  if (!(MODERATION_ACTION_TYPES as readonly string[]).includes(actionType)) return false;
  const allowed = MODERATION_ACTION_TARGETS[actionType as ModerationActionType];
  return (allowed as readonly string[]).includes(targetType);
}

export interface ResolveActionInput {
  actionType: ModerationActionType | '';
  noticeUserId?: string;
  noticeMessage?: string;
}

// Builds the `action` envelope for PATCH /admin/reports/:reportId, or null
// when no consequence is requested. Returns null for unknown types,
// incompatible targets, and notice payloads missing userId/message — the
// caller keeps the resolve control disabled instead of sending a 400.
export function buildResolveActionPayload(
  input: ResolveActionInput,
  targetType: string,
): ModerationAction | null {
  if (input.actionType === '' || input.actionType === undefined) return null;
  if (!isCompatibleActionTarget(input.actionType, targetType)) return null;
  if (input.actionType === 'notice') {
    const userId = (input.noticeUserId ?? '').trim();
    const message = (input.noticeMessage ?? '').trim();
    if (userId === '' || !isNoticeValid(message)) return null;
    return { type: 'notice', payload: { userId, message } };
  }
  return { type: input.actionType };
}

// Whether resolve-with-action may be sent: status MUST be `resolved` when an
// action is present, and `resolution` MUST be present with it (backend rule).
export function canResolveWithPayload(
  status: string,
  resolution: string,
  action: ModerationAction | null,
): boolean {
  if (!(REPORT_RESOLVE_STATUSES as readonly string[]).includes(status)) return false;
  if (action !== null) {
    if (status !== 'resolved') return false;
    return isResolutionValid(resolution);
  }
  return true;
}

// --- Canonical settings key registry (16 keys, backend system-settings) ---

export const SETTING_KIND_TEXT = 'text';
export const SETTING_KIND_NUMBER = 'number';
export const SETTING_KIND_BOOLEAN = 'boolean';
export const SETTING_KIND_LANGUAGE = 'language';
export const SETTING_KIND_TIMEZONE = 'timezone';
export const SETTING_KIND_DATE_FORMAT = 'dateFormat';

export type SettingKind =
  | typeof SETTING_KIND_TEXT
  | typeof SETTING_KIND_NUMBER
  | typeof SETTING_KIND_BOOLEAN
  | typeof SETTING_KIND_LANGUAGE
  | typeof SETTING_KIND_TIMEZONE
  | typeof SETTING_KIND_DATE_FORMAT;

export interface SettingKeyDef {
  key: string;
  kind: SettingKind;
  integer?: boolean;
  positive?: boolean;
  maxLength?: number;
}

export const ADMIN_SETTING_KEYS: SettingKeyDef[] = [
  { key: 'publishGate.maxPendingOpportunities', kind: SETTING_KIND_NUMBER, integer: true, positive: true },
  { key: 'platform.name', kind: SETTING_KIND_TEXT, maxLength: 200 },
  { key: 'platform.summary', kind: SETTING_KIND_TEXT, maxLength: 2000 },
  { key: 'platform.contactEmail', kind: SETTING_KIND_TEXT, maxLength: 254 },
  { key: 'locale.defaultLanguage', kind: SETTING_KIND_LANGUAGE },
  { key: 'locale.defaultTimezone', kind: SETTING_KIND_TIMEZONE },
  { key: 'locale.dateFormat', kind: SETTING_KIND_DATE_FORMAT },
  { key: 'auth.adminSessionDurationDays', kind: SETTING_KIND_NUMBER, integer: true, positive: true },
  { key: 'moderation.requireVerifiedEmail', kind: SETTING_KIND_BOOLEAN },
  { key: 'moderation.suspendOnReport', kind: SETTING_KIND_BOOLEAN },
  { key: 'ops.registrationEnabled', kind: SETTING_KIND_BOOLEAN },
  { key: 'ops.publishingEnabled', kind: SETTING_KIND_BOOLEAN },
  { key: 'maintenance.enabled', kind: SETTING_KIND_BOOLEAN },
  { key: 'maintenance.message', kind: SETTING_KIND_TEXT, maxLength: 500 },
  { key: 'notifications.digest.enabled', kind: SETTING_KIND_BOOLEAN },
  { key: 'notifications.digest.intervalDays', kind: SETTING_KIND_NUMBER, integer: true, positive: true },
];

export const SETTING_LANGUAGES = ['en', 'ar'] as const;

export const SETTING_DATE_FORMATS = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'] as const;

export function settingDefOf(key: string): SettingKeyDef | undefined {
  return ADMIN_SETTING_KEYS.find((def) => def.key === key);
}

export function isKnownSettingKey(key: string): boolean {
  return settingDefOf(key) !== undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

// Per-key shape validation (unit-tested): unknown keys never validate;
// wrong-shaped values are blocked with per-key neutral messages before any
// request (backend would 400 UNKNOWN_SETTING_KEY / INVALID_SETTING_VALUE).
export function validateSettingValue(key: string, value: unknown): boolean {
  const def = settingDefOf(key);
  if (!def) return false;
  switch (def.kind) {
    case SETTING_KIND_BOOLEAN:
      return typeof value === 'boolean';
    case SETTING_KIND_NUMBER: {
      if (!isFiniteNumber(value)) return false;
      if (def.integer && !Number.isInteger(value)) return false;
      if (def.positive && value <= 0) return false;
      return true;
    }
    case SETTING_KIND_LANGUAGE:
      return typeof value === 'string' && (SETTING_LANGUAGES as readonly string[]).includes(value);
    case SETTING_KIND_DATE_FORMAT:
      return typeof value === 'string' && (SETTING_DATE_FORMATS as readonly string[]).includes(value);
    case SETTING_KIND_TIMEZONE:
      return typeof value === 'string' && value.trim().length > 0 && value.length <= 100;
    case SETTING_KIND_TEXT: {
      if (typeof value !== 'string') return false;
      if (def.maxLength !== undefined && value.length > def.maxLength) return false;
      return true;
    }
    default:
      return false;
  }
}

// Coerces raw editor strings into the key's typed value (boolean switches
// already carry booleans; number inputs arrive as strings).
export function coerceSettingValue(key: string, raw: unknown): unknown {
  const def = settingDefOf(key);
  if (!def) return raw;
  if (def.kind === SETTING_KIND_NUMBER && typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? raw : parsed;
  }
  return raw;
}

type HttpClient = Pick<AxiosInstance, 'get' | 'patch' | 'post' | 'put'>;

export interface AdminReportPage {
  items: AdminReport[];
  nextCursor?: string | null;
  limit?: number;
  total: number;
  page?: number;
  pages?: number;
}

export async function listAdminReports(
  client: HttpClient,
  filters: AdminReportFilters = {},
): Promise<AdminReportPage> {
  const { data } = await client.get('/admin/reports', {
    params: buildReportListParams(filters),
  });
  if (Array.isArray(data)) {
    return { items: z.array(AdminReportSchema).parse(data), nextCursor: null, total: data.length };
  }
  return CursorPageSchema(AdminReportSchema).parse(data);
}

// CSV streams through the single shared blob-download path
// (Content-Disposition filename, triggered save — never navigation).
// Header names are normalized to lowercase (F6 tasks.ts pattern).
export async function exportAdminReportsCsv(
  client: HttpClient,
  filters: AdminReportFilters = {},
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
  }, '/admin/reports', buildReportCsvParams(filters));
}

export async function assignAdminReport(
  client: HttpClient,
  reportId: string,
  input: { assignedAdminId: string },
): Promise<AdminReport> {
  const { data } = await client.patch(
    `/admin/reports/${encodeURIComponent(reportId)}/assign`,
    { assignedAdminId: input.assignedAdminId },
  );
  return AdminReportSchema.parse(data);
}

export interface ResolveReportInput {
  status: ReportResolveStatus;
  resolution?: string;
  action?: ModerationAction | null;
}

export async function resolveAdminReport(
  client: HttpClient,
  reportId: string,
  input: ResolveReportInput,
): Promise<AdminReport> {
  const body: Record<string, unknown> = { status: input.status };
  if (input.resolution !== undefined) body.resolution = input.resolution;
  if (input.action !== undefined && input.action !== null) body.action = input.action;
  const { data } = await client.patch(
    `/admin/reports/${encodeURIComponent(reportId)}`,
    body,
  );
  return AdminReportSchema.parse(data);
}

export async function sendAdminNotice(
  client: HttpClient,
  userId: string,
  input: { message: string },
): Promise<{ delivered: boolean }> {
  const { data } = await client.post(`/admin/users/${encodeURIComponent(userId)}/notice`, {
    message: input.message,
  });
  return z.object({ delivered: z.boolean() }).passthrough().parse(data);
}

export async function hideAdminReview(client: HttpClient, reviewId: string): Promise<unknown> {
  const { data } = await client.patch(
    `/admin/reviews/${encodeURIComponent(reviewId)}/hide`,
  );
  return data;
}

export interface StatusHistoryQuery {
  entityType: string;
  entityId: string;
}

// Consequence assertion reads (unit: none needed — thin wrappers): the
// backend writes one `status_histories` row per transitioned entity carrying
// the report `resolution` as its reason, so the report history
// (`entityType=reports`) plus the target-entity history re-read is the
// atomicity proof — the mutation echo is never trusted alone.
export async function readStatusHistories(
  client: HttpClient,
  query: StatusHistoryQuery,
): Promise<StatusHistoryRow[]> {
  const { data } = await client.get('/admin/status-histories', {
    params: { entityType: query.entityType, entityId: query.entityId },
  });
  if (Array.isArray(data)) return z.array(StatusHistoryRowSchema).parse(data);
  const page = CursorPageSchema(StatusHistoryRowSchema).parse(data);
  return page.items;
}

export async function listAdminSettings(client: HttpClient): Promise<AdminSetting[]> {
  const { data } = await client.get('/admin/settings');
  if (Array.isArray(data)) return z.array(AdminSettingSchema).parse(data);
  return [];
}

export async function updateAdminSetting(
  client: HttpClient,
  key: string,
  value: unknown,
): Promise<AdminSetting> {
  const { data } = await client.put(`/admin/settings/${encodeURIComponent(key)}`, { value });
  return AdminSettingSchema.parse(data);
}

export async function toggleMaintenance(
  client: HttpClient,
  input: { enabled: boolean; message?: string },
): Promise<MaintenanceState> {
  const body: Record<string, unknown> = { enabled: input.enabled };
  if (input.message !== undefined) body.message = input.message;
  const { data } = await client.post('/admin/ops/maintenance', body);
  return MaintenanceStateSchema.parse(data);
}
