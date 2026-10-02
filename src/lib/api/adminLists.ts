import { z } from 'zod';
import type { AxiosInstance, AxiosResponse } from 'axios';
import { CursorPageSchema } from './tasks';
import { downloadBlob } from './download';
import { EnrichedExperienceSchema } from './experiences';

// F15 admin-manage module: one typed function per admin list/read/status/
// assign/approve/reject backend endpoint (base `/api/v1`). Verified read-only
// against the archived `admin`, `moderation-actions`, and `notifications`
// specs (no backend edits):
// - GET /admin/volunteers (?q=&wilayaId=&municipalityId=&skillId=&from=&to=
//   &sort=, cursor `cursor`/`limit`, rows join profile + linked account with
//   skill names, location labels, lastActivityAt, email-verified state)
// - GET /admin/volunteers/:volunteerId/experiences (newest-first enriched
//   rows — latest engagement; 404 unknown volunteer, 403 non-admin)
// - GET /admin/users/:userId (no password hash; 404 unknown)
// - PATCH /admin/users/:userId/status ({status: active|suspended, reason?
//   ≤500, notes? ≤2000}; 409 no-op/deleted, DTO rejects other statuses)
// - POST /admin/users/:userId/notice ({message} required non-empty ≤1000,
//   neutral `admin.notice` row, prefs-gated but still 2xx)
// - GET /admin/organizations (?q=&type=&wilayaId=&municipalityId=
//   &verificationStatus=&status=&sort=, cursor `cursor`/`limit`)
// - PATCH /admin/organizations/:organizationId/status (same shape/rules as
//   the user status route; suspended orgs cannot publish)
// - GET /admin/organizations/verifications (?status= default pending,
//   ?assignedAdminId=, oldest-first FIFO queue with org summaries)
// - PATCH /admin/organizations/verifications/:rowId/assign
//   ({assignedAdminId} must be an admin-role user; 404 row, 400 assignee)
// - GET /admin/organizations/:organizationId/verification/latest (newest row
//   by submittedAt; 404 when the org never submitted)
// - POST /admin/organizations/:organizationId/verification/approve (neutral
//   approve; 409 when no pending row or already verified)
// - POST /admin/organizations/:organizationId/verification/reject
//   ({rejectionReason} required; 400 absent, 409 no pending row)
// - GET /admin/opportunities (?q=&status=&organizationId=&sort=,
//   newest-first, rows carry positions/capacity, app counts, location
//   labels, assigned names)
// - PATCH /admin/opportunities/:opportunityId/status ({status:
//   closed|cancelled, reason?, notes?} — force-close via status-PATCH per
//   §A#16, never a close POST; 409 draft/no-op, 404 unknown)
// - GET /admin/status-histories (?entityType=&entityId=, both required,
//   oldest-first rows with from/to/actor/reason/notes)
// - GET /media/:mediaId → `{ media, url }` (dossier read on the admin path)
// - Every list accepts `format=csv` (same filters, streamed `text/csv`
//   attachment, same max page window — never page-size-100)
// Reports/moderation composite actions live in F16 (`adminModeration.ts`);
// analytics in F14 (`adminAnalytics.ts`) — never here (FE file-disjointness).

// Real status vocabularies only — invented states ("Pending", "Incomplete",
// "Legal Review", "Flagged") MUST NOT render (roadmap acceptance).
export const ADMIN_USER_STATUSES = ['active', 'suspended'] as const;

export type AdminUserStatus = (typeof ADMIN_USER_STATUSES)[number];

export const ADMIN_OPP_CLOSE_STATUSES = ['closed', 'cancelled'] as const;

export type AdminOppCloseStatus = (typeof ADMIN_OPP_CLOSE_STATUSES)[number];

export const ADMIN_VERIFICATION_QUEUE_STATUSES = [
  'pending',
  'verified',
  'rejected',
] as const;

export type AdminVerificationQueueStatus =
  (typeof ADMIN_VERIFICATION_QUEUE_STATUSES)[number];

// Page-size discipline: backend window is default 20 / max 50. The UI never
// offers 100; larger requests clamp to 50.
export const ADMIN_LIST_DEFAULT_LIMIT = 20;

export const ADMIN_LIST_MAX_LIMIT = 50;

export function normalizeAdminLimit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) return ADMIN_LIST_DEFAULT_LIMIT;
  return Math.min(
    ADMIN_LIST_MAX_LIMIT,
    Math.max(1, Math.floor(value) || ADMIN_LIST_DEFAULT_LIMIT),
  );
}

export function isAdminUserStatus(value: string): value is AdminUserStatus {
  return (ADMIN_USER_STATUSES as readonly string[]).includes(value);
}

export function isAdminOppCloseStatus(value: string): value is AdminOppCloseStatus {
  return (ADMIN_OPP_CLOSE_STATUSES as readonly string[]).includes(value);
}

export function isAdminVerificationQueueStatus(
  value: string,
): value is AdminVerificationQueueStatus {
  return (ADMIN_VERIFICATION_QUEUE_STATUSES as readonly string[]).includes(value);
}

export const AdminVolunteerStatsSchema = z
  .object({
    completedTasks: z.number().nullable().optional(),
    verifiedExperiences: z.number().nullable().optional(),
    volunteerHours: z.number().nullable().optional(),
  })
  .passthrough();

export type AdminVolunteerStats = z.infer<typeof AdminVolunteerStatsSchema>;

export const AdminVolunteerRowSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    volunteerId: z.string().nullable().optional(),
    userId: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    registryId: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    skillNames: z.array(z.string()).nullable().optional(),
    skills: z.array(z.string()).nullable().optional(),
    wilayaName: z.string().nullable().optional(),
    municipalityName: z.string().nullable().optional(),
    lastActivityAt: z.string().nullable().optional(),
    emailVerifiedAt: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    avatar: z.string().nullable().optional(),
    stats: AdminVolunteerStatsSchema.nullable().optional(),
  })
  .passthrough();

export type AdminVolunteerRow = z.infer<typeof AdminVolunteerRowSchema>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function idString(value: unknown): string | undefined {
  if (typeof value === 'string' && value !== '') return value;
  // Mongoose ObjectIds survive `lean()` as objects until JSON serialization;
  // String() them instead of dropping the reference.
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    try {
      const text = String(value);
      return text !== '' && text !== '[object Object]' ? text : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// The backend list returns NESTED rows `{ profile, user, skillNames,
// wilayaName, municipalityName }` (see backend e2e `admin-lists`: 
// `row.profile.username`, `row.user.email`). Flatten to the stable flat row
// shape every consumer already reads, so no caller branches on the wire
// shape. Flat input (unit stubs) passes through untouched.
export function flattenAdminVolunteerRow(raw: unknown): AdminVolunteerRow {
  const rec = asRecord(raw);
  if (!rec) return AdminVolunteerRowSchema.parse(raw);
  const profile = asRecord(rec.profile);
  const user = asRecord(rec.user);
  if (!profile && !user) return AdminVolunteerRowSchema.parse(raw);
  const merged: Record<string, unknown> = { ...rec };
  const profileId = idString(profile?.['_id']) ?? idString(profile?.id);
  const userId = idString(user?.['_id']) ?? idString(user?.id);
  if (merged.id === undefined && profileId !== undefined) merged.id = profileId;
  if (merged.userId === undefined) {
    merged.userId = userId ?? idString(profile?.userId);
  }
  for (const key of [
    'username',
    'firstName',
    'lastName',
    'registryId',
    'createdAt',
  ] as const) {
    if (merged[key] === undefined || merged[key] === null) {
      const value = nonEmptyString(profile?.[key]);
      if (value !== undefined) merged[key] = value;
    }
  }
  if (merged.avatar === undefined || merged.avatar === null) {
    const avatar = idString(profile?.avatar);
    if (avatar !== undefined) merged.avatar = avatar;
  }
  if (merged.email === undefined) {
    const value = nonEmptyString(user?.email);
    if (value !== undefined) merged.email = value;
  }
  if (merged.phone === undefined) {
    const value = nonEmptyString(user?.phone);
    if (value !== undefined) merged.phone = value;
  }
  if (merged.status === undefined) {
    const value = nonEmptyString(user?.status);
    if (value !== undefined) merged.status = value;
  }
  if (merged.lastActivityAt === undefined) {
    const value = nonEmptyString(user?.lastActivityAt);
    if (value !== undefined) merged.lastActivityAt = value;
  }
  if (merged.emailVerifiedAt === undefined) {
    const value = nonEmptyString(user?.emailVerifiedAt);
    if (value !== undefined) merged.emailVerifiedAt = value;
  }
  if (
    (merged.createdAt === undefined || merged.createdAt === null) &&
    user?.createdAt
  ) {
    const value = nonEmptyString(user.createdAt);
    if (value !== undefined) merged.createdAt = value;
  }
  if (merged.stats === undefined && asRecord(profile?.stats)) {
    merged.stats = profile?.stats;
  }
  return AdminVolunteerRowSchema.parse(merged);
}

export const AdminUserSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    email: z.string().optional(),
    role: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export type AdminUser = z.infer<typeof AdminUserSchema>;

export const AdminOrganizationRowSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    slug: z.string().nullable().optional(),
    nameFr: z.string().nullable().optional(),
    nameAr: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    typeLabel: z.string().nullable().optional(),
    registryId: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    verificationStatus: z.string().nullable().optional(),
    wilayaName: z.string().nullable().optional(),
    municipalityName: z.string().nullable().optional(),
    assignedAdminId: z.string().nullable().optional(),
  })
  .passthrough();

export type AdminOrganizationRow = z.infer<typeof AdminOrganizationRowSchema>;

export const AdminVerificationRowSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    rowId: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    assignedAdminId: z.string().nullable().optional(),
    submittedAt: z.string().nullable().optional(),
    decidedAt: z.string().nullable().optional(),
    decidedBy: z.string().nullable().optional(),
    rejectionReason: z.string().nullable().optional(),
    documents: z.array(z.string()).nullable().optional(),
    organization: z
      .object({
        id: z.string().optional(),
        _id: z.string().optional(),
        slug: z.string().nullable().optional(),
        nameFr: z.string().nullable().optional(),
        nameAr: z.string().nullable().optional(),
        name: z.string().nullable().optional(),
        verificationStatus: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export type AdminVerificationRow = z.infer<typeof AdminVerificationRowSchema>;

export const AdminOpportunityRowSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    title: z.string().nullable().optional(),
    slug: z.string().nullable().optional(),
    registryId: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    organizationId: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    mode: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    durationMinutes: z.number().nullable().optional(),
    applicationDeadline: z.string().nullable().optional(),
    prerequisites: z.array(z.string()).nullable().optional(),
    location: z.unknown().nullable().optional(),
    positions: z.array(z.unknown()).nullable().optional(),
    applicationCount: z.number().nullable().optional(),
    applicationCounts: z.unknown().nullable().optional(),
    organizationName: z.string().nullable().optional(),
    positionsCount: z.number().nullable().optional(),
    capacity: z.number().nullable().optional(),
    filled: z.number().nullable().optional(),
    locationName: z.string().nullable().optional(),
    wilayaName: z.string().nullable().optional(),
    municipalityName: z.string().nullable().optional(),
    assignedNames: z.array(z.string()).nullable().optional(),
  })
  .passthrough();

export type AdminOpportunityRow = z.infer<typeof AdminOpportunityRowSchema>;

// The backend list returns NESTED rows `{ opportunity, organizationName,
// positionsCount, capacity, filled, applicationCount, locationName,
// assignedNames }` (AdminOpportunitiesService.enrich). Flatten the embedded
// opportunity fields to the stable flat row shape every consumer already
// reads, so no caller branches on the wire shape. Flat input (unit stubs,
// e2e mocks) passes through untouched.
export function flattenAdminOpportunityRow(raw: unknown): AdminOpportunityRow {
  const rec = asRecord(raw);
  if (!rec) return AdminOpportunityRowSchema.parse(raw);
  const opportunity = asRecord(rec.opportunity);
  if (!opportunity) return AdminOpportunityRowSchema.parse(raw);
  const merged: Record<string, unknown> = { ...rec };
  const oppId =
    idString(opportunity._id) ?? idString(opportunity.id) ?? idString(rec.id);
  if (oppId !== undefined) merged.id = oppId;
  for (const key of [
    'title',
    'slug',
    'registryId',
    'status',
    'organizationId',
    'categoryId',
    'description',
    'mode',
    'startDate',
    'endDate',
    'durationMinutes',
    'applicationDeadline',
    'prerequisites',
    'location',
    'positions',
  ] as const) {
    if (merged[key] === undefined || merged[key] === null) {
      const value = opportunity[key];
      if (value !== undefined) merged[key] = value;
    }
  }
  return AdminOpportunityRowSchema.parse(merged);
}

export const AdminOpportunityVerificationRowSchema = z
  .object({
    participantId: z.string(),
    volunteerName: z.string().nullable(),
    username: z.string().nullable(),
    volunteerRegistryId: z.string().nullable(),
    positionTitle: z.string().nullable(),
    participationStatus: z.string(),
    submissionStatus: z.string().nullable(),
    submissionTitle: z.string().nullable(),
    verificationCode: z.string().nullable(),
    experienceRegistryId: z.string().nullable(),
    verifiedAt: z.string().nullable(),
  })
  .passthrough();

export type AdminOpportunityVerificationRow = z.infer<
  typeof AdminOpportunityVerificationRowSchema
>;

export const AdminStatusHistoryRowSchema = z
  .object({
    from: z.string().nullable().optional(),
    to: z.string().nullable().optional(),
    actor: z.unknown().nullable().optional(),
    reason: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
  })
  .passthrough();

export type AdminStatusHistoryRow = z.infer<typeof AdminStatusHistoryRowSchema>;

export const AdminDossierMediaSchema = z
  .object({
    media: z.unknown().nullable().optional(),
    url: z.string().nullable().optional(),
  })
  .passthrough();

export type AdminDossierMedia = z.infer<typeof AdminDossierMediaSchema>;

export interface AdminVolunteersFilters {
  q?: string;
  wilayaId?: string;
  municipalityId?: string;
  skillId?: string;
  from?: string;
  to?: string;
  sort?: string;
  cursor?: string;
  limit?: number;
}

export interface AdminOrganizationsFilters {
  q?: string;
  type?: string;
  wilayaId?: string;
  municipalityId?: string;
  verificationStatus?: string;
  status?: string;
  sort?: string;
  cursor?: string;
  limit?: number;
}

export interface AdminVerificationsFilters {
  status?: string;
  assignedAdminId?: string;
  cursor?: string;
  limit?: number;
}

export interface AdminOpportunitiesFilters {
  q?: string;
  status?: string;
  organizationId?: string;
  sort?: string;
  cursor?: string;
  limit?: number;
}

// Pure param builder (unit-tested): drops unset/blank filters, trims `q`
// (≤120 chars), joins multi-value skill ids verbatim, and clamps `limit`
// into the backend 1–50 window (never page-size-100).
export function buildAdminListQuery(filters: {
  q?: string;
  wilayaId?: string;
  municipalityId?: string;
  skillId?: string | string[];
  from?: string;
  to?: string;
  type?: string;
  verificationStatus?: string;
  status?: string;
  assignedAdminId?: string;
  organizationId?: string;
  opportunityId?: string;
  sort?: string;
  cursor?: string;
  limit?: number;
}): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (filters.q && filters.q.trim() !== '')
    params.q = filters.q.trim().slice(0, 120);
  for (const key of [
    'wilayaId',
    'municipalityId',
    'from',
    'to',
    'type',
    'verificationStatus',
    'status',
    'assignedAdminId',
    'organizationId',
    'opportunityId',
    'sort',
    'cursor',
  ] as const) {
    const value = filters[key];
    if (typeof value === 'string' && value.trim() !== '') params[key] = value.trim();
  }
  if (filters.skillId !== undefined) {
    const joined = Array.isArray(filters.skillId)
      ? filters.skillId.filter((s) => s.trim() !== '').join(',')
      : filters.skillId.trim();
    if (joined !== '') params.skillId = joined;
  }
  const limit = normalizeAdminLimit(filters.limit);
  if (limit !== undefined) params.limit = limit;
  return params;
}

// CSV export params: the active filters plus format=csv (the export streams
// the filtered page window server-side as an attachment).
export function buildAdminCsvParams(
  filters: Parameters<typeof buildAdminListQuery>[0],
): Record<string, unknown> {
  return { ...buildAdminListQuery(filters), format: 'csv' };
}

type HttpClient = Pick<AxiosInstance, 'get' | 'patch' | 'post'>;

export interface AdminCursorPage<T> {
  items: T[];
  nextCursor?: string | null;
  limit?: number;
  total: number;
  page?: number;
  pages?: number;
}

export async function listAdminVolunteers(
  client: HttpClient,
  filters: AdminVolunteersFilters = {},
): Promise<AdminCursorPage<AdminVolunteerRow>> {
  const { data } = await client.get('/admin/volunteers', {
    params: buildAdminListQuery(filters),
  });
  const page = CursorPageSchema(AdminVolunteerRowSchema).parse(data);
  // Normalize the nested backend rows once, at the boundary.
  return { ...page, items: page.items.map(flattenAdminVolunteerRow) };
}

export async function getAdminVolunteerExperiences(
  client: HttpClient,
  volunteerId: string,
): Promise<AdminCursorPage<z.infer<typeof EnrichedExperienceSchema>>> {
  const { data } = await client.get(`/admin/volunteers/${volunteerId}/experiences`);
  return CursorPageSchema(EnrichedExperienceSchema).parse(data);
}

export async function getAdminUser(
  client: HttpClient,
  userId: string,
): Promise<AdminUser> {
  const { data } = await client.get(`/admin/users/${userId}`);
  return AdminUserSchema.parse(data);
}

export interface AdminStatusChange {
  status: string;
  reason?: string;
  notes?: string;
}

export async function setAdminUserStatus(
  client: HttpClient,
  userId: string,
  change: AdminStatusChange,
): Promise<AdminUser> {
  const body: Record<string, string> = { status: change.status };
  if (change.reason && change.reason.trim() !== '')
    body.reason = change.reason.trim().slice(0, 500);
  if (change.notes && change.notes.trim() !== '')
    body.notes = change.notes.trim().slice(0, 2000);
  const { data } = await client.patch(`/admin/users/${userId}/status`, body);
  return AdminUserSchema.parse(data);
}

export async function sendAdminNotice(
  client: HttpClient,
  userId: string,
  message: string,
): Promise<unknown> {
  const { data } = await client.post(`/admin/users/${userId}/notice`, {
    message: message.trim().slice(0, 1000),
  });
  return data;
}

export async function listAdminOrganizations(
  client: HttpClient,
  filters: AdminOrganizationsFilters = {},
): Promise<AdminCursorPage<AdminOrganizationRow>> {
  const { data } = await client.get('/admin/organizations', {
    params: buildAdminListQuery(filters),
  });
  return CursorPageSchema(AdminOrganizationRowSchema).parse(data);
}

export async function setAdminOrganizationStatus(
  client: HttpClient,
  organizationId: string,
  change: AdminStatusChange,
): Promise<AdminOrganizationRow> {
  const body: Record<string, string> = { status: change.status };
  if (change.reason && change.reason.trim() !== '')
    body.reason = change.reason.trim().slice(0, 500);
  if (change.notes && change.notes.trim() !== '')
    body.notes = change.notes.trim().slice(0, 2000);
  const { data } = await client.patch(
    `/admin/organizations/${organizationId}/status`,
    body,
  );
  return AdminOrganizationRowSchema.parse(data);
}

export async function listAdminVerifications(
  client: HttpClient,
  filters: AdminVerificationsFilters = {},
): Promise<AdminCursorPage<AdminVerificationRow>> {
  const { data } = await client.get('/admin/organizations/verifications', {
    params: buildAdminListQuery(filters),
  });
  return CursorPageSchema(AdminVerificationRowSchema).parse(data);
}

export async function assignAdminVerification(
  client: HttpClient,
  rowId: string,
  assignedAdminId: string,
): Promise<AdminVerificationRow> {
  const { data } = await client.patch(
    `/admin/organizations/verifications/${rowId}/assign`,
    { assignedAdminId },
  );
  return AdminVerificationRowSchema.parse(data);
}

export async function getAdminLatestDossier(
  client: HttpClient,
  organizationId: string,
): Promise<AdminVerificationRow> {
  const { data } = await client.get(
    `/admin/organizations/${organizationId}/verification/latest`,
  );
  return AdminVerificationRowSchema.parse(data);
}

export async function approveAdminVerification(
  client: HttpClient,
  organizationId: string,
): Promise<AdminVerificationRow> {
  const { data } = await client.post(
    `/admin/organizations/${organizationId}/verification/approve`,
  );
  return AdminVerificationRowSchema.parse(data);
}

export async function rejectAdminVerification(
  client: HttpClient,
  organizationId: string,
  rejectionReason: string,
): Promise<AdminVerificationRow> {
  const { data } = await client.post(
    `/admin/organizations/${organizationId}/verification/reject`,
    { rejectionReason: rejectionReason.trim() },
  );
  return AdminVerificationRowSchema.parse(data);
}

export async function getDossierMedia(
  client: HttpClient,
  mediaId: string,
): Promise<AdminDossierMedia> {
  const { data } = await client.get(`/media/${mediaId}`);
  return AdminDossierMediaSchema.parse(data);
}

export async function listAdminOpportunities(
  client: HttpClient,
  filters: AdminOpportunitiesFilters = {},
): Promise<AdminCursorPage<AdminOpportunityRow>> {
  const { data } = await client.get('/admin/opportunities', {
    params: buildAdminListQuery(filters),
  });
  const page = CursorPageSchema(AdminOpportunityRowSchema).parse(data);
  // Normalize the nested backend rows once, at the boundary.
  return { ...page, items: page.items.map(flattenAdminOpportunityRow) };
}

export async function getAdminOpportunityVerificationStatus(
  client: HttpClient,
  opportunityId: string,
): Promise<AdminOpportunityVerificationRow[]> {
  const { data } = await client.get(
    `/admin/opportunities/${opportunityId}/verification-status`,
  );
  if (Array.isArray(data))
    return z.array(AdminOpportunityVerificationRowSchema).parse(data);
  return z
    .object({ items: z.array(AdminOpportunityVerificationRowSchema) })
    .parse(data).items;
}

export async function setAdminOpportunityStatus(
  client: HttpClient,
  opportunityId: string,
  change: AdminStatusChange,
): Promise<AdminOpportunityRow> {
  const body: Record<string, string> = { status: change.status };
  if (change.reason && change.reason.trim() !== '')
    body.reason = change.reason.trim().slice(0, 500);
  if (change.notes && change.notes.trim() !== '')
    body.notes = change.notes.trim().slice(0, 2000);
  const { data } = await client.patch(
    `/admin/opportunities/${opportunityId}/status`,
    body,
  );
  return AdminOpportunityRowSchema.parse(data);
}

export async function getAdminStatusHistories(
  client: HttpClient,
  entityType: string,
  entityId: string,
): Promise<AdminStatusHistoryRow[]> {
  const { data } = await client.get('/admin/status-histories', {
    params: { entityType, entityId },
  });
  if (Array.isArray(data)) return z.array(AdminStatusHistoryRowSchema).parse(data);
  const page = CursorPageSchema(AdminStatusHistoryRowSchema).parse(data);
  return page.items;
}

// CSV exports stream through the single shared blob-download path
// (Content-Disposition filename, triggered save — never navigation).
async function exportAdminCsv(
  client: HttpClient,
  path: string,
  filters: Parameters<typeof buildAdminListQuery>[0],
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
  }, path, buildAdminCsvParams(filters));
}

export async function exportAdminVolunteersCsv(
  client: HttpClient,
  filters: AdminVolunteersFilters = {},
): Promise<string> {
  return exportAdminCsv(client, '/admin/volunteers', filters);
}

export async function exportAdminOrganizationsCsv(
  client: HttpClient,
  filters: AdminOrganizationsFilters = {},
): Promise<string> {
  return exportAdminCsv(client, '/admin/organizations', filters);
}

export async function exportAdminOpportunitiesCsv(
  client: HttpClient,
  filters: AdminOpportunitiesFilters = {},
): Promise<string> {
  return exportAdminCsv(client, '/admin/opportunities', filters);
}
