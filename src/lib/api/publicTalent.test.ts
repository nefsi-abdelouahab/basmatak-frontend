import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  AREAS_MAX,
  PublicPortfolioSchema,
  PublicTalentsPageSchema,
  PublicVolunteerProfileSchema,
  TALENT_SORTS,
  buildTalentsQuery,
  experiencesGateOpen,
  getPublicMedia,
  getPublicTalentExperiences,
  getPublicTalentPortfolio,
  getPublicTalentProfile,
  getPublicTalentReviews,
  hoursFromMinutes,
  isImageMedia,
  isLinkMedia,
  listPublicTalents,
  localizedName,
  mediaUrlOf,
  mergeUniqueById,
  portfolioGateOpen,
  publicDisplayName,
  registryCode,
  resolvePublicProfileSections,
  sortAreasByPercentDesc,
  verifiedLineParts,
} from './publicTalent';

function stubClient(handler?: (url: string, config?: unknown) => unknown) {
  const get = vi.fn(async (url: string, config?: unknown) => ({ data: handler?.(url, config) }));
  return { client: { get } as unknown as AxiosInstance, get };
}

const org = { id: 'o1', slug: 'el-amel', nameFr: 'Association El-Amel', nameAr: 'جمعية الأمل' };

const experience = {
  id: '64f0000000000000000000a1',
  registryId: 'EXP-000001',
  title: 'Beach cleanup',
  description: 'Collected waste along the coast.',
  duration: 180,
  skills: ['s1'],
  organization: org,
  verifiedAt: '2026-03-14T00:00:00.000Z',
  verificationCode: 'ABCDEFGH',
  review: { rating: 5, notes: null },
  evidence: [{ mediaId: 'm1', type: 'image', mimeType: 'image/png', filename: 'a.png', url: null }],
};

const openProfile = {
  username: 'amineb',
  registryId: 'VOL-000042',
  fullName: 'Amine Bensalah',
  firstName: 'Amine',
  avatar: 'm-avatar',
  bio: 'Engineer.',
  headline: 'Field engineer',
  availabilityNote: 'Evenings',
  preferredDomains: ['Environment'],
  geographicBase: 'Adrar',
  createdAt: '2025-01-05T00:00:00.000Z',
  stats: { completedTasks: 24, verifiedExperiences: 18, volunteerHours: 96 },
  areasOfContribution: [{ categoryId: 'c1', nameFr: 'Environment', nameAr: 'البيئة', percent: 40, count: 4 }],
  location: { wilayaId: '01', municipalityId: '0101' },
  skills: [{ skillId: 's1', nameFr: 'Cleanup', nameAr: 'تنظيف', level: 3, isPrimary: true }],
  experiences: [experience],
  availability: { monday: [{ from: '09:00', to: '12:00' }] },
  portfolio: { items: [{ id: 'p1', title: 'Poster', tags: ['design'], media: [] }] },
  isFavorited: false,
  favoriteCount: 4,
};

function closedProfile(overrides: Record<string, unknown> = {}) {
  return {
    ...openProfile,
    firstName: null,
    headline: null,
    bio: null,
    availabilityNote: null,
    preferredDomains: [],
    geographicBase: null,
    stats: null,
    areasOfContribution: null,
    location: null,
    skills: null,
    experiences: null,
    availability: null,
    portfolio: null,
    ...overrides,
  };
}

describe('public profile schema', () => {
  it('parses the open profile with every gated field present', () => {
    const parsed = PublicVolunteerProfileSchema.parse(openProfile);
    expect(parsed.username).toBe('amineb');
    expect(parsed.experiences?.[0]?.duration).toBe(180);
    expect(parsed.availability?.monday[0]?.to).toBe('12:00');
  });

  it('parses a fully opted-out profile (every gated field null)', () => {
    const parsed = PublicVolunteerProfileSchema.parse(closedProfile());
    expect(parsed.stats).toBeNull();
    expect(parsed.skills).toBeNull();
    expect(parsed.experiences).toBeNull();
    expect(parsed.portfolio).toBeNull();
    // The username and registry code survive every opt-out.
    expect(parsed.username).toBe('amineb');
    expect(parsed.registryId).toBe('VOL-000042');
  });

  it('tolerates absent optional fields', () => {
    const parsed = PublicVolunteerProfileSchema.parse({ username: 'x', registryId: 'VOL-1' });
    expect(parsed.firstName).toBeUndefined();
    expect(parsed.preferredDomains).toEqual([]);
  });
});

describe('opt-out gating resolver', () => {
  it('opens every section when the flags are on', () => {
    const sections = resolvePublicProfileSections(PublicVolunteerProfileSchema.parse(openProfile));
    expect(sections.avatar.open).toBe(true);
    expect(sections.bio.open).toBe(true);
    expect(sections.stats.open).toBe(true);
    expect(sections.areas.open).toBe(true);
    expect(sections.experiences.open).toBe(true);
    expect(sections.availability.open).toBe(true);
    expect(sections.skills.open).toBe(true);
    expect(sections.portfolio.open).toBe(true);
    expect(sections.location.open).toBe(true);
  });

  it('closes each section independently and yields empty data, never stale data', () => {
    const sections = resolvePublicProfileSections(PublicVolunteerProfileSchema.parse(closedProfile()));
    expect(sections.avatar.open).toBe(true); // avatar is not a showBiography field
    expect(sections.bio.open).toBe(false);
    expect(sections.stats.open).toBe(false);
    expect(sections.stats.data).toBeNull();
    expect(sections.areas.open).toBe(false);
    expect(sections.areas.data).toEqual([]);
    expect(sections.experiences.open).toBe(false);
    expect(sections.experiences.data).toEqual([]);
    expect(sections.availability.open).toBe(false);
    expect(sections.skills.open).toBe(false);
    expect(sections.skills.data).toEqual([]);
    expect(sections.portfolio.open).toBe(false);
    expect(sections.portfolio.data).toEqual([]);
    expect(sections.location.open).toBe(false);
  });

  it('distinguishes a closed flag (null) from an open-but-empty one ([])', () => {
    const emptyAreas = resolvePublicProfileSections(
      PublicVolunteerProfileSchema.parse({ ...openProfile, experiences: [], areasOfContribution: [] }),
    );
    expect(emptyAreas.experiences.open).toBe(true);
    expect(emptyAreas.experiences.data).toEqual([]);
    expect(emptyAreas.areas.open).toBe(true);
    expect(emptyAreas.areas.data).toEqual([]);

    const emptyAvailability = resolvePublicProfileSections(
      PublicVolunteerProfileSchema.parse({ ...openProfile, availability: {} }),
    );
    expect(emptyAvailability.availability.open).toBe(true);
    expect(emptyAvailability.availability.data?.monday).toEqual([]);
  });

  it('never treats an empty preferredDomains as evidence the bio flag is open', () => {
    const sections = resolvePublicProfileSections(
      PublicVolunteerProfileSchema.parse({
        ...closedProfile(),
        // `[]` is what the backend sends for a CLOSED showBiography.
        preferredDomains: [],
      }),
    );
    expect(sections.bio.open).toBe(false);
  });

  it('keeps a closed portfolio/experiences gate from authorizing the standalone routes', () => {
    const closed = PublicVolunteerProfileSchema.parse(closedProfile());
    expect(portfolioGateOpen(closed)).toBe(false);
    expect(experiencesGateOpen(closed)).toBe(false);
    const open = PublicVolunteerProfileSchema.parse(openProfile);
    expect(portfolioGateOpen(open)).toBe(true);
    expect(experiencesGateOpen(open)).toBe(true);
    expect(portfolioGateOpen(null)).toBe(false);
    expect(experiencesGateOpen(undefined)).toBe(false);
  });
});

describe('display helpers', () => {
  it('never returns the surname', () => {
    const parsed = PublicVolunteerProfileSchema.parse(openProfile);
    expect(publicDisplayName(parsed.firstName, parsed.username)).toBe('Amine');
    expect(publicDisplayName('Amine', 'amineb')).toBe('Amine');
    // Opted out (showBiography off nulls firstName) -> username fallback only.
    expect(publicDisplayName(null, 'amineb')).toBe('amineb');
    expect(publicDisplayName('   ', 'amineb')).toBe('amineb');
    expect(publicDisplayName(null, 'amineb')).not.toContain('Bensalah');
  });

  it('renders an idempotent registry code', () => {
    expect(registryCode('VOL-000042', 'VOL')).toBe('VOL-000042');
    expect(registryCode('000042', 'VOL')).toBe('VOL-000042');
    expect(registryCode('VOL-000042', 'VOL')).not.toBe('VOL-VOL-000042');
    expect(registryCode('EXP-000001', 'EXP')).toBe('EXP-000001');
    expect(registryCode('000001', 'EXP')).toBe('EXP-000001');
    expect(registryCode(null, 'VOL')).toBeNull();
    expect(registryCode('  ', 'VOL')).toBeNull();
  });

  it('converts duration minutes to hours and never reads durationMinutes', () => {
    expect(hoursFromMinutes(180)).toBe('3');
    expect(hoursFromMinutes(90)).toBe('1.5');
    expect(hoursFromMinutes(0)).toBeNull();
    expect(hoursFromMinutes(null)).toBeNull();
    const parsed = PublicVolunteerProfileSchema.parse(openProfile);
    expect('durationMinutes' in (parsed.experiences?.[0] ?? {})).toBe(false);
  });

  it('picks the locale name with a fallback', () => {
    expect(localizedName(org, 'ar')).toBe('جمعية الأمل');
    expect(localizedName(org, 'en')).toBe('Association El-Amel');
    expect(localizedName({ nameFr: null, nameAr: 'x' }, 'en')).toBe('x');
    expect(localizedName(null, 'en')).toBe('');
  });

  it('builds the inline verification line parts', () => {
    const parsed = PublicVolunteerProfileSchema.parse(openProfile);
    const parts = verifiedLineParts(parsed.experiences![0], 'en');
    expect(parts.organization).toBe('Association El-Amel');
    expect(parts.verifiedAt).toBe('2026-03-14T00:00:00.000Z');
    expect(verifiedLineParts({ ...experience, organization: null }, 'en').organization).toBe('');
  });

  it('merges paged rows over embedded rows without duplicating the boundary', () => {
    const a = { id: '1' };
    const b = { id: '2' };
    const c = { id: '3' };
    expect(mergeUniqueById([a, b], [b, c])).toEqual([a, b, c]);
    expect(mergeUniqueById([], [a])).toEqual([a]);
    expect(mergeUniqueById([a], [])).toEqual([a]);
  });

  it('caps derived areas at 8 in percent-descending order', () => {
    const areas = Array.from({ length: 12 }, (_v, i) => ({
      categoryId: `c${i}`,
      nameFr: `F${i}`,
      nameAr: `A${i}`,
      percent: i,
      count: i,
    }));
    const sorted = sortAreasByPercentDesc(areas);
    expect(sorted).toHaveLength(AREAS_MAX);
    expect(sorted[0]?.percent).toBe(11);
    expect(sorted[7]?.percent).toBe(4);
    // Source array untouched (no client-side mutation/recompute).
    expect(areas[0]?.percent).toBe(0);
  });

  it('classifies media and resolves its guest URL', () => {
    expect(isImageMedia({ type: 'image' })).toBe(true);
    expect(isImageMedia({ mimeType: 'image/webp' })).toBe(true);
    expect(isImageMedia({ type: 'link', url: 'https://x' })).toBe(false);
    expect(isLinkMedia({ type: 'link', url: 'https://x' })).toBe(true);
    expect(isLinkMedia({ type: 'link', url: null })).toBe(false);
    expect(mediaUrlOf({ media: {}, url: 'https://signed' })).toBe('https://signed');
    expect(mediaUrlOf({ media: { url: 'https://plain' }, url: null })).toBe('https://plain');
    expect(mediaUrlOf(null)).toBeNull();
  });
});

describe('talents query builder', () => {
  it('exposes only the server sort whitelist', () => {
    expect([...TALENT_SORTS]).toEqual(['newest', 'oldest', 'experiences_desc']);
  });

  it('drops unset values and coerces thresholds to the backend string forms', () => {
    const built = buildTalentsQuery({
      q: '  amine  ',
      skillIds: ['s1', ' s2 ', ''],
      wilayaIds: ['16'],
      minExperiences: 3,
      hasAvailability: true,
      portfolio: false,
      sort: 'newest',
      limit: 20,
    });
    expect(built).toEqual({
      ok: true,
      params: {
        q: 'amine',
        skillIds: 's1,s2',
        wilayaIds: '16',
        minExperiences: '3',
        hasAvailability: 'true',
        portfolio: 'false',
        sort: 'newest',
        limit: '20',
      },
    });
  });

  it('sends nothing but paging for an unfiltered first page', () => {
    expect(buildTalentsQuery({ limit: 20 })).toEqual({ ok: true, params: { limit: '20' } });
  });

  it('rejects a sort outside the whitelist before any request', () => {
    expect(buildTalentsQuery({ sort: 'popular' })).toEqual({ ok: false, reason: 'invalid-sort' });
    expect(buildTalentsQuery({ sort: 'expiriences_desc' })).toEqual({
      ok: false,
      reason: 'invalid-sort',
    });
  });

  it('caps the page size at the backend maximum', () => {
    const built = buildTalentsQuery({ limit: 500 });
    expect(built).toEqual({ ok: true, params: { limit: '50' } });
  });
});

describe('endpoint functions', () => {
  it('reads the public profile by percent-encoded username', async () => {
    const { client, get } = stubClient(() => openProfile);
    const profile = await getPublicTalentProfile(client, 'amine b/x');
    expect(get).toHaveBeenCalledWith('/volunteers/amine%20b%2Fx');
    expect(profile.username).toBe('amineb');
  });

  it('pages experiences with cursor + limit', async () => {
    const { client, get } = stubClient(() => ({
      items: [experience],
      nextCursor: 'cur2',
      limit: 50,
      total: 60,
      page: 1,
      pages: 2,
    }));
    const page = await getPublicTalentExperiences(client, 'amineb', { limit: 50 });
    expect(get).toHaveBeenCalledWith('/volunteers/amineb/experiences', { params: { limit: '50' } });
    expect(page.total).toBe(60);
    expect(page.items[0]?.duration).toBe(180);
  });

  it('parses the portfolio as a plain { items } set, not a CursorPage', () => {
    const parsed = PublicPortfolioSchema.parse({ items: [{ id: 'p1', title: 'Poster' }] });
    expect(parsed.items).toHaveLength(1);
    expect('total' in parsed).toBe(false);
  });

  it('reads the portfolio endpoint', async () => {
    const { client, get } = stubClient(() => ({ items: [] }));
    await getPublicTalentPortfolio(client, 'amineb');
    expect(get).toHaveBeenCalledWith('/volunteers/amineb/portfolio');
  });

  it('pages public reviews', async () => {
    const { client, get } = stubClient(() => ({
      items: [{ id: 'r1', rating: 5, comment: 'Great', createdAt: '2026-02-01T00:00:00.000Z', organization: org }],
      nextCursor: null,
      total: 1,
      page: 1,
      pages: 1,
    }));
    const page = await getPublicTalentReviews(client, 'amineb', { limit: 5 });
    expect(get).toHaveBeenCalledWith('/volunteers/amineb/reviews', { params: { limit: '5' } });
    expect(page.items[0]?.organization?.nameFr).toBe('Association El-Amel');
  });

  it('parses the talents page totals and facets', async () => {
    const { client, get } = stubClient(() => ({
      items: [
        {
          username: 'amineb',
          registryId: 'VOL-000042',
          firstName: 'Amine',
          bio: 'Engineer.',
          location: { wilayaId: '01' },
          skills: [],
          avatar: null,
          stats: null,
          isFavorited: false,
          favoriteCount: 2,
        },
      ],
      nextCursor: 'c2',
      limit: 20,
      total: 41,
      page: 1,
      pages: 3,
      facets: {
        skills: [{ skillId: 's1', count: 12 }],
        wilayas: [{ wilayaId: '16', count: 5 }],
      },
    }));
    const page = await listPublicTalents(client, { limit: 20 });
    expect(get).toHaveBeenCalledWith('/talents', { params: { limit: '20' } });
    expect(page.total).toBe(41);
    expect(page.nextCursor).toBe('c2');
    expect(page.facets?.skills?.[0]?.count).toBe(12);
    expect(page.facets?.wilayas?.[0]?.wilayaId).toBe('16');
  });

  it('defaults the talents facets when the server omits them', () => {
    const parsed = PublicTalentsPageSchema.parse({ items: [], total: 0 });
    expect(parsed.facets?.skills).toEqual([]);
    expect(parsed.facets?.wilayas).toEqual([]);
  });

  it('never sends a request for an invalid sort', async () => {
    const { client, get } = stubClient(() => ({ items: [], total: 0 }));
    await expect(listPublicTalents(client, { sort: 'popular' })).rejects.toThrow(
      'INVALID_TALENT_SORT',
    );
    expect(get).not.toHaveBeenCalled();
  });

  it('reads guest media by percent-encoded id', async () => {
    const { client, get } = stubClient(() => ({ media: { mediaId: 'm1' }, url: 'https://signed' }));
    const read = await getPublicMedia(client, 'm 1');
    expect(get).toHaveBeenCalledWith('/media/m%201');
    expect(read.url).toBe('https://signed');
  });
});
