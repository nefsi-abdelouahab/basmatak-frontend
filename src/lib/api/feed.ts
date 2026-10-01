import { z } from 'zod';
import type { AxiosInstance } from 'axios';

// F4 feed module: one typed function per volunteer-home read endpoint
// (base `/api/v1`). Verified read-only against backend/src/opportunities
// (controller + OpportunityFeedQueryDto/RecommendedQueryDto + FEED_SORTS),
// backend/src/volunteers (public-volunteers.controller + TalentsQueryDto +
// TALENT_SORTS + getDashboard), backend/src/skills, backend/src/locations:
// - GET /opportunities (`q`, multi-value categoryId/skillId/wilayaId/
//   municipalityId as comma-joined, `from`/`to` ISO, `hasOpenPositions`
//   boolean-string, `nearMe=me`, `sort` in FEED_SORTS, cursor `cursor`/`limit`)
// - GET /opportunities/recommended (cursor `cursor`/`limit` only)
// - GET /talents (`q` max 120, single/multi skillId(s)/categoryId/
//   wilayaId(s), `minExperiences`, `hasAvailability`/`portfolio`
//   boolean-strings, `sort` in TALENT_SORTS, cursor `cursor`/`limit`)
// - GET /volunteers/me/dashboard ({completionPercent, stats,
//   latestVerifiedExperience}); facet lookups /skill-categories, /skills,
//   /locations/wilayas, /locations/wilayas/:wilayaId/municipalities.
//
// NOTE: volunteers.ts (F2) and organizations.ts (F3) already wrap a subset of
// these paths with their own session-scoped schemas. feed.ts re-wraps them
// with F4 card-scoped schemas (embeds, isFavorited, stats) so FC stays
// file-disjoint: no archived module is edited or imported at runtime.

export const FEED_SORTS = ['newest', 'oldest', 'deadline_asc', 'startDate_asc'] as const;

export type FeedSort = (typeof FEED_SORTS)[number];

export const TALENT_SORTS = ['newest', 'oldest', 'experiences_desc'] as const;

export type TalentSort = (typeof TALENT_SORTS)[number];

export const OrganizationEmbedSchema = z
  .object({
    id: z.string().optional(),
    slug: z.string().optional(),
    nameFr: z.string().nullable().optional(),
    nameAr: z.string().nullable().optional(),
    logoMediaId: z.string().nullable().optional(),
    verificationStatus: z.string().optional(),
  })
  .passthrough();

export type OrganizationEmbed = z.infer<typeof OrganizationEmbedSchema>;

// Card-level enrichment siblings assembled by OpportunityEmbedProvider.embedCards
// (org embed + category/location labels + favorites). The schema stays
// card-scoped: per-position application counts and assigned names are
// detail-only (embedFull) and never read here.
export const FeedLabelSchema = z
  .object({
    nameAr: z.string().optional(),
    nameFr: z.string().optional(),
  })
  .passthrough();

export type FeedLabel = z.infer<typeof FeedLabelSchema>;

export const FeedPositionSchema = z
  .object({
    _id: z.string().optional(),
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    requiredCount: z.number().optional(),
    filledCount: z.number().optional(),
    skillNames: z
      .array(
        z
          .object({
            skillId: z.string(),
            nameAr: z.string().optional(),
            nameFr: z.string().optional(),
          })
          .passthrough(),
      )
      .nullable()
      .optional(),
  })
  .passthrough();

export type FeedPosition = z.infer<typeof FeedPositionSchema>;

export const OpportunityCardSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    title: z.string().optional(),
    slug: z.string().optional(),
    idOrSlug: z.string().optional(),
    registryId: z.string().optional(),
    mode: z.string().optional(),
    status: z.string().optional(),
    description: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    applicationDeadline: z.string().nullable().optional(),
    durationMinutes: z.number().nullable().optional(),
    coverMediaId: z.string().nullable().optional(),
    categoryName: FeedLabelSchema.nullable().optional(),
    locationLabels: z
      .object({
        wilaya: FeedLabelSchema.nullable().optional(),
        municipality: FeedLabelSchema.nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    positions: z.array(FeedPositionSchema).nullable().optional(),
    organization: OrganizationEmbedSchema.nullable().optional(),
    isFavorited: z.boolean().nullable().optional(),
    favoriteCount: z.number().nullable().optional(),
  })
  .passthrough();

export type OpportunityCard = z.infer<typeof OpportunityCardSchema>;

export const TalentCardSchema = z
  .object({
    username: z.string(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    headline: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
    avatar: z.string().nullable().optional(),
    experienceCount: z.number().nullable().optional(),
    portfolioCount: z.number().nullable().optional(),
    hasAvailability: z.boolean().nullable().optional(),
    isFavorited: z.boolean().nullable().optional(),
    favoriteCount: z.number().nullable().optional(),
    stats: z.unknown().nullable().optional(),
  })
  .passthrough();

export type TalentCard = z.infer<typeof TalentCardSchema>;

export const CursorPageSchema = <T extends z.ZodTypeAny>(item: T) =>
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

export type OpportunityPage = z.infer<ReturnType<typeof CursorPageSchema>>;
export type TalentPage = z.infer<ReturnType<typeof CursorPageSchema>>;

export const LatestVerifiedExperienceOrganizationSchema = z
  .object({
    id: z.string().optional(),
    slug: z.string().optional(),
    nameFr: z.string().nullable().optional(),
    nameAr: z.string().nullable().optional(),
  })
  .passthrough();

export const LatestVerifiedExperienceSchema = z
  .object({
    id: z.string().optional(),
    registryId: z.string().optional(),
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    skills: z.array(z.string()).nullable().optional(),
    duration: z.number().nullable().optional(),
    organization: LatestVerifiedExperienceOrganizationSchema.nullable().optional(),
    verificationCode: z.string().nullable().optional(),
    verifiedAt: z.string().nullable().optional(),
    organizationName: z.string().nullable().optional(),
    publicVisibility: z.string().optional(),
  })
  .passthrough();

export type LatestVerifiedExperience = z.infer<typeof LatestVerifiedExperienceSchema>;

export const VolunteerHomeDashboardSchema = z
  .object({
    completionPercent: z.number(),
    stats: z.record(z.string(), z.unknown()).nullable().optional(),
    latestVerifiedExperience: LatestVerifiedExperienceSchema.nullable().optional(),
  })
  .passthrough();

export type VolunteerHomeDashboard = z.infer<typeof VolunteerHomeDashboardSchema>;

export const FacetOptionSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    code: z.string().optional(),
    nameFr: z.string().optional(),
    nameAr: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough();

export type FacetOption = z.infer<typeof FacetOptionSchema>;

export interface OpportunityFeedParams {
  q?: string;
  categoryIds?: string[];
  skillIds?: string[];
  wilayaIds?: string[];
  municipalityIds?: string[];
  from?: string;
  to?: string;
  hasOpenPositions?: boolean;
  nearMe?: 'me';
  sort?: FeedSort;
  cursor?: string;
  limit?: number;
}

export interface TalentFeedParams {
  q?: string;
  skillIds?: string[];
  categoryId?: string;
  wilayaIds?: string[];
  minExperiences?: number;
  hasAvailability?: boolean;
  portfolio?: boolean;
  sort?: TalentSort;
  cursor?: string;
  limit?: number;
}

// Multi-selects serialize comma-joined (backend splits single or
// comma-separated values); booleans serialize as boolean-strings;
// undefined/empty values are dropped so the URL stays shareable.
export function toOpportunityQuery(params: OpportunityFeedParams): Record<string, string> {
  const query: Record<string, string> = {};
  const set = (key: string, value: string | undefined) => {
    if (value !== undefined && value !== '') query[key] = value;
  };
  set('q', params.q?.trim() || undefined);
  set('categoryId', params.categoryIds?.filter(Boolean).join(',') || undefined);
  set('skillId', params.skillIds?.filter(Boolean).join(',') || undefined);
  set('wilayaId', params.wilayaIds?.filter(Boolean).join(',') || undefined);
  set('municipalityId', params.municipalityIds?.filter(Boolean).join(',') || undefined);
  set('from', params.from);
  set('to', params.to);
  if (params.hasOpenPositions !== undefined)
    query.hasOpenPositions = params.hasOpenPositions ? 'true' : 'false';
  set('nearMe', params.nearMe);
  set('sort', params.sort);
  set('cursor', params.cursor);
  if (params.limit !== undefined) query.limit = String(params.limit);
  return query;
}

export function toTalentQuery(params: TalentFeedParams): Record<string, string> {
  const query: Record<string, string> = {};
  const set = (key: string, value: string | undefined) => {
    if (value !== undefined && value !== '') query[key] = value;
  };
  set('q', params.q?.trim().slice(0, 120) || undefined);
  set('skillIds', params.skillIds?.filter(Boolean).join(',') || undefined);
  set('categoryId', params.categoryId);
  set('wilayaIds', params.wilayaIds?.filter(Boolean).join(',') || undefined);
  if (params.minExperiences !== undefined) query.minExperiences = String(params.minExperiences);
  if (params.hasAvailability !== undefined)
    query.hasAvailability = params.hasAvailability ? 'true' : 'false';
  if (params.portfolio !== undefined) query.portfolio = params.portfolio ? 'true' : 'false';
  set('sort', params.sort);
  set('cursor', params.cursor);
  if (params.limit !== undefined) query.limit = String(params.limit);
  return query;
}

// Algeria-specific week windows (OQ2): week stays ISO Monday–Sunday; the
// weekend is Friday–Saturday (ar-DZ convention). No date-fns/next-intl helper
// for the DZ weekend exists in this stack, so the Fri–Sat window is hardcoded
// here with this comment rather than treated as a generic default.
export function mondayOfWeek(ref: Date): Date {
  const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}

export function weekWindow(ref: Date): { from: string; to: string } {
  const monday = mondayOfWeek(ref);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: monday.toISOString(), to: sunday.toISOString() };
}

export function weekendWindow(ref: Date): { from: string; to: string } {
  const monday = mondayOfWeek(ref);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  const saturday = new Date(monday);
  saturday.setUTCDate(monday.getUTCDate() + 5);
  return { from: friday.toISOString(), to: saturday.toISOString() };
}

type HttpClient = Pick<AxiosInstance, 'get'>;

export async function listOpportunities(
  client: HttpClient,
  params: OpportunityFeedParams = {},
): Promise<{ items: OpportunityCard[]; total: number; page?: number; pages?: number; nextCursor?: string | null; limit?: number }> {
  const { data } = await client.get('/opportunities', { params: toOpportunityQuery(params) });
  return CursorPageSchema(OpportunityCardSchema).parse(data);
}

export async function listRecommended(
  client: HttpClient,
  params: { cursor?: string; limit?: number } = {},
): Promise<{ items: OpportunityCard[]; total: number; page?: number; pages?: number; nextCursor?: string | null; limit?: number }> {
  const { data } = await client.get('/opportunities/recommended', { params });
  return CursorPageSchema(OpportunityCardSchema).parse(data);
}

export async function listTalents(
  client: HttpClient,
  params: TalentFeedParams = {},
): Promise<{ items: TalentCard[]; total: number; page?: number; pages?: number; nextCursor?: string | null; limit?: number }> {
  const { data } = await client.get('/talents', { params: toTalentQuery(params) });
  return CursorPageSchema(TalentCardSchema).parse(data);
}

export async function getVolunteerHomeDashboard(
  client: HttpClient,
): Promise<VolunteerHomeDashboard> {
  const { data } = await client.get('/volunteers/me/dashboard');
  return VolunteerHomeDashboardSchema.parse(data);
}

export async function listSkillCategories(client: HttpClient): Promise<FacetOption[]> {
  const { data } = await client.get('/skill-categories');
  return z.array(FacetOptionSchema).parse(data);
}

export async function listSkills(
  client: HttpClient,
  params?: { categoryId?: string; q?: string },
): Promise<FacetOption[]> {
  const { data } = await client.get('/skills', { params });
  return z.array(FacetOptionSchema).parse(data);
}

export async function listWilayas(client: HttpClient): Promise<FacetOption[]> {
  const { data } = await client.get('/locations/wilayas');
  return z.array(FacetOptionSchema).parse(data);
}

export async function listMunicipalities(
  client: HttpClient,
  wilayaId: string,
): Promise<FacetOption[]> {
  const { data } = await client.get(`/locations/wilayas/${wilayaId}/municipalities`);
  return z.array(FacetOptionSchema).parse(data);
}
