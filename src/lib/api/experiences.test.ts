import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  EnrichedExperienceSchema,
  ExperienceDetailSchema,
  VolunteerReviewSchema,
  buildExperienceFilters,
  getExperienceDetail,
  listMyExperiences,
  listMyReviews,
  orgDisplayName,
  patchExperienceVisibility,
  reviewOrgDisplayName,
} from './experiences';

function stubClient(handlers: {
  get?: (url: string, config?: unknown) => unknown;
  patch?: (url: string, body?: unknown) => unknown;
}) {
  const get = vi.fn(async (url: string, config?: unknown) => ({ data: handlers.get?.(url, config) }));
  const patch = vi.fn(async (url: string, body?: unknown) => ({
    data: handlers.patch?.(url, body),
  }));
  const client = { get, patch } as unknown as AxiosInstance;
  return { client, get, patch };
}

const enriched = {
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

describe('experience filters', () => {
  it('builds only set params', () => {
    expect(buildExperienceFilters({})).toEqual({});
    expect(
      buildExperienceFilters({ categoryId: 'c1', skillId: '', from: '2026-01-01', to: '  ' }),
    ).toEqual({ categoryId: 'c1', from: '2026-01-01' });
    expect(buildExperienceFilters({ cursor: 'cur', limit: 20 })).toEqual({
      cursor: 'cur',
      limit: 20,
    });
  });

  it('picks the organization display name by locale with slug fallback', () => {
    expect(orgDisplayName(enriched.organization, 'en')).toBe('Association El-Amel');
    expect(orgDisplayName(enriched.organization, 'ar')).toBe('Association El-Amel');
    expect(orgDisplayName(null, 'en')).toBe('');
    expect(
      reviewOrgDisplayName({ nameFr: null, nameAr: 'جمعية الأمل', slug: 'x' }, 'ar'),
    ).toBe('جمعية الأمل');
  });

  it('accepts the verified enriched shape (duration key, not durationMinutes)', () => {
    expect(EnrichedExperienceSchema.safeParse(enriched).success).toBe(true);
    const { duration: _dropped, ...withoutDuration } = enriched;
    expect(_dropped).toBe(180);
    expect(EnrichedExperienceSchema.safeParse(withoutDuration).success).toBe(false);
    expect(
      ExperienceDetailSchema.safeParse({ ...enriched, evidence: [] }).success,
    ).toBe(true);
    expect(
      VolunteerReviewSchema.safeParse({ rating: 5, comment: null, organization: null }).success,
    ).toBe(true);
  });
});

describe('experience endpoints', () => {
  it('lists with filter params and parses the cursor page', async () => {
    const page = { items: [enriched], nextCursor: null, limit: 20, total: 1, page: 1, pages: 1 };
    const { client, get } = stubClient({ get: () => page });
    const result = await listMyExperiences(client, { categoryId: 'c1' });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(get).toHaveBeenCalledWith('/experiences/me', { params: { categoryId: 'c1' } });
  });

  it('reads detail and patches visibility with the exact body', async () => {
    const withEvidence = { ...enriched, evidence: [] };
    const { client, get } = stubClient({ get: () => withEvidence });
    const detail = await getExperienceDetail(client, 'e1');
    expect(detail.id).toBe(enriched.id);
    expect(get).toHaveBeenCalledWith('/experiences/e1');

    const { client: c2, patch } = stubClient({ patch: () => ({}) });
    await patchExperienceVisibility(c2, 'e1', 'private');
    expect(patch).toHaveBeenCalledWith('/experiences/e1/visibility', {
      publicVisibility: 'private',
    });
  });

  it('reads own reviews as an array', async () => {
    const { client } = stubClient({ get: () => [{ rating: 4, comment: 'Nice' }] });
    const reviews = await listMyReviews(client);
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.rating).toBe(4);
  });
});
