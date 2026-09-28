import { z } from 'zod';
import type { AxiosInstance } from 'axios';

// Public opportunities-list module: one typed function for the public feed
// read consumed by `(public)/opportunities` (base `/api/v1`). Verified
// read-only against backend/src/opportunities (controller +
// OpportunityFeedQueryDto + FEED_SORTS + OPPORTUNITY_MODES) and the Session 7
// cursor/total page contract:
//
// - GET /opportunities (`q` keyword on title/description; `categoryId`,
//   `skillId`, `wilayaId`, `municipalityId` comma-joined multi-selects;
//   `from`/`to` ISO start-date bounds; `hasOpenPositions` boolean-string;
//   `nearMe=me` volunteer-scoped (NOT sent by the guest list screen);
//   `sort` in FEED_SORTS; cursor `cursor`/`limit`). The feed DTO has NO `mode`
//   field (unknown params 400 via whitelist + forbidNonWhitelisted), so the
//   Format select is applied client-side on the real enum below —
//   `filterByMode` — never serialized.
// - Mode enum (OPPORTUNITY_MODES): `onsite | remote | hybrid`.
// - Page shape: `{ items, nextCursor, limit, total, page?, pages? }`; numbers
//   are only ever shown from the served `page/pages/total`, never invented.
// - Facet lookups (`GET /locations/wilayas`, `GET /skill-categories`,
//   `GET /skills`) are import-only reused from `feed.ts` in the hook file
//   (F17 precedent) — not re-wrapped here.

export const PUBLIC_OPP_SORTS = ['newest', 'oldest', 'deadline_asc', 'startDate_asc'] as const;

export type PublicOppSort = (typeof PUBLIC_OPP_SORTS)[number];

export const PUBLIC_OPP_MODES = ['onsite', 'remote', 'hybrid'] as const;

export type PublicOppMode = (typeof PUBLIC_OPP_MODES)[number];

export type PublicOppModeFilter = PublicOppMode | 'all';

export function parsePublicOppMode(value: unknown): PublicOppModeFilter {
  return value === 'onsite' || value === 'remote' || value === 'hybrid' ? value : 'all';
}

export const PublicOrgEmbedSchema = z
  .object({
    id: z.string().optional(),
    slug: z.string().optional(),
    nameFr: z.string().nullable().optional(),
    nameAr: z.string().nullable().optional(),
    logoMediaId: z.string().nullable().optional(),
    verificationStatus: z.string().optional(),
  })
  .passthrough();

export type PublicOrgEmbed = z.infer<typeof PublicOrgEmbedSchema>;

export const PublicCategoryNameSchema = z
  .object({
    nameAr: z.string().optional(),
    nameFr: z.string().optional(),
  })
  .passthrough();

export const PublicLocationLabelSchema = z
  .object({
    nameAr: z.string().optional(),
    nameFr: z.string().optional(),
  })
  .passthrough();

export const PublicPositionSkillSchema = z
  .object({
    skillId: z.string(),
    nameAr: z.string().optional(),
    nameFr: z.string().optional(),
  })
  .passthrough();

export const PublicListPositionSchema = z
  .object({
    _id: z.string().optional(),
    id: z.string().optional(),
    title: z.string().optional(),
    requiredCount: z.number().nullable().optional(),
    filledCount: z.number().nullable().optional(),
    skillNames: z.array(PublicPositionSkillSchema).nullable().optional(),
  })
  .passthrough();

export type PublicListPosition = z.infer<typeof PublicListPositionSchema>;

export const PublicOpportunitySchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    title: z.string().optional(),
    slug: z.string().optional(),
    idOrSlug: z.string().optional(),
    description: z.string().nullable().optional(),
    registryId: z.string().nullable().optional(),
    mode: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    applicationDeadline: z.string().nullable().optional(),
    durationMinutes: z.number().nullable().optional(),
    coverMediaId: z.string().nullable().optional(),
    categoryName: PublicCategoryNameSchema.nullable().optional(),
    locationLabels: z
      .object({
        wilaya: PublicLocationLabelSchema.nullable().optional(),
        municipality: PublicLocationLabelSchema.nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    positions: z.array(PublicListPositionSchema).nullable().optional(),
    organization: PublicOrgEmbedSchema.nullable().optional(),
    isFavorited: z.boolean().nullable().optional(),
    favoriteCount: z.number().nullable().optional(),
  })
  .passthrough();

export type PublicOpportunity = z.infer<typeof PublicOpportunitySchema>;

export const PublicOpportunityPageSchema = z
  .object({
    items: z.array(PublicOpportunitySchema),
    nextCursor: z.string().nullable().optional(),
    limit: z.number().optional(),
    total: z.number(),
    page: z.number().optional(),
    pages: z.number().optional(),
  })
  .passthrough();

export type PublicOpportunityPage = z.infer<typeof PublicOpportunityPageSchema>;

export interface PublicOpportunitiesParams {
  q?: string;
  categoryIds?: string[];
  skillIds?: string[];
  wilayaIds?: string[];
  municipalityIds?: string[];
  from?: string;
  to?: string;
  hasOpenPositions?: boolean;
  sort?: PublicOppSort;
  cursor?: string;
  limit?: number;
}

// Exact backend query names (OpportunityFeedQueryDto). Multi-selects serialize
// comma-joined; booleans as boolean-strings; undefined/empty dropped. `mode`
// is deliberately absent — see module header.
export function toPublicOpportunitiesQuery(
  params: PublicOpportunitiesParams,
): Record<string, string> {
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
  set('sort', params.sort);
  set('cursor', params.cursor);
  if (params.limit !== undefined) query.limit = String(params.limit);
  return query;
}

// ---- Pure display helpers (no fetches; embed-only, never invented) ----

export function publicOrgDisplayName(
  org: PublicOrgEmbed | null | undefined,
  locale: string,
): string {
  if (!org) return '';
  if (locale === 'ar') return org.nameAr ?? org.nameFr ?? '';
  return org.nameFr ?? org.nameAr ?? '';
}

export function publicLabelFor(
  label: { nameAr?: string; nameFr?: string } | null | undefined,
  locale: string,
): string {
  if (!label) return '';
  return (locale === 'ar' ? label.nameAr : label.nameFr) ?? '';
}

export function isPublicOrgVerified(org: PublicOrgEmbed | null | undefined): boolean {
  return org?.verificationStatus === 'verified';
}

export function publicOpportunityRef(registryId: string | null | undefined): string | null {
  if (!registryId || registryId.trim() === '') return null;
  const bare = registryId.replace(/^OPP-/, '');
  if (bare.trim() === '') return null;
  return `OPP-${bare}`;
}

// Neutral duration: minutes in, whole-or-one-decimal hours out. Null when the
// backend sent no usable duration — the UI omits the row (never invents;
// the rejected "civic hrs" phrasing is not used).
export function publicHoursFromMinutes(durationMinutes: number | null | undefined): number | null {
  if (typeof durationMinutes !== 'number' || !Number.isFinite(durationMinutes) || durationMinutes <= 0)
    return null;
  return Math.round((durationMinutes / 60) * 10) / 10;
}

// Open seats across positions. Missing counts read as 0; no positions data
// means null (the caller omits the indicator instead of inventing seats).
export function publicOpenSeatsOf(card: PublicOpportunity): { open: number; total: number } | null {
  if (!Array.isArray(card.positions) || card.positions.length === 0) return null;
  let open = 0;
  let total = 0;
  for (const position of card.positions) {
    const required =
      typeof position.requiredCount === 'number' && Number.isFinite(position.requiredCount)
        ? position.requiredCount
        : 0;
    const filled =
      typeof position.filledCount === 'number' && Number.isFinite(position.filledCount)
        ? position.filledCount
        : 0;
    total += required;
    open += Math.max(0, required - filled);
  }
  return { open, total };
}

// Union of position skill labels across the card (locale-aware, deduped).
export function publicSkillLabelsOf(card: PublicOpportunity, locale: string): string[] {
  const labels: string[] = [];
  for (const position of card.positions ?? []) {
    for (const skill of position.skillNames ?? []) {
      const label = publicLabelFor(skill, locale);
      if (label !== '' && !labels.includes(label)) labels.push(label);
    }
  }
  return labels;
}

// Display location from embedded labels ("Wilaya · Municipality"), or null
// when the backend sent no labels (the caller omits the element).
export function publicLocationOf(card: PublicOpportunity, locale: string): string | null {
  const parts = [
    publicLabelFor(card.locationLabels?.wilaya, locale),
    publicLabelFor(card.locationLabels?.municipality, locale),
  ].filter((part) => part !== '');
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function publicOppSlugOf(card: PublicOpportunity): string {
  return card.slug ?? card._id ?? card.id ?? card.idOrSlug ?? '';
}

export function publicOrgSlugOf(card: PublicOpportunity): string | null {
  const slug = card.organization?.slug;
  return slug && slug.trim() !== '' ? slug : null;
}

// Client-side Format narrowing on the real `mode` enum. The feed DTO accepts
// no `mode` param, so this filters the served page only ('all' is identity).
export function filterByMode(
  items: PublicOpportunity[],
  mode: PublicOppModeFilter,
): PublicOpportunity[] {
  if (mode === 'all') return items;
  return items.filter((item) => item.mode === mode);
}

type HttpClient = Pick<AxiosInstance, 'get'>;

export async function listPublicOpportunities(
  client: HttpClient,
  params: PublicOpportunitiesParams = {},
): Promise<PublicOpportunityPage> {
  const { data } = await client.get('/opportunities', { params: toPublicOpportunitiesQuery(params) });
  return PublicOpportunityPageSchema.parse(data);
}
