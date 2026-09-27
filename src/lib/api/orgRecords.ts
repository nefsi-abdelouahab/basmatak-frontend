import { z } from 'zod';
import type { AxiosInstance, AxiosResponse } from 'axios';
import { CursorPageSchema } from './tasks';
import { downloadBlob } from './download';
import { EnrichedExperienceSchema } from './experiences';
import type { EnrichedExperience } from './experiences';

// F12 org-records module: one typed function per org archive backend endpoint
// (base `/api/v1`). Verified read-only against backend/src (no edits):
// - GET /organizations/me/experiences (?q=&opportunityId=&visibility=&sort=,
//   cursor `cursor`/`limit`, CursorPage<EnrichedExperience>) — cursor-based,
//   NOT page-based (roadmap `page` naming does not exist server-side)
// - GET /organizations/me/experiences?format=csv (full filtered set streamed
//   as `text/csv` attachment `org-experiences.csv`, NOT the current page)
// - GET /organizations/me/reviews (cursor `cursor`/`limit`,
//   CursorPage<Record> of org-authored reviews)
// - GET /verify/:verificationCode is a link target only (public proof, no
//   page built here, no fetch)
// - GET /experiences/:experienceId/attestation streams through F6 `tasks.ts`
//   `downloadAttestation` (single function per endpoint — imported, never
//   redefined)
// The org list payload carries NO volunteer join (shared assembler output),
// so rows render record identity (EXP-registryId + title) with no invented
// volunteer names.

export const ORG_RECORD_VISIBILITIES = ['public', 'private'] as const;

export type OrgRecordVisibility = (typeof ORG_RECORD_VISIBILITIES)[number];

export const ORG_RECORD_SORTS = ['newest', 'oldest'] as const;

export type OrgRecordSort = (typeof ORG_RECORD_SORTS)[number];

export type OrgExperienceRow = EnrichedExperience;

export const OrgGivenReviewSchema = z
  .object({
    rating: z.number().nullable().optional(),
    comment: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    volunteer: z.unknown().nullable().optional(),
    experienceId: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
  })
  .passthrough();

export type OrgGivenReview = z.infer<typeof OrgGivenReviewSchema>;

export interface OrgRecordsFilters {
  q?: string;
  opportunityId?: string;
  visibility?: string;
  sort?: string;
  cursor?: string;
  limit?: number;
}

// Pure param builder (unit-tested): drops unset/blank filters and rejects
// off-vocabulary visibility/sort values (the backend IsIn-guards them with
// 400) so the query string carries only real constraints.
export function buildOrgRecordsFilters(filters: OrgRecordsFilters): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (filters.q && filters.q.trim() !== '') params.q = filters.q.trim().slice(0, 60);
  if (filters.opportunityId && filters.opportunityId.trim() !== '')
    params.opportunityId = filters.opportunityId;
  if (
    filters.visibility &&
    (ORG_RECORD_VISIBILITIES as readonly string[]).includes(filters.visibility)
  )
    params.visibility = filters.visibility;
  if (filters.sort && (ORG_RECORD_SORTS as readonly string[]).includes(filters.sort))
    params.sort = filters.sort;
  if (filters.cursor) params.cursor = filters.cursor;
  if (filters.limit !== undefined) params.limit = filters.limit;
  return params;
}

// CSV export params: the active filters plus format=csv (the export streams
// the whole filtered set server-side).
export function buildOrgRecordsCsvParams(
  filters: OrgRecordsFilters,
): Record<string, unknown> {
  return { ...buildOrgRecordsFilters(filters), format: 'csv' };
}

// Deep-link target for the copy action (inline string only — no page built).
export function buildVerifyDeepLink(verificationCode: string): string {
  return `/verify/${verificationCode}`;
}

type HttpClient = Pick<AxiosInstance, 'get'>;

export async function listOrgExperiences(
  client: HttpClient,
  filters: OrgRecordsFilters = {},
): Promise<{ items: OrgExperienceRow[]; nextCursor?: string | null; total: number }> {
  const { data } = await client.get('/organizations/me/experiences', {
    params: buildOrgRecordsFilters(filters),
  });
  return CursorPageSchema(EnrichedExperienceSchema).parse(data);
}

// CSV streams through the single shared blob-download path
// (Content-Disposition filename, triggered save — never navigation).
// Header names are normalized to lowercase (see F6 tasks.ts pattern).
export async function exportOrgExperiencesCsv(
  client: HttpClient,
  filters: OrgRecordsFilters = {},
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
  }, '/organizations/me/experiences', buildOrgRecordsCsvParams(filters));
}

export interface OrgReviewsParams {
  cursor?: string;
  limit?: number;
}

export async function listOrgReviewsGiven(
  client: HttpClient,
  params: OrgReviewsParams = {},
): Promise<{ items: OrgGivenReview[]; nextCursor?: string | null; total: number }> {
  const query: Record<string, unknown> = {};
  if (params.cursor) query.cursor = params.cursor;
  if (params.limit !== undefined) query.limit = params.limit;
  const { data } = await client.get('/organizations/me/reviews', { params: query });
  if (Array.isArray(data))
    return {
      items: z.array(OrgGivenReviewSchema).parse(data),
      nextCursor: null,
      total: data.length,
    };
  return CursorPageSchema(OrgGivenReviewSchema).parse(data);
}
