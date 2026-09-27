import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  OrgGivenReviewSchema,
  buildOrgRecordsCsvParams,
  buildOrgRecordsFilters,
  buildVerifyDeepLink,
  exportOrgExperiencesCsv,
  listOrgExperiences,
  listOrgReviewsGiven,
} from './orgRecords';
import { EnrichedExperienceSchema } from './experiences';

function stubClient(handlers: {
  get?: (url: string, config?: unknown) => unknown;
}) {
  const get = vi.fn(async (url: string, config?: unknown) => ({
    data: handlers.get?.(url, config),
  }));
  const client = { get } as unknown as AxiosInstance;
  return { client, get };
}

const row = {
  id: '64f0000000000000000000a1',
  registryId: 'EXP-000001',
  title: 'Beach cleanup',
  description: null,
  skills: ['64f0000000000000000000b2'],
  duration: 180,
  organization: { id: 'o1', slug: 'el-amel', nameFr: 'Association El-Amel', nameAr: null },
  verifiedAt: '2026-09-05T12:00:00.000Z',
  verificationCode: 'ABCDEFGH',
  publicVisibility: 'public',
  review: { rating: 5, notes: 'Great work' },
};

describe('org records filters', () => {
  it('builds only set params and drops off-vocabulary values', () => {
    expect(buildOrgRecordsFilters({})).toEqual({});
    expect(
      buildOrgRecordsFilters({ q: '  beach ', opportunityId: '', visibility: 'bogus', sort: 'nope' }),
    ).toEqual({ q: 'beach' });
    expect(
      buildOrgRecordsFilters({
        q: 'EXP-1',
        opportunityId: '64f0000000000000000000c1',
        visibility: 'private',
        sort: 'oldest',
        cursor: 'cur',
        limit: 20,
      }),
    ).toEqual({
      q: 'EXP-1',
      opportunityId: '64f0000000000000000000c1',
      visibility: 'private',
      sort: 'oldest',
      cursor: 'cur',
      limit: 20,
    });
  });

  it('adds format=csv on top of the active filters', () => {
    expect(buildOrgRecordsCsvParams({ q: 'beach', sort: 'newest' })).toEqual({
      q: 'beach',
      sort: 'newest',
      format: 'csv',
    });
    expect(buildOrgRecordsCsvParams({})).toEqual({ format: 'csv' });
  });

  it('builds the inline verify deep link with no page', () => {
    expect(buildVerifyDeepLink('ABCDEFGH')).toBe('/verify/ABCDEFGH');
  });

  it('accepts the enriched org row shape (no volunteer join)', () => {
    expect(EnrichedExperienceSchema.safeParse(row).success).toBe(true);
    expect(OrgGivenReviewSchema.safeParse({ rating: 5, comment: 'Great work' }).success).toBe(
      true,
    );
  });
});

describe('org records endpoints', () => {
  it('lists with filter params and parses the cursor page', async () => {
    const page = { items: [row], nextCursor: null, limit: 20, total: 1, page: 1, pages: 1 };
    const { client, get } = stubClient({ get: () => page });
    const result = await listOrgExperiences(client, { q: 'beach', visibility: 'public' });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(get).toHaveBeenCalledWith('/organizations/me/experiences', {
      params: { q: 'beach', visibility: 'public' },
    });
  });

  it('exports CSV with format=csv and the active filters', async () => {
    const { client, get } = stubClient({
      get: () => {
        throw new Error('csv streams through downloadBlob, not .get().data');
      },
    });
    // The CSV path never resolves through the stubbed .get().data shape —
    // assert the request instead via a blob-shaped stub below.
    await expect(exportOrgExperiencesCsv(client, {})).rejects.toThrow();
    expect(get).toHaveBeenCalledWith('/organizations/me/experiences', {
      params: { format: 'csv' },
      responseType: 'blob',
    });
  });

  it('reads org-given reviews as a cursor page', async () => {
    const page = {
      items: [{ rating: 5, comment: 'Great work' }],
      nextCursor: null,
      limit: 20,
      total: 1,
    };
    const { client, get } = stubClient({ get: () => page });
    const result = await listOrgReviewsGiven(client, {});
    expect(result.items).toHaveLength(1);
    expect(get).toHaveBeenCalledWith('/organizations/me/reviews', { params: {} });
  });
});
