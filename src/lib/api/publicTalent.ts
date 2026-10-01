import { z } from 'zod';
import type { AxiosInstance } from 'axios';

// F17 public-talent module: one typed function per public volunteer/talent
// read endpoint (base `/api/v1`). Verified read-only against
// backend/src/volunteers (public-volunteers.controller + TalentsQueryDto +
// PublicExperiencesQueryDto + TALENT_SORTS + PublicVolunteerProfile /
// TalentCard / PublicExperienceCard / PublicReviewCard / AreaOfContribution),
// backend/src/reviews (reviews.controller GET volunteers/:username/reviews),
// backend/src/common/seams/portfolio-query.service (PublicPortfolio +
// PublicMediaShape + PortfolioItemShape) and backend/src/media
// (media.controller GET :mediaId -> { media, url }).
//
// PRIVACY (the reason this module exists in its own shape): the standalone
// `/volunteers/:username/experiences` and `/volunteers/:username/portfolio`
// routes authorize on `publicProfile.enabled` ONLY - they do NOT re-apply
// `showExperiences` / `showPortfolio`. The embedded profile fields are the sole
// authoritative gate, so `resolvePublicProfileSections` below is the gate and
// the standalone calls are strictly continuations (see `experiencesGateOpen`).
//
// Gating convention confirmed in `getPublicProfile`: a closed show-flag yields
// `null` for its field, EXCEPT `preferredDomains` which is `[]`. An open flag
// with no content yields an empty array / `emptySchedule()`. The resolver below
// therefore treats `null` as closed and an empty collection as open-but-empty.
//
// `duration` on a public experience is MINUTES (not `durationMinutes`).
// `registryId` already carries its prefix (`VOL-000042`), so `registryCode` is
// idempotent rather than concatenating.
// `fullName` (first + last) is parsed but must never be displayed - see
// `publicDisplayName`.

export const TALENT_SORTS = ['newest', 'oldest', 'experiences_desc'] as const;
export type TalentSort = (typeof TALENT_SORTS)[number];

/** Derived contribution areas are read-only and capped (no client recompute). */
export const AREAS_MAX = 8;

/** Backend pagination ceiling (`MAX_LIMIT`); the profile embeds the same window. */
export const PUBLIC_PAGE_MAX = 50;

export const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type DayKey = (typeof DAY_KEYS)[number];

export const PublicOrganizationEmbedSchema = z
  .object({
    id: z.string().optional(),
    slug: z.string().optional(),
    nameFr: z.string().nullable().optional(),
    nameAr: z.string().nullable().optional(),
  })
  .passthrough();

export type PublicOrganizationEmbed = z.infer<typeof PublicOrganizationEmbedSchema>;

export const PublicTalentSkillSchema = z
  .object({
    skillId: z.string(),
    nameFr: z.string().optional(),
    nameAr: z.string().optional(),
    level: z.number().optional(),
    isPrimary: z.boolean().optional(),
  })
  .passthrough();

export type PublicTalentSkill = z.infer<typeof PublicTalentSkillSchema>;

export const PublicVolunteerStatsSchema = z
  .object({
    completedTasks: z.number(),
    verifiedExperiences: z.number(),
    volunteerHours: z.number(),
  })
  .passthrough();

export type PublicVolunteerStats = z.infer<typeof PublicVolunteerStatsSchema>;

export const AreaOfContributionSchema = z
  .object({
    categoryId: z.string(),
    nameFr: z.string(),
    nameAr: z.string(),
    percent: z.number(),
    count: z.number(),
  })
  .passthrough();

export type AreaOfContribution = z.infer<typeof AreaOfContributionSchema>;

export const PublicExperienceEvidenceSchema = z
  .object({
    mediaId: z.string(),
    type: z.string().optional(),
    mimeType: z.string().nullable().optional(),
    filename: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
  })
  .passthrough();

export type PublicExperienceEvidence = z.infer<typeof PublicExperienceEvidenceSchema>;

export const PublicExperienceReviewSchema = z
  .object({
    rating: z.number(),
    notes: z.string().nullable().optional(),
  })
  .passthrough();

export const PublicExperienceSchema = z
  .object({
    id: z.string(),
    registryId: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    /** MINUTES. Never read a `durationMinutes` key from a public experience. */
    duration: z.number(),
    skills: z.array(z.string()).optional().default([]),
    organization: PublicOrganizationEmbedSchema.nullable().optional(),
    verifiedAt: z.string(),
    verificationCode: z.string().optional(),
    review: PublicExperienceReviewSchema.nullable().optional(),
    evidence: z.array(PublicExperienceEvidenceSchema).optional().default([]),
  })
  .passthrough();

export type PublicExperience = z.infer<typeof PublicExperienceSchema>;

export const PublicReviewSchema = z
  .object({
    id: z.string(),
    rating: z.number(),
    comment: z.string().nullable().optional(),
    createdAt: z.string(),
    organization: PublicOrganizationEmbedSchema.nullable().optional(),
  })
  .passthrough();

export type PublicReview = z.infer<typeof PublicReviewSchema>;

export const TimeSlotSchema = z
  .object({
    from: z.string(),
    to: z.string(),
  })
  .passthrough();

export const WeeklyScheduleSchema = z.object({
  monday: z.array(TimeSlotSchema).optional().default([]),
  tuesday: z.array(TimeSlotSchema).optional().default([]),
  wednesday: z.array(TimeSlotSchema).optional().default([]),
  thursday: z.array(TimeSlotSchema).optional().default([]),
  friday: z.array(TimeSlotSchema).optional().default([]),
  saturday: z.array(TimeSlotSchema).optional().default([]),
  sunday: z.array(TimeSlotSchema).optional().default([]),
});

export type WeeklySchedule = z.infer<typeof WeeklyScheduleSchema>;

export const PublicMediaSchema = z
  .object({
    mediaId: z.string().optional(),
    id: z.string().optional(),
    _id: z.string().optional(),
    type: z.string().optional(),
    mimeType: z.string().nullable().optional(),
    filename: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
  })
  .passthrough();

export type PublicMedia = z.infer<typeof PublicMediaSchema>;

/** `GET /media/:mediaId` -> `{ media, url }` (url is the signed/public read URL). */
export const PublicMediaReadSchema = z
  .object({
    media: PublicMediaSchema,
    url: z.string().nullable().optional(),
  })
  .passthrough();

export type PublicMediaRead = z.infer<typeof PublicMediaReadSchema>;

/** NOT a CursorPage: the public portfolio returns the complete `{ items }` set. */
export const PublicPortfolioItemSchema = z
  .object({
    id: z.string(),
    mediaId: z.string().optional(),
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    typeLabel: z.string().nullable().optional(),
    tags: z.array(z.string()).optional().default([]),
    media: z.array(PublicMediaSchema).optional().default([]),
  })
  .passthrough();

export type PublicPortfolioItem = z.infer<typeof PublicPortfolioItemSchema>;

export const PublicPortfolioSchema = z
  .object({
    items: z.array(PublicPortfolioItemSchema),
  })
  .passthrough();

export type PublicPortfolio = z.infer<typeof PublicPortfolioSchema>;

export const PublicVolunteerProfileSchema = z
  .object({
    username: z.string(),
    registryId: z.string(),
    /** First + last. Parsed for completeness; NEVER rendered. */
    fullName: z.string().nullable().optional(),
    firstName: z.string().nullable().optional(),
    avatar: z.string().nullable().optional(),
    /** Cover banner media id when the volunteer made it public (else null). */
    banner: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
    headline: z.string().nullable().optional(),
    availabilityNote: z.string().nullable().optional(),
    preferredDomains: z.array(z.string()).optional().default([]),
    geographicBase: z.string().nullable().optional(),
    /** Ungated by any show-flag; deliberately NOT rendered (membership claim). */
    createdAt: z.string().optional(),
    stats: PublicVolunteerStatsSchema.nullable().optional(),
    areasOfContribution: z.array(AreaOfContributionSchema).nullable().optional(),
    location: z
      .object({
        wilayaId: z.string().optional(),
        municipalityId: z.string().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    skills: z.array(PublicTalentSkillSchema).nullable().optional(),
    experiences: z.array(PublicExperienceSchema).nullable().optional(),
    availability: WeeklyScheduleSchema.nullable().optional(),
    portfolio: PublicPortfolioSchema.nullable().optional(),
    isFavorited: z.boolean().optional(),
    favoriteCount: z.number().optional(),
  })
  .passthrough();

export type PublicVolunteerProfile = z.infer<typeof PublicVolunteerProfileSchema>;

/** The `GET /talents` card projection. Thin: no headline/counts/availability. */
export const PublicTalentCardSchema = z
  .object({
    username: z.string(),
    registryId: z.string(),
    firstName: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
    location: z
      .object({
        wilayaId: z.string().optional(),
        municipalityId: z.string().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    skills: z.array(PublicTalentSkillSchema).nullable().optional(),
    avatar: z.string().nullable().optional(),
    stats: PublicVolunteerStatsSchema.nullable().optional(),
    isFavorited: z.boolean().optional(),
    favoriteCount: z.number().optional(),
  })
  .passthrough();

export type PublicTalentCard = z.infer<typeof PublicTalentCardSchema>;

const CursorPage = <T extends z.ZodTypeAny>(item: T) =>
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

export type PublicCursorPage<T> = {
  items: T[];
  nextCursor?: string | null;
  limit?: number;
  total: number;
  page?: number;
  pages?: number;
};

export const PublicTalentsPageSchema = CursorPage(PublicTalentCardSchema).extend({
  facets: z
    .object({
      skills: z
        .array(z.object({ skillId: z.string(), count: z.number() }).passthrough())
        .optional()
        .default([]),
      wilayas: z
        .array(z.object({ wilayaId: z.string(), count: z.number() }).passthrough())
        .optional()
        .default([]),
    })
    .passthrough()
    .default({ skills: [], wilayas: [] }),
});

export type PublicTalentsPage = z.infer<typeof PublicTalentsPageSchema>;

export type PublicExperiencesPage = PublicCursorPage<PublicExperience>;
export type PublicReviewsPage = PublicCursorPage<PublicReview>;

// ---------------------------------------------------------------------------
// Opt-out gating (design D2). Pure, so "closed never leaks" is unit-testable
// without rendering: a component renders `section.open ? ... : null`, which is
// what makes "no heading / no placeholder / no reserved space" mechanical.
// ---------------------------------------------------------------------------

export interface PublicSection<T> {
  open: boolean;
  data: T;
}

export interface PublicProfileSections {
  avatar: PublicSection<string | null>;
  bio: PublicSection<{
    firstName: string | null;
    headline: string | null;
    bio: string | null;
    availabilityNote: string | null;
    preferredDomains: string[];
    geographicBase: string | null;
  }>;
  location: PublicSection<{ wilayaId?: string; municipalityId?: string } | null>;
  stats: PublicSection<PublicVolunteerStats | null>;
  areas: PublicSection<AreaOfContribution[]>;
  experiences: PublicSection<PublicExperience[]>;
  availability: PublicSection<WeeklySchedule | null>;
  skills: PublicSection<PublicTalentSkill[]>;
  portfolio: PublicSection<PublicPortfolioItem[]>;
}

export function emptySchedule(): WeeklySchedule {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };
}

function present(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

export function resolvePublicProfileSections(
  profile: PublicVolunteerProfile,
): PublicProfileSections {
  const bioOpen =
    present(profile.firstName) ||
    present(profile.headline) ||
    present(profile.bio) ||
    present(profile.availabilityNote) ||
    present(profile.geographicBase) ||
    (profile.preferredDomains?.length ?? 0) > 0;
  return {
    avatar: { open: present(profile.avatar), data: present(profile.avatar) ? profile.avatar : null },
    bio: {
      open: bioOpen,
      data: {
        firstName: present(profile.firstName) ? profile.firstName : null,
        headline: present(profile.headline) ? profile.headline : null,
        bio: present(profile.bio) ? profile.bio : null,
        availabilityNote: present(profile.availabilityNote)
          ? profile.availabilityNote
          : null,
        preferredDomains: profile.preferredDomains ?? [],
        geographicBase: present(profile.geographicBase) ? profile.geographicBase : null,
      },
    },
    location: {
      open: profile.location != null,
      data: profile.location ?? null,
    },
    stats: { open: profile.stats != null, data: profile.stats ?? null },
    // `null` closes the areas gate (it shares `showExperiences`).
    areas: {
      open: profile.areasOfContribution != null,
      data: profile.areasOfContribution ?? [],
    },
    experiences: {
      open: profile.experiences != null,
      data: profile.experiences ?? [],
    },
    availability: {
      open: profile.availability != null,
      data: profile.availability ?? emptySchedule(),
    },
    skills: { open: profile.skills != null, data: profile.skills ?? [] },
    portfolio: {
      open: profile.portfolio != null,
      data: profile.portfolio?.items ?? [],
    },
  };
}

/** `false` keeps the standalone experiences route from being requested at all. */
export function experiencesGateOpen(profile: PublicVolunteerProfile | null | undefined): boolean {
  return profile?.experiences != null;
}

/** True for a bare 24-hex Mongo id — never render these as visible text. */
export function isRawDbId(value: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(value.trim());
}

/**
 * Maps raw experience skill entries (backend `skills` is an ObjectId
 * snapshot, not names) to human labels via the profile skill catalog.
 * Entries that resolve to a catalog name render the name; unresolvable raw
 * ids are dropped so a database id never reaches the UI. Plain-text entries
 * (if any) pass through unchanged.
 */
export function humanExperienceSkillLabels(
  skills: string[] | null | undefined,
  nameById: Map<string, string>,
): string[] {
  const out: string[] = [];
  for (const skill of skills ?? []) {
    if (typeof skill !== 'string' || skill.trim() === '') continue;
    const named = nameById.get(skill);
    if (named && named.trim() !== '') {
      if (!out.includes(named)) out.push(named);
      continue;
    }
    if (isRawDbId(skill)) continue;
    if (!out.includes(skill)) out.push(skill);
  }
  return out;
}

/** Skill-id -> locale display name from the public profile skill catalog. */
export function skillNameMapOf(
  skills: PublicTalentSkill[] | null | undefined,
  locale: string,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const skill of skills ?? []) {
    const name = localizedName(
      { nameFr: skill.nameFr ?? null, nameAr: skill.nameAr ?? null },
      locale,
    );
    if (skill.skillId && name.trim() !== '') map.set(skill.skillId, name);
  }
  return map;
}

/** `false` keeps the standalone portfolio route from being requested at all. */
export function portfolioGateOpen(profile: PublicVolunteerProfile | null | undefined): boolean {
  return profile?.portfolio != null;
}

// ---------------------------------------------------------------------------
// Display helpers (pure, unit-tested).
// ---------------------------------------------------------------------------

/** First name only; `username` is the fallback so an opted-out profile still reads. */
export function publicDisplayName(
  firstName: string | null | undefined,
  username: string,
): string {
  return present(firstName) ? firstName : username;
}

/** Idempotent registry code: `VOL-000042` stays one prefix, `000042` gains it. */
export function registryCode(
  registryId: string | null | undefined,
  prefix: 'VOL' | 'EXP',
): string | null {
  if (!present(registryId)) return null;
  const bare = registryId.startsWith(`${prefix}-`) ? registryId.slice(prefix.length + 1) : registryId;
  return `${prefix}-${bare}`;
}

export function localizedName(
  entity: { nameFr?: string | null; nameAr?: string | null } | null | undefined,
  locale: string,
): string {
  if (!entity) return '';
  if (locale === 'ar' && present(entity.nameAr)) return entity.nameAr;
  if (present(entity.nameFr)) return entity.nameFr;
  return entity.nameAr ?? entity.nameFr ?? '';
}

/** MINUTES -> hours string, mirroring F5's `hoursOf` rounding. */
export function hoursFromMinutes(minutes: number | null | undefined): string | null {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return null;
  return String(Math.round((minutes / 60) * 10) / 10);
}

/** Embedded rows first, then unseen paged rows, deduped by `id`. */
export function mergeUniqueById<T extends { id: string }>(
  embedded: T[],
  paged: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of [...embedded, ...paged]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

/** Read-time order only: percent desc, capped. No recompute, no re-weight. */
export function sortAreasByPercentDesc(areas: AreaOfContribution[]): AreaOfContribution[] {
  return [...areas].sort((a, b) => b.percent - a.percent).slice(0, AREAS_MAX);
}

/** Org + date inputs for the inline "verified by" line (page formats the date). */
export function verifiedLineParts(
  experience: PublicExperience,
  locale: string,
): { organization: string; verifiedAt: string | null } {
  return {
    organization: localizedName(experience.organization, locale),
    verifiedAt: present(experience.verifiedAt) ? experience.verifiedAt : null,
  };
}

export interface PublicTalentFilters {
  q?: string;
  skillId?: string;
  categoryId?: string;
  wilayaId?: string;
  skillIds?: string[];
  wilayaIds?: string[];
  minExperiences?: number;
  hasAvailability?: boolean;
  portfolio?: boolean;
  /** Unvalidated on purpose so an out-of-whitelist value can be rejected. */
  sort?: string;
  cursor?: string;
  limit?: number;
}

export type PublicTalentQuery =
  | { ok: true; params: Record<string, string> }
  | { ok: false; reason: 'invalid-sort' };

/**
 * Pure param builder. Drops unset values so the URL stays shareable, coerces the
 * thresholds to the backend's string forms, and refuses a `sort` outside the
 * server whitelist so no request is ever sent for it.
 */
export function buildTalentsQuery(filters: PublicTalentFilters): PublicTalentQuery {
  const params: Record<string, string> = {};
  const set = (key: string, value: string | undefined) => {
    if (value !== undefined && value !== '') params[key] = value;
  };
  if (filters.sort !== undefined && filters.sort !== '') {
    if (!(TALENT_SORTS as readonly string[]).includes(filters.sort)) {
      return { ok: false, reason: 'invalid-sort' };
    }
    set('sort', filters.sort);
  }
  set('q', filters.q?.trim().slice(0, 120) || undefined);
  set('skillId', filters.skillId?.trim() || undefined);
  set('categoryId', filters.categoryId?.trim() || undefined);
  set('wilayaId', filters.wilayaId?.trim() || undefined);
  set('skillIds', filters.skillIds?.map((s) => s.trim()).filter(Boolean).join(',') || undefined);
  set('wilayaIds', filters.wilayaIds?.map((w) => w.trim()).filter(Boolean).join(',') || undefined);
  if (typeof filters.minExperiences === 'number' && filters.minExperiences > 0) {
    params.minExperiences = String(filters.minExperiences);
  }
  if (typeof filters.hasAvailability === 'boolean') {
    params.hasAvailability = filters.hasAvailability ? 'true' : 'false';
  }
  if (typeof filters.portfolio === 'boolean') {
    params.portfolio = filters.portfolio ? 'true' : 'false';
  }
  set('cursor', filters.cursor);
  if (typeof filters.limit === 'number' && filters.limit > 0) {
    params.limit = String(Math.min(filters.limit, PUBLIC_PAGE_MAX));
  }
  return { ok: true, params };
}

/** Resolved display URL for a guest media read, or null when unavailable. */
export function mediaUrlOf(read: PublicMediaRead | null | undefined): string | null {
  if (!read) return null;
  return present(read.url) ? read.url : present(read.media?.url) ? read.media.url : null;
}

export function isImageMedia(media: PublicMedia | null | undefined): boolean {
  if (!media) return false;
  if (media.type === 'image') return true;
  return typeof media.mimeType === 'string' && media.mimeType.startsWith('image/');
}

export function isLinkMedia(media: PublicMedia | null | undefined): boolean {
  return media?.type === 'link' && present(media?.url);
}

type HttpClient = Pick<AxiosInstance, 'get'>;

const path = (username: string) => `/volunteers/${encodeURIComponent(username)}`;

export async function getPublicTalentProfile(
  client: HttpClient,
  username: string,
): Promise<PublicVolunteerProfile> {
  const { data } = await client.get(path(username));
  return PublicVolunteerProfileSchema.parse(data);
}

/**
 * Paginates the full public experience set. Only ever called while
 * `experiencesGateOpen(profile)` is true; the caller requests
 * `PUBLIC_PAGE_MAX` so this page aligns with the embedded window.
 */
export async function getPublicTalentExperiences(
  client: HttpClient,
  username: string,
  params: { cursor?: string; limit?: number } = {},
): Promise<PublicExperiencesPage> {
  const query: Record<string, string> = {};
  if (params.cursor) query.cursor = params.cursor;
  if (typeof params.limit === 'number' && params.limit > 0) {
    query.limit = String(Math.min(params.limit, PUBLIC_PAGE_MAX));
  }
  const { data } = await client.get(`${path(username)}/experiences`, { params: query });
  return CursorPage(PublicExperienceSchema).parse(data) as PublicExperiencesPage;
}

/**
 * One typed function per endpoint. The route does NOT call this by default:
 * `getPublicPortfolio` returns the complete `{ items }` set (no cursor), so the
 * embedded `portfolio` field is already authoritative once the gate is open.
 */
export async function getPublicTalentPortfolio(
  client: HttpClient,
  username: string,
): Promise<PublicPortfolio> {
  const { data } = await client.get(`${path(username)}/portfolio`);
  return PublicPortfolioSchema.parse(data);
}

export async function getPublicTalentReviews(
  client: HttpClient,
  username: string,
  params: { cursor?: string; limit?: number } = {},
): Promise<PublicReviewsPage> {
  const query: Record<string, string> = {};
  if (params.cursor) query.cursor = params.cursor;
  if (typeof params.limit === 'number' && params.limit > 0) {
    query.limit = String(Math.min(params.limit, PUBLIC_PAGE_MAX));
  }
  const { data } = await client.get(`${path(username)}/reviews`, { params: query });
  return CursorPage(PublicReviewSchema).parse(data) as PublicReviewsPage;
}

export async function listPublicTalents(
  client: HttpClient,
  filters: PublicTalentFilters = {},
): Promise<PublicTalentsPage> {
  const built = buildTalentsQuery(filters);
  if (!built.ok) throw new Error('INVALID_TALENT_SORT');
  const { data } = await client.get('/talents', { params: built.params });
  return PublicTalentsPageSchema.parse(data);
}

/** Guest-safe read: `GET /media/:mediaId` is `@Public` with an optional JWT. */
export async function getPublicMedia(
  client: HttpClient,
  mediaId: string,
): Promise<PublicMediaRead> {
  const { data } = await client.get(`/media/${encodeURIComponent(mediaId)}`);
  return PublicMediaReadSchema.parse(data);
}
