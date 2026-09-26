import { z } from 'zod';
import type { AxiosInstance } from 'axios';
import { CursorPageSchema } from './tasks';

// F8 experiences module: one typed function per own-experience backend
// endpoint (base `/api/v1`). Verified read-only against backend/src plus the
// live Swagger request DTOs (`UpdateExperienceVisibilityDto`,
// `PostLinkMediaDto`) — response payloads carry no Swagger schema, so shapes
// below mirror `experience-enrichment.ts` (`EnrichedExperience`) and
// `experiences.service.ts` (`getDetail` evidence) exactly:
// - GET /experiences/me (?categoryId=&skillId=&from=&to=, cursor `cursor`/
//   `limit`) → CursorPage<EnrichedExperience>
// - GET /experiences/:experienceId → EnrichedExperience + evidence[]
// - PATCH /experiences/:experienceId/visibility {publicVisibility} (lives here;
//   F6 `tasks.ts` owns the attestation download — imported, never redefined)
// - GET /volunteers/me/reviews → received reviews with org identity
// Verified-enrichment keys: `organization: {id, slug, nameFr, nameAr} | null`
// (no flat name — display picks nameFr/nameAr by locale), `verifiedAt` (ISO
// string), `verificationCode`, `registryId` (EXP-…), `duration` (number,
// minutes — NOT durationMinutes), `skills` (ObjectId hex strings),
// `publicVisibility` (public|private). Evidence exists on detail only.

export const ExperienceOrganizationSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    nameFr: z.string().nullable(),
    nameAr: z.string().nullable(),
  })
  .passthrough();

export type ExperienceOrganization = z.infer<typeof ExperienceOrganizationSchema>;

export const ExperienceReviewSchema = z
  .object({
    rating: z.number(),
    notes: z.string().nullable(),
  })
  .passthrough();

export type ExperienceReview = z.infer<typeof ExperienceReviewSchema>;

export const EnrichedExperienceSchema = z
  .object({
    id: z.string(),
    registryId: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    skills: z.array(z.string()),
    duration: z.number(),
    organization: ExperienceOrganizationSchema.nullable(),
    verifiedAt: z.string(),
    verificationCode: z.string(),
    publicVisibility: z.enum(['public', 'private']),
    review: ExperienceReviewSchema.nullable().optional(),
  })
  .passthrough();

export type EnrichedExperience = z.infer<typeof EnrichedExperienceSchema>;

export const ExperienceEvidenceSchema = z
  .object({
    mediaId: z.string(),
    media: z.unknown().nullable().optional(),
    url: z.string().nullable().optional(),
  })
  .passthrough();

export type ExperienceEvidence = z.infer<typeof ExperienceEvidenceSchema>;

export const ExperienceDetailSchema = EnrichedExperienceSchema.extend({
  evidence: z.array(ExperienceEvidenceSchema).optional().default([]),
});

export type ExperienceDetail = z.infer<typeof ExperienceDetailSchema>;

export const VolunteerReviewSchema = z
  .object({
    rating: z.number(),
    comment: z.string().nullable().optional(),
    organization: z
      .object({
        slug: z.string().optional(),
        nameFr: z.string().nullable().optional(),
        nameAr: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export type VolunteerReview = z.infer<typeof VolunteerReviewSchema>;

export interface ExperienceFilters {
  categoryId?: string;
  skillId?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

// Pure param builder (unit-tested): drops unset/blank filters so the query
// string carries only real constraints.
export function buildExperienceFilters(filters: ExperienceFilters): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (filters.categoryId && filters.categoryId.trim() !== '') params.categoryId = filters.categoryId;
  if (filters.skillId && filters.skillId.trim() !== '') params.skillId = filters.skillId;
  if (filters.from && filters.from.trim() !== '') params.from = filters.from;
  if (filters.to && filters.to.trim() !== '') params.to = filters.to;
  if (filters.cursor) params.cursor = filters.cursor;
  if (filters.limit !== undefined) params.limit = filters.limit;
  return params;
}

// Organization display name by locale (nameFr/nameAr, slug fallback — the
// payload has no flat `name` field).
export function orgDisplayName(
  org: ExperienceOrganization | null | undefined,
  locale: string,
): string {
  if (!org) return '';
  if (locale === 'ar' && org.nameAr) return org.nameAr;
  if (locale !== 'ar' && org.nameFr) return org.nameFr;
  return org.nameFr ?? org.nameAr ?? org.slug;
}

export function reviewOrgDisplayName(
  org: { nameFr?: string | null; nameAr?: string | null; slug?: string } | null | undefined,
  locale: string,
): string {
  if (!org) return '';
  if (locale === 'ar' && org.nameAr) return org.nameAr;
  if (locale !== 'ar' && org.nameFr) return org.nameFr;
  return org.nameFr ?? org.nameAr ?? org.slug ?? '';
}

type HttpClient = Pick<AxiosInstance, 'get' | 'patch'>;

export async function listMyExperiences(
  client: HttpClient,
  filters: ExperienceFilters = {},
): Promise<{ items: EnrichedExperience[]; nextCursor?: string | null; total: number }> {
  const { data } = await client.get('/experiences/me', {
    params: buildExperienceFilters(filters),
  });
  return CursorPageSchema(EnrichedExperienceSchema).parse(data);
}

export async function getExperienceDetail(
  client: HttpClient,
  experienceId: string,
): Promise<ExperienceDetail> {
  const { data } = await client.get(`/experiences/${experienceId}`);
  return ExperienceDetailSchema.parse(data);
}

export async function patchExperienceVisibility(
  client: HttpClient,
  experienceId: string,
  publicVisibility: 'public' | 'private',
): Promise<void> {
  // The backend returns the raw updated document (not the enriched shape),
  // so callers refetch the list/detail after success instead of parsing here.
  await client.patch(`/experiences/${experienceId}/visibility`, {
    publicVisibility,
  });
}

export async function listMyReviews(client: HttpClient): Promise<VolunteerReview[]> {
  const { data } = await client.get('/volunteers/me/reviews');
  if (Array.isArray(data)) return z.array(VolunteerReviewSchema).parse(data);
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    return z.array(VolunteerReviewSchema).parse((data as { items: unknown }).items);
  }
  return z.array(VolunteerReviewSchema).parse(data);
}
