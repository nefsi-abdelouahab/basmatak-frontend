import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  filterByMode,
  isPublicOrgVerified,
  listPublicOpportunities,
  parsePublicOppMode,
  publicHoursFromMinutes,
  publicLabelFor,
  publicLocationOf,
  publicOpenSeatsOf,
  publicOpportunityRef,
  publicOppSlugOf,
  publicOrgDisplayName,
  publicSkillLabelsOf,
  toPublicOpportunitiesQuery,
  type PublicOpportunity,
} from './publicOpportunities';

function stubClient(handlers: {
  get?: (url: string, config?: { params?: unknown }) => unknown;
}) {
  const get = vi.fn(async (url: string, config?: { params?: unknown }) => ({
    data: handlers.get?.(url, config),
  }));
  const client = { get } as unknown as AxiosInstance;
  return { client, get };
}

const card: PublicOpportunity = {
  _id: '64f0000000000000000000b2',
  slug: 'oasis-restoration',
  title: 'Oasis Restoration',
  registryId: 'OPP-000123',
  mode: 'onsite',
  durationMinutes: 90,
  applicationDeadline: '2026-10-10T00:00:00.000Z',
  locationLabels: {
    wilaya: { nameFr: 'Adrar', nameAr: 'أدرار' },
    municipality: { nameFr: 'Timimoun', nameAr: 'تيميمون' },
  },
  positions: [
    {
      requiredCount: 4,
      filledCount: 1,
      skillNames: [
        { skillId: 's1', nameFr: 'Photo', nameAr: 'تصوير' },
        { skillId: 's2', nameFr: 'Photo', nameAr: 'تصوير' },
      ],
    },
  ],
  organization: {
    slug: 'timimoun-cultural',
    nameFr: 'Association Culturelle',
    nameAr: 'الجمعية الثقافية',
    verificationStatus: 'verified',
  },
};

describe('toPublicOpportunitiesQuery', () => {
  it('serializes the exact backend param names and never sends mode', () => {
    const query = toPublicOpportunitiesQuery({
      q: '  oasis ',
      categoryIds: ['c1', 'c2'],
      skillIds: ['s1'],
      wilayaIds: ['16'],
      municipalityIds: ['1601'],
      from: '2026-10-01',
      to: '2026-11-01',
      hasOpenPositions: true,
      sort: 'deadline_asc',
      cursor: 'abc',
      limit: 20,
    });
    expect(query).toEqual({
      q: 'oasis',
      categoryId: 'c1,c2',
      skillId: 's1',
      wilayaId: '16',
      municipalityId: '1601',
      from: '2026-10-01',
      to: '2026-11-01',
      hasOpenPositions: 'true',
      sort: 'deadline_asc',
      cursor: 'abc',
      limit: '20',
    });
    expect(query).not.toHaveProperty('mode');
  });

  it('drops empty values so the URL stays shareable', () => {
    expect(toPublicOpportunitiesQuery({})).toEqual({});
  });
});

describe('listPublicOpportunities', () => {
  it('hits GET /opportunities and parses the cursor/total page', async () => {
    const page = { items: [card], nextCursor: null, limit: 20, total: 1, page: 1, pages: 1 };
    const { client, get } = stubClient({ get: () => page });
    const result = await listPublicOpportunities(client, { q: 'oasis', limit: 20 });
    expect(get).toHaveBeenCalledWith('/opportunities', {
      params: { q: 'oasis', limit: '20' },
    });
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
  });
});

describe('public opportunities display helpers', () => {
  it('resolves org names per locale and the verified badge from the embed', () => {
    expect(publicOrgDisplayName(card.organization, 'en')).toBe('Association Culturelle');
    expect(publicOrgDisplayName(card.organization, 'ar')).toBe('الجمعية الثقافية');
    expect(isPublicOrgVerified(card.organization)).toBe(true);
    expect(isPublicOrgVerified({ verificationStatus: 'pending' })).toBe(false);
    expect(publicLabelFor(null, 'en')).toBe('');
  });

  it('renders idempotent OPP refs and nulls empties', () => {
    expect(publicOpportunityRef('OPP-000123')).toBe('OPP-000123');
    expect(publicOpportunityRef('000123')).toBe('OPP-000123');
    expect(publicOpportunityRef(null)).toBeNull();
    expect(publicOpportunityRef('')).toBeNull();
  });

  it('derives whole-or-one-decimal hours from durationMinutes only', () => {
    expect(publicHoursFromMinutes(120)).toBe(2);
    expect(publicHoursFromMinutes(90)).toBe(1.5);
    expect(publicHoursFromMinutes(null)).toBeNull();
    expect(publicHoursFromMinutes(-5)).toBeNull();
  });

  it('sums open seats, dedupes skill labels, joins location labels', () => {
    expect(publicOpenSeatsOf(card)).toEqual({ open: 3, total: 4 });
    expect(publicOpenSeatsOf({})).toBeNull();
    expect(publicSkillLabelsOf(card, 'en')).toEqual(['Photo']);
    expect(publicSkillLabelsOf(card, 'ar')).toEqual(['تصوير']);
    expect(publicLocationOf(card, 'en')).toBe('Adrar · Timimoun');
    expect(publicLocationOf({}, 'en')).toBeNull();
    expect(publicOppSlugOf(card)).toBe('oasis-restoration');
  });
});

describe('filterByMode', () => {
  const remote: PublicOpportunity = { ...card, _id: 'r', mode: 'remote' };
  const hybrid: PublicOpportunity = { ...card, _id: 'h', mode: 'hybrid' };
  const items = [card, remote, hybrid];

  it('is identity for all and narrows on the real enum otherwise', () => {
    expect(filterByMode(items, 'all')).toEqual(items);
    expect(filterByMode(items, 'onsite').map((i) => i._id)).toEqual([card._id]);
    expect(filterByMode(items, 'remote').map((i) => i._id)).toEqual(['r']);
    expect(filterByMode(items, 'hybrid').map((i) => i._id)).toEqual(['h']);
  });

  it('parses unknown mode values to all', () => {
    expect(parsePublicOppMode('field')).toBe('all');
    expect(parsePublicOppMode('onsite')).toBe('onsite');
    expect(parsePublicOppMode(undefined)).toBe('all');
  });
});
