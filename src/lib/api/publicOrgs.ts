import { z } from 'zod';
import type { AxiosInstance } from 'axios';

// F18 public-orgs module: one typed function per public landing / org-profile /
// opportunity-details endpoint (base `/api/v1`). Shapes pinned read-only from
// the sibling modules this session reuses as patterns (never edited, never
// imported at runtime — every read below is wrapped here so FF stays
// file-disjoint):
// - GET /organizations (public search, `q`/`page`, CursorPage + total)
// - GET /organizations/:slug (public profile facts; aggregates ride the
//   payload as an optional `stats`/`aggregates` object via OrgPublicStatsProvider)
// - GET /organizations/:slug/opportunities (`status=published|completed|closed`
//   + voluntary per-tab `counts`, CursorPage `total` per page)
// - GET /organizations/:slug/reliability (neutral response rate + per-domain
//   breakdown; F5's opportunity.ts documents this read as F18-owned — the org
//   embed carries no reliability sub-object)
// - GET /opportunities (published feed; org + category embeds)
// - GET /opportunities/:idOrSlug (published-only; positions carry
//   `applicationCount` + `assigned` names + `skillNames`; org embed carries
//   `{id, slug, nameFr, nameAr, logoMediaId, verificationStatus}`)
// - GET /talents (public sample strip; thin projection only)
// - GET /skill-categories, GET /locations/wilayas (landing lookups)
// - GET /media/:mediaId (guest cover reads; module-local per the F5/F17
//   per-module pattern — deviation-1, owner-approved)

export const ARCHIVE_STATUSES = ['published', 'completed', 'closed'] as const;

export type ArchiveStatus = (typeof ARCHIVE_STATUSES)[number];

export function parseArchiveStatus(value: unknown): ArchiveStatus | null {
  return value === 'published' || value === 'completed' || value === 'closed' ? value : null;
}

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

export const CategoryNameSchema = z
  .object({
    nameAr: z.string().optional(),
    nameFr: z.string().optional(),
  })
  .passthrough();

export const LocationLabelSchema = z
  .object({
    nameAr: z.string().optional(),
    nameFr: z.string().optional(),
  })
  .passthrough();

export const PublicOrgCardSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    slug: z.string().optional(),
    nameFr: z.string().nullable().optional(),
    nameAr: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    logoMediaId: z.string().nullable().optional(),
    coverMediaId: z.string().nullable().optional(),
    registryId: z.string().nullable().optional(),
    verificationStatus: z.string().optional(),
    foundedYear: z.number().nullable().optional(),
  })
  .passthrough();

export type PublicOrgCard = z.infer<typeof PublicOrgCardSchema>;

export const PublicOrgAggregatesSchema = z
  .object({
    opportunitiesActive: z.number().nullable().optional(),
    opportunitiesCompleted: z.number().nullable().optional(),
    participantsActive: z.number().nullable().optional(),
    participantsCompleted: z.number().nullable().optional(),
    volunteersCount: z.number().nullable().optional(),
    verifiedHours: z.number().nullable().optional(),
  })
  .passthrough();

export type PublicOrgAggregates = z.infer<typeof PublicOrgAggregatesSchema>;

export const PublicOrgProfileSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    slug: z.string().optional(),
    registryId: z.string().nullable().optional(),
    nameAr: z.string().nullable().optional(),
    nameFr: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    logoMediaId: z.string().nullable().optional(),
    coverMediaId: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    registrationNumber: z.string().nullable().optional(),
    location: z
      .object({
        wilayaId: z.string().nullable().optional(),
        municipalityId: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    website: z.string().nullable().optional(),
    foundedYear: z.number().nullable().optional(),
    verificationStatus: z.string().optional(),
    contact: z
      .object({
        email: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    focusDisciplines: z.array(z.string()).nullable().optional(),
    operatingScope: z.string().nullable().optional(),
    stats: PublicOrgAggregatesSchema.nullable().optional(),
    aggregates: PublicOrgAggregatesSchema.nullable().optional(),
  })
  .passthrough();

export type PublicOrgProfile = z.infer<typeof PublicOrgProfileSchema>;

export const ArchiveCountsSchema = z
  .object({
    published: z.number().nullable().optional(),
    completed: z.number().nullable().optional(),
    closed: z.number().nullable().optional(),
  })
  .passthrough();

export type ArchiveCounts = z.infer<typeof ArchiveCountsSchema>;

export const AssignedVolunteerSchema = z
  .object({
    volunteerId: z.string(),
    fullName: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
    avatarMediaId: z.string().nullable().optional(),
  })
  .passthrough();

export type AssignedVolunteer = z.infer<typeof AssignedVolunteerSchema>;

export const PositionSkillNameSchema = z
  .object({
    skillId: z.string(),
    nameAr: z.string().optional(),
    nameFr: z.string().optional(),
  })
  .passthrough();

export const PublicPositionSchema = z
  .object({
    _id: z.string().optional(),
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    requiredCount: z.number().nullable().optional(),
    filledCount: z.number().nullable().optional(),
    requiredSkills: z.array(z.unknown()).nullable().optional(),
    deliverables: z.array(z.string()).nullable().optional(),
    startAt: z.string().nullable().optional(),
    applicationCount: z.number().nullable().optional(),
    assigned: z.array(AssignedVolunteerSchema).nullable().optional(),
    skillNames: z.array(PositionSkillNameSchema).nullable().optional(),
  })
  .passthrough();

export type PublicPosition = z.infer<typeof PublicPositionSchema>;

export const PublicOppCardSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    title: z.string().optional(),
    slug: z.string().optional(),
    registryId: z.string().nullable().optional(),
    mode: z.string().nullable().optional(),
    startAt: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    applicationDeadline: z.string().nullable().optional(),
    durationMinutes: z.number().nullable().optional(),
    coverMediaId: z.string().nullable().optional(),
    categoryName: CategoryNameSchema.nullable().optional(),
    locationLabels: z
      .object({
        wilaya: LocationLabelSchema.nullable().optional(),
        municipality: LocationLabelSchema.nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    positions: z.array(PublicPositionSchema).nullable().optional(),
    organization: OrganizationEmbedSchema.nullable().optional(),
    isFavorited: z.boolean().nullable().optional(),
    favoriteCount: z.number().nullable().optional(),
  })
  .passthrough();

export type PublicOppCard = z.infer<typeof PublicOppCardSchema>;

// Open seats across positions. Missing counts read as 0; no positions data
// means null (the caller omits the indicator instead of inventing seats).
export function openSeatsOf(card: PublicOppCard): { open: number; total: number } | null {
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
export function oppSkillLabels(card: PublicOppCard, locale: string): string[] {
  const labels: string[] = [];
  for (const position of card.positions ?? []) {
    for (const skill of position.skillNames ?? []) {
      const label = labelFor(skill, locale);
      if (label !== '' && !labels.includes(label)) labels.push(label);
    }
  }
  return labels;
}

// Display location from embedded labels ("Wilaya · Municipality"), or null
// when the backend sent no labels (the caller omits the element).
export function oppLocationOf(card: PublicOppCard, locale: string): string | null {
  const parts = [labelFor(card.locationLabels?.wilaya, locale), labelFor(card.locationLabels?.municipality, locale)].filter(
    (part) => part !== '',
  );
  return parts.length > 0 ? parts.join(' · ') : null;
}

export const PublicOppDetailSchema = z
  .object({
    _id: z.string().optional(),
    id: z.string().optional(),
    slug: z.string().optional(),
    title: z.string(),
    description: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    registryId: z.string().nullable().optional(),
    mode: z.string().nullable().optional(),
    coverMediaId: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    applicationDeadline: z.string().nullable().optional(),
    durationMinutes: z.number().nullable().optional(),
    prerequisites: z.array(z.string()).nullable().optional(),
    status: z.string().optional(),
    location: z
      .object({
        wilayaId: z.string().nullable().optional(),
        municipalityId: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    positions: z.array(PublicPositionSchema).nullable().optional(),
    organization: OrganizationEmbedSchema.nullable().optional(),
    categoryName: CategoryNameSchema.nullable().optional(),
    locationLabels: z
      .object({
        wilaya: LocationLabelSchema.nullable().optional(),
        municipality: LocationLabelSchema.nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    isFavorited: z.boolean().nullable().optional(),
    favoriteCount: z.number().nullable().optional(),
  })
  .passthrough();

export type PublicOppDetail = z.infer<typeof PublicOppDetailSchema>;

export const OrgReliabilitySchema = z
  .object({
    responseRate: z.number().nullable().optional(),
    responseRatio: z.number().nullable().optional(),
    decidedRatio: z.number().nullable().optional(),
    byDomain: z.array(z.unknown()).nullable().optional(),
    domains: z.array(z.unknown()).nullable().optional(),
  })
  .passthrough();

export type OrgReliability = z.infer<typeof OrgReliabilitySchema>;

export const TalentStatsSchema = z
  .object({
    completedTasks: z.number().nullable().optional(),
    verifiedExperiences: z.number().nullable().optional(),
    volunteerHours: z.number().nullable().optional(),
  })
  .passthrough()
  .nullable()
  .optional();

export type TalentStats = z.infer<typeof TalentStatsSchema>;

export const TalentSampleSchema = z
  .object({
    username: z.string(),
    firstName: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
    headline: z.string().nullable().optional(),
    avatar: z.string().nullable().optional(),
    location: z.unknown().nullable().optional(),
    skills: z.array(z.unknown()).nullable().optional(),
    stats: z.unknown().nullable().optional(),
    isFavorited: z.boolean().nullable().optional(),
    favoriteCount: z.number().nullable().optional(),
  })
  .passthrough();

export type TalentSample = z.infer<typeof TalentSampleSchema>;

// Verified-experience count for a talent card. Missing/non-numeric reads as 0
// (the card always shows the count line, never a placeholder).
export function verifiedExperiencesOf(sample: TalentSample): number {
  const parsed = TalentStatsSchema.nullable()
    .optional()
    .safeParse(sample.stats);
  const count = parsed.success ? parsed.data?.verifiedExperiences : undefined;
  return typeof count === 'number' && Number.isFinite(count) ? count : 0;
}

// Wilaya code from the thin card projection ({ wilayaId } or a plain code).
export function talentWilayaCodeOf(sample: TalentSample): string | null {
  const location = sample.location;
  if (typeof location === 'string') return location !== '' ? location : null;
  if (location !== null && typeof location === 'object') {
    const code = (location as { wilayaId?: unknown }).wilayaId;
    return typeof code === 'string' && code !== '' ? code : null;
  }
  return null;
}

// Latest public experience records for the verification showcase
// (GET /volunteers/:username/experiences, public rows only).
export const PublicExperienceSummarySchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    registryId: z.string().nullable().optional(),
    title: z.string(),
    description: z.string().nullable().optional(),
    duration: z.number().nullable().optional(),
    skills: z.array(z.string()).nullable().optional(),
    organization: OrganizationEmbedSchema.nullable().optional(),
    verifiedAt: z.string().nullable().optional(),
    verificationCode: z.string().nullable().optional(),
  })
  .passthrough();

export type PublicExperienceSummary = z.infer<typeof PublicExperienceSummarySchema>;

export async function listTalentExperiences(
  client: HttpClient,
  username: string,
  limit = 1,
): Promise<z.infer<ReturnType<typeof CursorPageSchema>>> {
  const { data } = await client.get(`/volunteers/${encodeURIComponent(username)}/experiences`, {
    params: { limit },
  });
  return CursorPageSchema(PublicExperienceSummarySchema).parse(data);
}

export const SkillCategorySchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    nameAr: z.string().optional(),
    nameFr: z.string().optional(),
  })
  .passthrough();

export type SkillCategory = z.infer<typeof SkillCategorySchema>;

export const WilayaSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    code: z.string().optional(),
    nameAr: z.string().optional(),
    nameFr: z.string().optional(),
  })
  .passthrough();

export type Wilaya = z.infer<typeof WilayaSchema>;

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

export const PublicMediaSchema = z
  .object({
    url: z.string().optional(),
    signedUrl: z.string().optional(),
  })
  .passthrough();

export type PublicMedia = z.infer<typeof PublicMediaSchema>;

// ---- Pure display helpers (no fetches) ----

// Registry codes are display-only (never route keys/links). Stored registryId
// values already carry the prefix; strip first so re-rendering never doubles it.
function prefixCode(registryId: string | null | undefined, prefix: string): string | null {
  if (!registryId) return null;
  const bare = registryId.replace(new RegExp(`^${prefix}-`), '');
  if (bare.trim() === '') return null;
  return `${prefix}-${bare}`;
}

export function orgDisplayCode(registryId: string | null | undefined): string | null {
  return prefixCode(registryId, 'ORG');
}

export function oppDisplayCode(registryId: string | null | undefined): string | null {
  return prefixCode(registryId, 'OPP');
}

export function expDisplayCode(registryId: string | null | undefined): string | null {
  return prefixCode(registryId, 'EXP');
}

export function orgDisplayName(
  org: OrganizationEmbed | PublicOrgCard | PublicOrgProfile | null | undefined,
  locale: string,
): string {
  if (!org) return '';
  if (locale === 'ar') return org.nameAr ?? org.nameFr ?? '';
  return org.nameFr ?? org.nameAr ?? '';
}

export function labelFor(
  label: { nameAr?: string | null; nameFr?: string | null } | null | undefined,
  locale: string,
): string {
  if (!label) return '';
  return (locale === 'ar' ? label.nameAr : label.nameFr) ?? '';
}

// Neutral duration: minutes in, whole-or-one-decimal hours out. Null when the
// backend sent no usable duration — the UI then omits the row (never invents).
export function hoursFromMinutes(durationMinutes: number | null | undefined): number | null {
  if (typeof durationMinutes !== 'number' || !Number.isFinite(durationMinutes) || durationMinutes <= 0)
    return null;
  return Math.round((durationMinutes / 60) * 10) / 10;
}

export function oppIdOf(opp: PublicOppCard | PublicOppDetail): string {
  return opp._id ?? opp.id ?? opp.slug ?? '';
}

export function oppSlugOf(opp: PublicOppCard | PublicOppDetail): string {
  return opp.slug ?? opp._id ?? opp.id ?? '';
}

export function positionIdOf(position: PublicPosition): string {
  return position._id ?? position.id ?? '';
}

export function orgSlugOf(
  org: OrganizationEmbed | PublicOrgCard | PublicOrgProfile | null | undefined,
): string | null {
  const slug = org?.slug;
  return slug && slug.trim() !== '' ? slug : null;
}

// Aggregates ride the public profile payload (OrgPublicStatsProvider); either
// key is accepted, both absent means "no ribbon numbers" (never zeroes).
export function aggregatesOf(profile: PublicOrgProfile | null | undefined): PublicOrgAggregates | null {
  if (!profile) return null;
  return profile.aggregates ?? profile.stats ?? null;
}

// OQ2-approved: server-returned per-tab counts are primary; page `total`
// (scoped to the active tab) is the fallback only when the server count for a
// tab is absent.
export function archiveCountFor(
  counts: ArchiveCounts | null | undefined,
  status: ArchiveStatus,
  pageTotal: number | null | undefined,
): number | null {
  const served = counts?.[status];
  if (typeof served === 'number' && Number.isFinite(served)) return served;
  if (typeof pageTotal === 'number' && Number.isFinite(pageTotal)) return pageTotal;
  return null;
}

// Related opportunities resolve through the slug carried in the detail org
// embed (OQ3: published-only scope enforced by the caller query).
export function relatedSlugOf(detail: PublicOppDetail | null | undefined): string | null {
  return orgSlugOf(detail?.organization);
}

// Neutral reliability rate: first served ratio wins; absent means the block is
// hidden (never a placeholder percent).
export function reliabilityRateOf(payload: OrgReliability | null | undefined): number | null {
  if (!payload) return null;
  for (const value of [payload.responseRate, payload.responseRatio, payload.decidedRatio]) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

export type ApplyGateReason = 'full' | 'deadline' | 'closed' | null;

// Pure Apply gate (mirrors the F5 semantics for the public detail screen):
// non-published → closed; past deadline → deadline; seats filled → full.
export function applyGateFor(
  detail: Pick<PublicOppDetail, 'status' | 'applicationDeadline'>,
  position: Pick<PublicPosition, 'requiredCount' | 'filledCount'>,
  nowIso?: string,
): ApplyGateReason {
  if (detail.status !== undefined && detail.status !== 'published') return 'closed';
  if (detail.applicationDeadline) {
    const now = nowIso ? new Date(nowIso).getTime() : Date.now();
    if (Number.isFinite(now) && new Date(detail.applicationDeadline).getTime() < now) return 'deadline';
  }
  if (
    typeof position.requiredCount === 'number' &&
    typeof position.filledCount === 'number' &&
    position.filledCount >= position.requiredCount
  )
    return 'full';
  return null;
}

export function mediaUrlOf(media: PublicMedia | undefined): string | null {
  if (!media) return null;
  return media.signedUrl ?? media.url ?? null;
}

type HttpClient = Pick<AxiosInstance, 'get'>;

export interface OrgSearchParams {
  q?: string;
  page?: number;
  limit?: number;
}

export async function searchPublicOrgs(
  client: HttpClient,
  params: OrgSearchParams,
): Promise<z.infer<ReturnType<typeof CursorPageSchema>>> {
  const { data } = await client.get('/organizations', {
    params: {
      ...(params.q?.trim() ? { q: params.q.trim() } : {}),
      ...(params.page !== undefined ? { page: params.page } : {}),
      limit: params.limit ?? 12,
    },
  });
  return CursorPageSchema(PublicOrgCardSchema).parse(data);
}

export async function getPublicOrgProfile(
  client: HttpClient,
  slug: string,
): Promise<PublicOrgProfile> {
  const { data } = await client.get(`/organizations/${encodeURIComponent(slug)}`);
  return PublicOrgProfileSchema.parse(data);
}

export interface OrgOppsParams {
  status?: ArchiveStatus;
  cursor?: string;
  limit?: number;
}

export async function listPublicOrgOpportunities(
  client: HttpClient,
  slug: string,
  params: OrgOppsParams,
): Promise<{ page: z.infer<ReturnType<typeof CursorPageSchema>>; counts: ArchiveCounts | null }> {
  const { data } = await client.get(`/organizations/${encodeURIComponent(slug)}/opportunities`, {
    params: {
      ...(params.status ? { status: params.status } : {}),
      ...(params.cursor ? { cursor: params.cursor } : {}),
      limit: params.limit ?? 12,
    },
  });
  const page = CursorPageSchema(PublicOppCardSchema).parse(data);
  const counts = ArchiveCountsSchema.nullable()
    .optional()
    .parse((data as { counts?: unknown }).counts ?? null);
  return { page, counts: counts ?? null };
}

export async function getPublicOrgReliability(
  client: HttpClient,
  slug: string,
): Promise<OrgReliability> {
  const { data } = await client.get(`/organizations/${encodeURIComponent(slug)}/reliability`);
  return OrgReliabilitySchema.parse(data);
}

export interface PublicFeedParams {
  q?: string;
  categoryId?: string;
  wilayaId?: string;
  sort?: string;
  cursor?: string;
  limit?: number;
}

export function toPublicFeedQuery(params: PublicFeedParams): Record<string, string | number> {
  const query: Record<string, string | number> = {};
  if (params.q?.trim()) query.q = params.q.trim();
  if (params.categoryId) query.categoryId = params.categoryId;
  if (params.wilayaId) query.wilayaId = params.wilayaId;
  if (params.sort) query.sort = params.sort;
  if (params.cursor) query.cursor = params.cursor;
  query.limit = params.limit ?? 12;
  return query;
}

export async function listPublicOpportunities(
  client: HttpClient,
  params: PublicFeedParams,
): Promise<z.infer<ReturnType<typeof CursorPageSchema>>> {
  const { data } = await client.get('/opportunities', { params: toPublicFeedQuery(params) });
  return CursorPageSchema(PublicOppCardSchema).parse(data);
}

export async function getPublicOpportunityDetail(
  client: HttpClient,
  idOrSlug: string,
): Promise<PublicOppDetail> {
  const { data } = await client.get(`/opportunities/${encodeURIComponent(idOrSlug)}`);
  return PublicOppDetailSchema.parse(data);
}

// OQ3-approved: related is the published-only archive read through the
// embedded org slug (small page); the current detail id is excluded client-side.
export async function listRelatedPublicOpportunities(
  client: HttpClient,
  orgSlug: string,
  excludeId?: string,
): Promise<PublicOppCard[]> {
  const { data } = await client.get(`/organizations/${encodeURIComponent(orgSlug)}/opportunities`, {
    params: { status: 'published', limit: 6 },
  });
  const page = CursorPageSchema(PublicOppCardSchema).parse(data);
  return excludeId ? page.items.filter((item) => oppIdOf(item) !== excludeId) : page.items;
}

export async function listTalentSamples(
  client: HttpClient,
  limit = 6,
): Promise<z.infer<ReturnType<typeof CursorPageSchema>>> {
  const { data } = await client.get('/talents', { params: { limit } });
  return CursorPageSchema(TalentSampleSchema).parse(data);
}

export async function listSkillCategories(client: HttpClient): Promise<SkillCategory[]> {
  const { data } = await client.get('/skill-categories');
  const parsed = z
    .object({ items: z.array(SkillCategorySchema).optional() })
    .passthrough()
    .parse(data);
  if (parsed.items) return parsed.items;
  return z.array(SkillCategorySchema).parse(data);
}

export async function listWilayas(client: HttpClient): Promise<Wilaya[]> {
  const { data } = await client.get('/locations/wilayas');
  const parsed = z
    .object({ items: z.array(WilayaSchema).optional() })
    .passthrough()
    .parse(data);
  if (parsed.items) return parsed.items;
  return z.array(WilayaSchema).parse(data);
}

export async function getPublicMedia(client: HttpClient, mediaId: string): Promise<PublicMedia> {
  const { data } = await client.get(`/media/${encodeURIComponent(mediaId)}`);
  return PublicMediaSchema.parse(data);
}
