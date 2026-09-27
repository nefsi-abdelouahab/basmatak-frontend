import axios from 'axios';
import { z } from 'zod';
import type { AxiosInstance } from 'axios';

// F10 org-opportunities module: one typed function per org-side opportunity
// endpoint owned by this session (base `/api/v1`). Verified read-only against
// backend/src/opportunities (controller + opportunity.dto.ts + service),
// backend/src/trust (trust.controller.ts + trust-publish-gate.service.ts),
// backend/src/skills (skill-categories.controller.ts), backend/src/locations
// and backend/src/media:
// - POST /organizations/me/opportunities (draft create, full v2 payload)
// - GET /organizations/me/opportunities (?status=&q=&sort=newest|oldest&cursor=
//   &limit=, CursorPage, all statuses) + GET .../:id (owner read incl. drafts)
// - PATCH /opportunities/:opportunityId (positions/slug/status never allowed;
//   mode/prerequisites/durationMinutes/endDate 409 OPPORTUNITY_FIELD_LOCKED
//   once published) + DELETE /opportunities/:opportunityId (204, draft only)
// - POST /opportunities/:opportunityId/publish|close|cancel|complete (publish
//   requires verified+active org, 403 ORG_NOT_VERIFIED; gate locked 409
//   PUBLISH_GATE_LOCKED; kill-switch 403 PUBLISHING_DISABLED)
// - Positions (positions.controller.ts — POST + PATCH + DELETE only, no PUT):
//   POST /opportunities/:opportunityId/positions,
//   PATCH/DELETE /opportunities/:opportunityId/positions/:positionId
// - POST /organizations/me/opportunities/:id/duplicate (independent draft,
//   fresh slug + registryId, filledCount zeroed, cover + content carried over)
// - GET /skill-categories (ObjectId category select), GET /locations/wilayas
//   (+ /:wilayaId/municipalities), POST /media/uploads (purpose
//   `opportunity_cover`) → PUT bytes → POST /media/:mediaId/confirm,
//   GET /organizations/me/publish-gate → PublishGateStatus
//   { locked, pendingCount, threshold, pendingOpportunities[] }.
//
// NOTE: sibling-session files are never imported here (FD file-disjointness,
// D1 pattern) — the small reference/upload readers below are scoped to this
// module, mirroring the F3 precedent in lib/api/organizations.ts.

export const OPPORTUNITY_MODES = ['onsite', 'remote', 'hybrid'] as const;

export type OpportunityMode = (typeof OPPORTUNITY_MODES)[number];

export const OWN_OPPORTUNITY_SORTS = ['newest', 'oldest'] as const;

export type OwnOpportunitySort = (typeof OWN_OPPORTUNITY_SORTS)[number];

export const OWNER_OPPORTUNITY_STATUSES = [
  'draft',
  'published',
  'in_progress',
  'completed',
  'closed',
  'cancelled',
] as const;

export type OwnerOpportunityStatus = (typeof OWNER_OPPORTUNITY_STATUSES)[number];

// Fields the backend rejects with 409 OPPORTUNITY_FIELD_LOCKED once the
// opportunity is published (verified in opportunities.service.spec.ts).
export const FIELDS_LOCKED_AFTER_PUBLISH = [
  'mode',
  'prerequisites',
  'durationMinutes',
  'endDate',
] as const;

export type LockedAfterPublishField = (typeof FIELDS_LOCKED_AFTER_PUBLISH)[number];

export const OPPORTUNITY_PURPOSE = 'opportunity_cover' as const;

export const MAX_COVER_BYTES = 5 * 1024 * 1024;

export const COVER_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type CoverMime = (typeof COVER_MIMES)[number];

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export function validateCoverFile(file: {
  name: string;
  type: string;
  size: number;
}): { ok: true } | { ok: false; reason: 'type' | 'size' } {
  if (!(COVER_MIMES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: 'type' };
  }
  if (file.size < 1 || file.size > MAX_COVER_BYTES) {
    return { ok: false, reason: 'size' };
  }
  return { ok: true };
}

export const OwnerPositionSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    requiredCount: z.number().optional(),
    filledCount: z.number().optional(),
    requiredSkills: z.array(z.unknown()).nullable().optional(),
    deliverables: z.array(z.string()).nullable().optional(),
    startAt: z.string().nullable().optional(),
    applicationCount: z.number().nullable().optional(),
  })
  .passthrough();

export type OwnerPosition = z.infer<typeof OwnerPositionSchema>;

export function positionIdOf(p: OwnerPosition): string {
  return (p.id ?? p._id ?? '') as string;
}

export const OwnerOpportunitySchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    slug: z.string().optional(),
    title: z.string(),
    description: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    registryId: z.string().nullable().optional(),
    status: z.string().optional(),
    mode: z.string().nullable().optional(),
    coverMediaId: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    applicationDeadline: z.string().nullable().optional(),
    durationMinutes: z.number().nullable().optional(),
    prerequisites: z.array(z.string()).nullable().optional(),
    location: z
      .object({
        wilayaId: z.string().nullable().optional(),
        municipalityId: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    positions: z.array(OwnerPositionSchema).nullable().optional(),
    applicationCount: z.number().nullable().optional(),
    participantCount: z.number().nullable().optional(),
  })
  .passthrough();

export type OwnerOpportunity = z.infer<typeof OwnerOpportunitySchema>;

export function opportunityIdOf(o: OwnerOpportunity): string {
  return (o.id ?? o._id ?? '') as string;
}

export function opportunityStatusOf(o: OwnerOpportunity): string {
  return o.status ?? 'draft';
}

export function opportunityRefOf(o: OwnerOpportunity): string {
  return o.registryId ? `OPP-${o.registryId}` : '';
}

export const CursorPageSchema = <Item extends z.ZodTypeAny>(itemSchema: Item) =>
  z
    .object({
      items: z.array(itemSchema),
      nextCursor: z.string().nullable().optional(),
      limit: z.number().optional(),
      total: z.number().optional(),
      page: z.number().optional(),
      pages: z.number().optional(),
    })
    .passthrough();

export type OwnerOpportunityPage = {
  items: OwnerOpportunity[];
  nextCursor?: string | null;
  limit?: number;
  total?: number;
  page?: number;
  pages?: number;
};

export interface OwnOpportunityFilters {
  q?: string;
  sort?: string;
  status?: string;
  cursor?: string;
  limit?: number;
}

// Client-side query builder for GET /organizations/me/opportunities.
// Mirrors OwnOpportunityQueryDto: q ≤200, sort ∈ {newest, oldest}, limit 1–50
// (default 20). Unknown sort values are dropped, never sent.
export function buildOwnOpportunityParams(filters: OwnOpportunityFilters): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  const q = (filters.q ?? '').trim();
  if (q !== '') params.q = q.slice(0, 200);
  if (filters.status && (OWNER_OPPORTUNITY_STATUSES as readonly string[]).includes(filters.status)) {
    params.status = filters.status;
  }
  if (filters.sort && (OWN_OPPORTUNITY_SORTS as readonly string[]).includes(filters.sort)) {
    params.sort = filters.sort;
  }
  if (filters.cursor) params.cursor = filters.cursor;
  const limit = filters.limit ?? 20;
  params.limit = Math.min(50, Math.max(1, Math.floor(limit) || 20));
  return params;
}

export const CreatePositionInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  requiredCount: z.number().int().min(1),
  requiredSkills: z.array(z.string().regex(OBJECT_ID)).optional(),
  deliverables: z.array(z.string()).optional(),
  startAt: z.string().optional(),
});

export type CreatePositionInput = z.infer<typeof CreatePositionInputSchema>;

export const UpdatePositionInputSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  requiredCount: z.number().int().min(1).optional(),
  requiredSkills: z.array(z.string().regex(OBJECT_ID)).optional(),
  deliverables: z.array(z.string()).optional(),
  startAt: z.string().optional(),
});

export type UpdatePositionInput = z.infer<typeof UpdatePositionInputSchema>;

export const CreateOpportunityInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  categoryId: z.string().regex(OBJECT_ID).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  durationMinutes: z.number().int().min(1).optional(),
  mode: z.enum(OPPORTUNITY_MODES).optional(),
  coverMediaId: z.string().regex(OBJECT_ID).optional(),
  prerequisites: z.array(z.string()).optional(),
  applicationDeadline: z.string().optional(),
  location: z
    .object({
      wilayaId: z.string().optional(),
      municipalityId: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  positions: z.array(CreatePositionInputSchema).min(1).optional(),
});

export type CreateOpportunityInput = z.infer<typeof CreateOpportunityInputSchema>;

export const UpdateOpportunityInputSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  categoryId: z.string().regex(OBJECT_ID).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  durationMinutes: z.number().int().min(1).optional(),
  mode: z.enum(OPPORTUNITY_MODES).optional(),
  coverMediaId: z.string().regex(OBJECT_ID).optional(),
  prerequisites: z.array(z.string()).optional(),
  applicationDeadline: z.string().optional(),
  location: z
    .object({
      wilayaId: z.string().optional(),
      municipalityId: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
});

export type UpdateOpportunityInput = z.infer<typeof UpdateOpportunityInputSchema>;

// Client-side position guard (mirrors CreatePositionDto/UpdatePositionDto):
// title non-empty ≤200, requiredCount int ≥1 (never below filled on update),
// deliverables strings, startAt ISO date when present.
export function positionInputIssues(input: {
  title?: string;
  requiredCount?: number;
  filledCount?: number;
  deliverables?: unknown;
  startAt?: string;
}): string[] {
  const issues: string[] = [];
  if (input.title !== undefined && (input.title.trim() === '' || input.title.length > 200)) {
    issues.push('title');
  }
  if (input.requiredCount !== undefined) {
    if (!Number.isInteger(input.requiredCount) || input.requiredCount < 1) {
      issues.push('requiredCount');
    } else if (input.filledCount !== undefined && input.requiredCount < input.filledCount) {
      issues.push('requiredCount');
    }
  }
  if (input.deliverables !== undefined) {
    if (!Array.isArray(input.deliverables) || input.deliverables.some((d) => typeof d !== 'string')) {
      issues.push('deliverables');
    }
  }
  if (input.startAt !== undefined && input.startAt !== '' && Number.isNaN(Date.parse(input.startAt))) {
    issues.push('startAt');
  }
  return issues;
}

export const SkillCategorySchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    nameFr: z.string().optional(),
    nameAr: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough();

export type SkillCategory = z.infer<typeof SkillCategorySchema>;

export function skillCategoryIdOf(c: SkillCategory): string {
  return (c.id ?? c._id ?? '') as string;
}

export function skillCategoryLabelOf(c: SkillCategory, locale: string): string {
  if (locale === 'ar') return c.nameAr ?? c.nameFr ?? c.name ?? '';
  return c.nameFr ?? c.nameAr ?? c.name ?? '';
}

export const LocationRowSchema = z
  .object({
    code: z.string(),
    nameFr: z.string(),
    nameAr: z.string(),
  })
  .passthrough();

export type LocationRow = z.infer<typeof LocationRowSchema>;

export const PendingOpportunitySchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
  })
  .passthrough();

export type PendingOpportunity = z.infer<typeof PendingOpportunitySchema>;

// Verified shape of GET /organizations/me/publish-gate
// (TrustPublishGateService.status): `locked === false` means publishing is
// allowed. Locked when pending distinct-opportunity count reaches the
// `publishGate.maxPendingOpportunities` setting (default 3) or the demo lock.
export const PublishGateStatusSchema = z
  .object({
    locked: z.boolean(),
    pendingCount: z.number(),
    threshold: z.number(),
    pendingOpportunities: z.array(PendingOpportunitySchema),
  })
  .passthrough();

export type PublishGateStatus = z.infer<typeof PublishGateStatusSchema>;

export function isPublishAllowed(gate: PublishGateStatus | undefined): boolean {
  return gate !== undefined && gate.locked === false;
}

export const OwnOrgGateSchema = z
  .object({
    verificationStatus: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export type OwnOrgGate = z.infer<typeof OwnOrgGateSchema>;

export interface LifecycleAvailability {
  canPublish: boolean;
  publishLockedReason: 'status' | 'unverified' | 'gate-locked' | null;
  canDeleteDraft: boolean;
  canClose: boolean;
  canCancel: boolean;
  canComplete: boolean;
}

// Pure lifecycle matrix (spec: org-opportunity-editor): draft + verified org +
// unlocked gate → publish/delete-draft; draft otherwise → locked with a reason;
// published → close/cancel/complete; closed/cancelled/completed/in_progress →
// no lifecycle actions.
export function lifecycleAvailability(
  status: string | undefined,
  verificationStatus: string | undefined,
  publishGateLocked: boolean | undefined,
): LifecycleAvailability {
  const none: LifecycleAvailability = {
    canPublish: false,
    publishLockedReason: 'status',
    canDeleteDraft: false,
    canClose: false,
    canCancel: false,
    canComplete: false,
  };
  if (status === 'published') {
    return { ...none, publishLockedReason: null, canClose: true, canCancel: true, canComplete: true };
  }
  if (status === undefined || status === 'draft') {
    const verified = verificationStatus === 'verified';
    if (!verified) {
      return { ...none, publishLockedReason: 'unverified', canDeleteDraft: true };
    }
    if (publishGateLocked === true) {
      return { ...none, publishLockedReason: 'gate-locked', canDeleteDraft: true };
    }
    if (publishGateLocked === false) {
      return {
        canPublish: true,
        publishLockedReason: null,
        canDeleteDraft: true,
        canClose: false,
        canCancel: false,
        canComplete: false,
      };
    }
    return { ...none, publishLockedReason: 'gate-locked', canDeleteDraft: true };
  }
  return none;
}

export const CoverUploadTicketSchema = z.object({
  mediaId: z.string(),
  uploadUrl: z.string().url(),
});

export type CoverUploadTicket = z.infer<typeof CoverUploadTicketSchema>;

export interface UploadProgress {
  loaded: number;
  total?: number;
  percent: number;
}

type HttpClient = Pick<AxiosInstance, 'get' | 'post' | 'patch' | 'delete'>;

export async function listOwnOpportunities(
  client: HttpClient,
  filters?: OwnOpportunityFilters,
): Promise<OwnerOpportunityPage> {
  const { data } = await client.get('/organizations/me/opportunities', {
    params: buildOwnOpportunityParams(filters ?? {}),
  });
  return CursorPageSchema(OwnerOpportunitySchema).parse(data);
}

export async function getOwnOpportunity(client: HttpClient, id: string): Promise<OwnerOpportunity> {
  const { data } = await client.get(`/organizations/me/opportunities/${id}`);
  return OwnerOpportunitySchema.parse(data);
}

export async function createOpportunity(
  client: HttpClient,
  input: CreateOpportunityInput,
): Promise<OwnerOpportunity> {
  const { data } = await client.post('/organizations/me/opportunities', input);
  return OwnerOpportunitySchema.parse(data);
}

export async function patchOpportunity(
  client: HttpClient,
  opportunityId: string,
  input: UpdateOpportunityInput,
): Promise<OwnerOpportunity> {
  const { data } = await client.patch(`/opportunities/${opportunityId}`, input);
  return OwnerOpportunitySchema.parse(data);
}

export async function deleteDraftOpportunity(client: HttpClient, opportunityId: string): Promise<void> {
  await client.delete(`/opportunities/${opportunityId}`);
}

export type LifecycleAction = 'publish' | 'close' | 'cancel' | 'complete';

export async function runLifecycleAction(
  client: HttpClient,
  opportunityId: string,
  action: LifecycleAction,
): Promise<OwnerOpportunity> {
  const { data } = await client.post(`/opportunities/${opportunityId}/${action}`, {});
  return OwnerOpportunitySchema.parse(data);
}

export async function createPosition(
  client: HttpClient,
  opportunityId: string,
  input: CreatePositionInput,
): Promise<OwnerPosition> {
  const { data } = await client.post(`/opportunities/${opportunityId}/positions`, input);
  return OwnerPositionSchema.parse(data);
}

export async function patchPosition(
  client: HttpClient,
  opportunityId: string,
  positionId: string,
  input: UpdatePositionInput,
): Promise<OwnerPosition> {
  const { data } = await client.patch(
    `/opportunities/${opportunityId}/positions/${positionId}`,
    input,
  );
  return OwnerPositionSchema.parse(data);
}

export async function deletePosition(
  client: HttpClient,
  opportunityId: string,
  positionId: string,
): Promise<void> {
  await client.delete(`/opportunities/${opportunityId}/positions/${positionId}`);
}

export async function duplicateOpportunity(
  client: HttpClient,
  id: string,
): Promise<OwnerOpportunity> {
  const { data } = await client.post(`/organizations/me/opportunities/${id}/duplicate`, {});
  return OwnerOpportunitySchema.parse(data);
}

export async function listSkillCategories(client: HttpClient): Promise<SkillCategory[]> {
  const { data } = await client.get('/skill-categories');
  return z.array(SkillCategorySchema).parse(data);
}

export async function listWilayas(client: HttpClient): Promise<LocationRow[]> {
  const { data } = await client.get('/locations/wilayas');
  return z.array(LocationRowSchema).parse(data);
}

export async function listMunicipalities(
  client: HttpClient,
  wilayaId: string,
): Promise<LocationRow[]> {
  const { data } = await client.get(`/locations/wilayas/${wilayaId}/municipalities`);
  return z.array(LocationRowSchema).parse(data);
}

export async function getPublishGate(client: HttpClient): Promise<PublishGateStatus> {
  const { data } = await client.get('/organizations/me/publish-gate');
  return PublishGateStatusSchema.parse(data);
}

export async function getOwnOrgGate(client: HttpClient): Promise<OwnOrgGate> {
  const { data } = await client.get('/organizations/me');
  return OwnOrgGateSchema.parse(data);
}

export async function createCoverUpload(
  client: Pick<AxiosInstance, 'post'>,
  input: { filename: string; mimeType: string; size: number },
): Promise<CoverUploadTicket> {
  const { data } = await client.post('/media/uploads', { ...input, purpose: OPPORTUNITY_PURPOSE });
  return CoverUploadTicketSchema.parse(data);
}

export async function confirmCoverUpload(
  client: Pick<AxiosInstance, 'post'>,
  mediaId: string,
): Promise<void> {
  await client.post(`/media/${mediaId}/confirm`);
}

// Raw-bytes PUT goes straight at the presigned URL (never through the app
// axios instance — no auth headers, no /api/v1 base).
export async function putCoverBytesAxios(
  uploadUrl: string,
  file: Blob,
  onProgress?: (p: UploadProgress) => void,
): Promise<void> {
  await axios.put(uploadUrl, file, {
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    onUploadProgress: (event) => {
      if (!onProgress) return;
      const total = event.total ?? undefined;
      const loaded = event.loaded;
      onProgress({
        loaded,
        total,
        percent: total ? Math.round((loaded / total) * 100) : 0,
      });
    },
  });
}

// Full 2-step cover flow scoped to this module: create → PUT bytes (progress)
// → confirm → mediaId. Type/size validated before any network call.
export async function uploadOpportunityCover(
  client: Pick<AxiosInstance, 'post'>,
  file: { name: string; type: string; size: number; blob: Blob },
  opts?: { onProgress?: (p: UploadProgress) => void },
): Promise<string> {
  const valid = validateCoverFile(file);
  if (!valid.ok) throw new Error(`INVALID_FILE_${valid.reason.toUpperCase()}`);
  const ticket = await createCoverUpload(client, {
    filename: file.name,
    mimeType: file.type,
    size: file.size,
  });
  await putCoverBytesAxios(ticket.uploadUrl, file.blob, opts?.onProgress);
  await confirmCoverUpload(client, ticket.mediaId);
  return ticket.mediaId;
}
