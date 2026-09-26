import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  CursorPageSchema,
  OpportunityCardSchema,
  TalentCardSchema,
  VolunteerHomeDashboardSchema,
  getVolunteerHomeDashboard,
  listMunicipalities,
  listOpportunities,
  listRecommended,
  listSkillCategories,
  listSkills,
  listTalents,
  listWilayas,
  mondayOfWeek,
  toOpportunityQuery,
  toTalentQuery,
  weekendWindow,
  weekWindow,
} from './feed';

function stubClient(handlers: {
  get?: (url: string, config?: { params?: unknown }) => unknown;
}) {
  const get = vi.fn(async (url: string, config?: { params?: unknown }) => ({
    data: handlers.get?.(url, config),
  }));
  const client = { get } as unknown as AxiosInstance;
  return { client, get };
}

const opportunity = {
  id: '64f000000000000000000001',
  title: 'Food drive',
  registryId: '7',
  mode: 'onsite',
  durationMinutes: 180,
  organization: { id: 'o1', slug: 'org', nameFr: 'Org', verificationStatus: 'verified' },
  isFavorited: false,
};

const talent = { username: 'amineb', firstName: 'Amine', experienceCount: 3 };

const page = (items: unknown[]) => ({
  items,
  nextCursor: null,
  limit: 20,
  total: items.length,
  page: 1,
  pages: 1,
});

describe('feed query builders', () => {
  it('serializes multi-value filters comma-joined and drops empties', () => {
    expect(
      toOpportunityQuery({
        q: '  food ',
        categoryIds: ['c1', 'c2'],
        skillIds: [],
        wilayaIds: ['16'],
        municipalityIds: undefined,
        hasOpenPositions: true,
        nearMe: 'me',
        sort: 'newest',
        limit: 20,
      }),
    ).toEqual({
      q: 'food',
      categoryId: 'c1,c2',
      wilayaId: '16',
      hasOpenPositions: 'true',
      nearMe: 'me',
      sort: 'newest',
      limit: '20',
    });
  });

  it('serializes talent thresholds as boolean-strings and clamps q to 120', () => {
    const query = toTalentQuery({
      q: `x${'y'.repeat(200)}`,
      skillIds: ['s1'],
      minExperiences: 2,
      hasAvailability: true,
      portfolio: false,
      sort: 'experiences_desc',
    });
    expect(query.q?.length).toBe(120);
    expect(query).toMatchObject({
      skillIds: 's1',
      minExperiences: '2',
      hasAvailability: 'true',
      portfolio: 'false',
      sort: 'experiences_desc',
    });
  });
});

describe('week windows (Algeria Fri-Sat weekend)', () => {
  it('weekWindow spans ISO Monday to Sunday', () => {
    const { from, to } = weekWindow(new Date('2026-09-23T12:00:00.000Z'));
    expect(new Date(from).getUTCDay()).toBe(1);
    expect(new Date(to).getUTCDay()).toBe(0);
    expect(to > from).toBe(true);
  });

  it('weekendWindow spans Friday to Saturday', () => {
    const { from, to } = weekendWindow(new Date('2026-09-23T12:00:00.000Z'));
    expect(new Date(from).getUTCDay()).toBe(5);
    expect(new Date(to).getUTCDay()).toBe(6);
    expect(to > from).toBe(true);
  });

  it('mondayOfWeek is stable for Sunday inputs', () => {
    const monday = mondayOfWeek(new Date('2026-09-27T00:00:00.000Z'));
    expect(monday.toISOString()).toBe('2026-09-21T00:00:00.000Z');
  });
});

describe('feed api functions', () => {
  it('parses opportunity and talent pages with totals', async () => {
    const { client, get } = stubClient({
      get: (url) => {
        if (url === '/opportunities') return page([opportunity]);
        if (url === '/talents') return page([talent]);
        throw new Error(`unexpected ${url}`);
      },
    });
    const opps = await listOpportunities(client, { q: 'food' });
    expect(opps.total).toBe(1);
    expect(opps.items[0].registryId).toBe('7');
    expect(get).toHaveBeenCalledWith('/opportunities', {
      params: expect.objectContaining({ q: 'food' }),
    });
    const talents = await listTalents(client, { sort: 'newest' });
    expect(talents.total).toBe(1);
    expect(talents.items[0].username).toBe('amineb');
  });

  it('reads recommended and dashboard payloads', async () => {
    const { client } = stubClient({
      get: (url) => {
        if (url === '/opportunities/recommended') return page([opportunity]);
        if (url === '/volunteers/me/dashboard')
          return {
            completionPercent: 62,
            stats: { experiences: 4, hours: 12 },
            latestVerifiedExperience: {
              registryId: '3',
              verificationCode: 'V-1',
              verifiedAt: '2026-09-01T00:00:00.000Z',
              organizationName: 'Org',
            },
          };
        throw new Error(`unexpected ${url}`);
      },
    });
    const recommended = await listRecommended(client, { limit: 5 });
    expect(recommended.total).toBe(1);
    const dashboard = await getVolunteerHomeDashboard(client);
    expect(dashboard.completionPercent).toBe(62);
    expect(dashboard.stats).toEqual({ experiences: 4, hours: 12 });
    expect(dashboard.latestVerifiedExperience?.registryId).toBe('3');
  });

  it('reads facet lookups with lazy municipality scoping', async () => {
    const { client, get } = stubClient({
      get: (url) => {
        if (url === '/skill-categories') return [{ id: 'c1' }];
        if (url === '/skills') return [{ id: 's1' }];
        if (url === '/locations/wilayas') return [{ code: '16' }];
        if (url === '/locations/wilayas/16/municipalities') return [{ code: '1601' }];
        throw new Error(`unexpected ${url}`);
      },
    });
    await expect(listSkillCategories(client)).resolves.toHaveLength(1);
    await expect(listSkills(client)).resolves.toHaveLength(1);
    await expect(listWilayas(client)).resolves.toHaveLength(1);
    await expect(listMunicipalities(client, '16')).resolves.toHaveLength(1);
    expect(get).toHaveBeenCalledWith('/locations/wilayas/16/municipalities');
  });

  it('accepts card/dashboard shapes via passthrough schemas', () => {
    expect(OpportunityCardSchema.safeParse(opportunity).success).toBe(true);
    expect(TalentCardSchema.safeParse(talent).success).toBe(true);
    expect(
      CursorPageSchema(OpportunityCardSchema).safeParse(page([opportunity])).success,
    ).toBe(true);
    expect(
      VolunteerHomeDashboardSchema.safeParse({
        completionPercent: 0,
        stats: null,
        latestVerifiedExperience: null,
      }).success,
    ).toBe(true);
  });
});
