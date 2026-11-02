import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  ArchiveCountsSchema,
  CursorPageSchema,
  OrgReliabilitySchema,
  PublicOppDetailSchema,
  PublicOrgCardSchema,
  PublicOrgProfileSchema,
  applyGateFor,
  aggregatesOf,
  archiveCountFor,
  expDisplayCode,
  getPublicOpportunityDetail,
  getPublicOrgProfile,
  hoursFromMinutes,
  listPublicOpportunities,
  listPublicOrgOpportunities,
  listRelatedPublicOpportunities,
  listSkillCategories,
  listWilayas,
  oppDisplayCode,
  orgDisplayCode,
  orgDisplayName,
  orgSlugOf,
  parseArchiveStatus,
  relatedSlugOf,
  reliabilityRateOf,
  searchPublicOrgs,
  toPublicFeedQuery,
} from './publicOrgs';

function stubClient(handlers: {
  get?: (url: string, config?: { params?: unknown }) => unknown;
}) {
  const get = vi.fn(async (url: string, config?: { params?: unknown }) => ({
    data: handlers.get?.(url, config),
  }));
  const client = { get } as unknown as AxiosInstance;
  return { client, get };
}

const orgCard = {
  id: '64f000000000000000000001',
  slug: 'timimoun-cultural',
  nameFr: 'Association Culturelle',
  nameAr: 'الجمعية الثقافية',
  registryId: 'ORG-000042',
  verificationStatus: 'verified',
};

const profile = {
  slug: 'timimoun-cultural',
  registryId: 'ORG-000042',
  nameFr: 'Association Culturelle',
  nameAr: 'الجمعية الثقافية',
  website: 'https://example.org',
  foundedYear: 2018,
  verificationStatus: 'verified',
  // Guest contract: the backend omits the phone key entirely.
  contact: { email: 'contact@example.org' },
  focusDisciplines: ['culture'],
  stats: { opportunitiesActive: 4, opportunitiesCompleted: 9, verifiedHours: 1420 },
};

const pageOf = (items: unknown[], extra: Record<string, unknown> = {}) => ({
  items,
  nextCursor: null,
  limit: 12,
  total: items.length,
  page: 1,
  pages: 1,
  ...extra,
});

describe('publicOrgs display helpers', () => {
  it('renders idempotent ORG/OPP/EXP codes and nulls empties', () => {
    expect(orgDisplayCode('ORG-000042')).toBe('ORG-000042');
    expect(orgDisplayCode('000042')).toBe('ORG-000042');
    expect(oppDisplayCode('OPP-000123')).toBe('OPP-000123');
    expect(oppDisplayCode('000123')).toBe('OPP-000123');
    expect(expDisplayCode('EXP-7')).toBe('EXP-7');
    expect(orgDisplayCode(null)).toBeNull();
    expect(oppDisplayCode('')).toBeNull();
  });

  it('resolves org names per locale with fallback', () => {
    expect(orgDisplayName(orgCard, 'en')).toBe('Association Culturelle');
    expect(orgDisplayName(orgCard, 'ar')).toBe('الجمعية الثقافية');
    expect(orgDisplayName(null, 'en')).toBe('');
    expect(orgDisplayName({ nameFr: 'Seule' }, 'ar')).toBe('Seule');
  });

  it('reads hours from minutes only and nulls the rest', () => {
    expect(hoursFromMinutes(180)).toBe(3);
    expect(hoursFromMinutes(90)).toBe(1.5);
    expect(hoursFromMinutes(null)).toBeNull();
    expect(hoursFromMinutes(0)).toBeNull();
    expect(hoursFromMinutes(Number.NaN)).toBeNull();
  });

  it('whitelists archive statuses and rejects the rest', () => {
    expect(parseArchiveStatus('published')).toBe('published');
    expect(parseArchiveStatus('completed')).toBe('completed');
    expect(parseArchiveStatus('closed')).toBe('closed');
    expect(parseArchiveStatus('draft')).toBeNull();
    expect(parseArchiveStatus(undefined)).toBeNull();
  });

  it('prefers server counts and falls back to page total only when absent', () => {
    expect(archiveCountFor({ published: 5 }, 'published', 3)).toBe(5);
    expect(archiveCountFor({}, 'completed', 2)).toBe(2);
    expect(archiveCountFor(null, 'closed', null)).toBeNull();
  });

  it('reads aggregates from either payload key and reliability from first served ratio', () => {
    expect(aggregatesOf(profile)?.opportunitiesActive).toBe(4);
    expect(aggregatesOf({ aggregates: { verifiedHours: 10 } })?.verifiedHours).toBe(10);
    expect(aggregatesOf(null)).toBeNull();
    expect(reliabilityRateOf({ decidedRatio: 0.8 })).toBe(0.8);
    expect(reliabilityRateOf({ responseRate: 0.5, decidedRatio: 0.9 })).toBe(0.5);
    expect(reliabilityRateOf({})).toBeNull();
  });

  it('derives slugs from embeds and nulls missing ones', () => {
    expect(orgSlugOf(orgCard)).toBe('timimoun-cultural');
    expect(orgSlugOf({})).toBeNull();
    expect(relatedSlugOf({ organization: { slug: 's' } } as never)).toBe('s');
    expect(relatedSlugOf({ organization: null } as never)).toBeNull();
  });
});

describe('publicOrgs apply gate', () => {
  const open = { requiredCount: 2, filledCount: 1 };
  const published = { status: 'published', applicationDeadline: '2099-01-01T00:00:00.000Z' };
  it('opens for published seats before deadline', () => {
    expect(applyGateFor(published, open)).toBeNull();
  });
  it('closes non-published details', () => {
    expect(applyGateFor({ status: 'completed' }, open)).toBe('closed');
  });
  it('flags past deadlines', () => {
    expect(
      applyGateFor({ status: 'published', applicationDeadline: '2000-01-01T00:00:00.000Z' }, open),
    ).toBe('deadline');
  });
  it('flags full positions', () => {
    expect(applyGateFor(published, { requiredCount: 1, filledCount: 1 })).toBe('full');
  });
});

describe('publicOrgs endpoint functions', () => {
  it('searches orgs with trimmed q and parses the page', async () => {
    const { client, get } = stubClient({
      get: () => pageOf([orgCard]),
    });
    const page = await searchPublicOrgs(client, { q: '  culture ' });
    expect(get).toHaveBeenCalledWith('/organizations', {
      params: { q: 'culture', limit: 12 },
    });
    expect(CursorPageSchema(PublicOrgCardSchema).parse(page).total).toBe(1);
  });

  it('reads the org profile with a percent-encoded slug', async () => {
    const { client, get } = stubClient({ get: () => profile });
    const parsed = await getPublicOrgProfile(client, 'timimoun cultural');
    expect(get).toHaveBeenCalledWith('/organizations/timimoun%20cultural');
    expect(PublicOrgProfileSchema.parse(parsed).slug).toBe('timimoun-cultural');
    expect(PublicOrgProfileSchema.parse(parsed).contact).toEqual({
      email: 'contact@example.org',
    });
    expect(
      PublicOrgProfileSchema.parse({
        ...profile,
        contact: { email: 'contact@example.org', phone: '+213555123456' },
      }).contact?.phone,
    ).toBe('+213555123456');
  });

  it('reads per-status archives with counts', async () => {
    const { client, get } = stubClient({
      get: () => pageOf([orgCard], { counts: { published: 2, completed: 9, closed: 1 } }),
    });
    const { page, counts } = await listPublicOrgOpportunities(client, 's', {
      status: 'completed',
    });
    // The archive endpoint only accepts `status` (limit/cursor are rejected).
    expect(get).toHaveBeenCalledWith('/organizations/s/opportunities', {
      params: { status: 'completed' },
    });
    expect(page.total).toBe(1);
    expect(ArchiveCountsSchema.parse(counts)?.completed).toBe(9);
  });

  it('parses bare-array archives (the served shape) with synthesized paging', async () => {
    const { client } = stubClient({ get: () => [orgCard] });
    const { page, counts } = await listPublicOrgOpportunities(client, 's', {
      status: 'published',
    });
    expect(page.items.length).toBe(1);
    expect(page.total).toBe(1);
    expect(page.nextCursor).toBeNull();
    expect(counts).toBeNull();
  });

  it('builds feed queries dropping empties', () => {
    expect(toPublicFeedQuery({ q: '  ', limit: 12 })).toEqual({ limit: 12 });
    expect(toPublicFeedQuery({ q: 'food', categoryId: 'c1', limit: 12 })).toEqual({
      q: 'food',
      categoryId: 'c1',
      limit: 12,
    });
  });

  it('lists the published feed and reads opportunity details', async () => {
    const card = { id: 'o1', title: 'Drive', registryId: 'OPP-1' };
    const { client } = stubClient({ get: () => pageOf([card]) });
    const page = await listPublicOpportunities(client, { q: 'drive' });
    expect(page.total).toBe(1);

    const detail = {
      title: 'Drive',
      registryId: 'OPP-1',
      status: 'published',
      positions: [
        { _id: 'p1', requiredCount: 2, filledCount: 0, applicationCount: 3, assigned: [], skillNames: [] },
      ],
      organization: { id: 'o9', slug: 's', nameFr: 'Org', verificationStatus: 'verified' },
    };
    const { client: detailClient, get } = stubClient({ get: () => detail });
    const parsed = await getPublicOpportunityDetail(detailClient, 'drive');
    expect(get).toHaveBeenCalledWith('/opportunities/drive');
    expect(PublicOppDetailSchema.parse(parsed).positions?.length).toBe(1);
  });

  it('resolves related through the embedded slug and excludes the current id', async () => {
    const items = [
      { _id: 'cur', title: 'Current' },
      { _id: 'next', title: 'Next' },
    ];
    // Served shape is a bare array; only `status` is an accepted param.
    const { client, get } = stubClient({ get: () => items });
    const related = await listRelatedPublicOpportunities(client, 's', 'cur');
    expect(get).toHaveBeenCalledWith('/organizations/s/opportunities', {
      params: { status: 'published' },
    });
    expect(related.map((r) => r._id)).toEqual(['next']);
  });

  it('parses reliability tolerantly', () => {
    expect(OrgReliabilitySchema.parse({}).responseRate).toBeUndefined();
    expect(
      OrgReliabilitySchema.parse({ responseRate: 0.75 }).responseRate,
    ).toBe(0.75);
  });

  it('reads lookups served as bare arrays (wilayas + skill categories)', async () => {
    const wilaya = { _id: 'w1', code: '16', nameAr: 'الجزائر', nameFr: 'Alger' };
    const { client: wClient, get: wGet } = stubClient({ get: () => [wilaya] });
    const wilayas = await listWilayas(wClient);
    expect(wGet).toHaveBeenCalledWith('/locations/wilayas');
    expect(wilayas.find((w) => w.code === '16')?.nameFr).toBe('Alger');

    const category = { _id: 'c1', nameAr: 'اللوجستيات', nameFr: 'Logistics' };
    const { client: cClient } = stubClient({ get: () => [category] });
    const categories = await listSkillCategories(cClient);
    expect(categories.find((c) => (c.id ?? c._id) === 'c1')?.nameFr).toBe('Logistics');
  });
});
