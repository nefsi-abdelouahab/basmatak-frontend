import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  ApplyInputSchema,
  OpportunityDetailSchema,
  ReportOpportunityInputSchema,
  applyToPosition,
  coverUrlOf,
  detailIdOf,
  findMyApplicationForPosition,
  getCoverMedia,
  getOpportunityDetail,
  labelFor,
  listRelatedOpportunities,
  myApplicationIdOf,
  orgDisplayName,
  positionKeyOf,
  reportOpportunity,
  withdrawApplication,
} from './opportunity';

function stubClient(handlers: {
  get?: (url: string) => unknown;
  post?: (url: string, body?: unknown) => unknown;
}) {
  const get = vi.fn(async (url: string) => ({ data: handlers.get?.(url) }));
  const post = vi.fn(async (url: string, body?: unknown) => ({ data: handlers.post?.(url, body) }));
  const client = { get, post } as unknown as AxiosInstance;
  return { client, get, post };
}

const position = {
  _id: '64f0000000000000000000a1',
  title: 'Lead Event Photographer',
  description: 'Capture the festival.',
  requiredCount: 2,
  filledCount: 1,
  requiredSkills: [],
  deliverables: ['15 edited photographs'],
  startAt: null,
  applicationCount: 3,
  assigned: [{ volunteerId: 'v1', fullName: 'Amine Benali', username: 'amineb', avatarMediaId: null }],
  skillNames: [{ skillId: 's1', nameFr: 'Photo', nameAr: 'تصوير' }],
};

const detail = {
  _id: '64f0000000000000000000b2',
  slug: 'cultural-heritage-festival',
  title: 'Cultural Heritage Festival Documentation',
  description: 'Document the gathering.',
  categoryId: '64f0000000000000000000c3',
  registryId: 'OPP-000123',
  mode: 'onsite',
  coverMediaId: 'm9',
  endDate: '2026-09-18T00:00:00.000Z',
  startDate: '2026-09-18T00:00:00.000Z',
  applicationDeadline: '2026-09-16T23:59:00.000Z',
  durationMinutes: 180,
  prerequisites: ['Camera'],
  status: 'published',
  location: { wilayaId: '01', municipalityId: '0101' },
  positions: [position],
  organization: {
    id: '64f0000000000000000000d4',
    slug: 'timimoun-cultural',
    nameFr: 'Association Culturelle',
    nameAr: 'الجمعية الثقافية',
    logoMediaId: null,
    verificationStatus: 'verified',
  },
  categoryName: { nameFr: 'Culture', nameAr: 'ثقافة' },
  locationLabels: {
    wilaya: { nameFr: 'Adrar', nameAr: 'أدرار' },
    municipality: null,
  },
  isFavorited: false,
  favoriteCount: 4,
};

describe('opportunity detail validators', () => {
  it('accepts the embedFull-shaped detail payload', () => {
    expect(OpportunityDetailSchema.safeParse(detail).success).toBe(true);
  });

  it('accepts null-safe unset new fields', () => {
    const legacy = {
      ...detail,
      mode: null,
      coverMediaId: null,
      endDate: null,
      durationMinutes: null,
      prerequisites: [],
      positions: [{ _id: 'p1', title: 'Helper' }],
    };
    expect(OpportunityDetailSchema.safeParse(legacy).success).toBe(true);
  });

  it('rejects overlong apply/report inputs client-side', () => {
    expect(ApplyInputSchema.safeParse({ message: 'x'.repeat(2001) }).success).toBe(false);
    expect(ApplyInputSchema.safeParse({}).success).toBe(true);
    expect(
      ReportOpportunityInputSchema.safeParse({ targetId: 'o1', reason: '' }).success,
    ).toBe(false);
    expect(
      ReportOpportunityInputSchema.safeParse({ targetId: 'o1', reason: 'Spam' }).success,
    ).toBe(true);
  });
});

describe('opportunity api functions', () => {
  it('reads detail by id or slug', async () => {
    const { client, get } = stubClient({ get: () => detail });
    const out = await getOpportunityDetail(client, 'cultural-heritage-festival');
    expect(get).toHaveBeenCalledWith('/opportunities/cultural-heritage-festival');
    expect(out.title).toBe(detail.title);
    expect(out.positions?.[0]?.applicationCount).toBe(3);
  });

  it('lists related by category and filters out the current item', async () => {
    const other = { ...detail, _id: '64f0000000000000000000ff', slug: 'other-opp' };
    const page = { items: [detail, other], nextCursor: null, limit: 6, total: 2, page: 1, pages: 1 };
    const { client, get } = stubClient({ get: () => page });
    const out = await listRelatedOpportunities(client, {
      categoryId: '64f0000000000000000000c3',
      excludeId: '64f0000000000000000000b2',
    });
    expect(get).toHaveBeenCalledWith(
      '/opportunities',
      expect.objectContaining({ params: expect.objectContaining({ categoryId: '64f0000000000000000000c3' }) }),
    );
    expect(out).toHaveLength(1);
    expect(detailIdOf(out[0] as never)).toBe('64f0000000000000000000ff');
  });

  it('applies with a trimmed message, or message-less', async () => {
    const { client, post } = stubClient({ post: () => ({ _id: 'app1', status: 'pending' }) });
    await applyToPosition(client, 'o1', 'p1', { message: '  Hello  ' });
    expect(post).toHaveBeenCalledWith(
      '/opportunities/o1/positions/p1/applications',
      { message: 'Hello' },
    );
    await applyToPosition(client, 'o1', 'p1', {});
    expect(post).toHaveBeenCalledWith('/opportunities/o1/positions/p1/applications', {});
  });

  it('withdraws and reports with the fixed target type', async () => {
    const { client, post } = stubClient({
      post: (url) =>
        url === '/reports' ? { _id: 'r1', status: 'open' } : { _id: 'app1', status: 'withdrawn' },
    });
    const withdrawn = await withdrawApplication(client, 'app1');
    expect(post).toHaveBeenCalledWith('/applications/app1/withdraw', {});
    expect(withdrawn.status).toBe('withdrawn');
    await reportOpportunity(client, { targetId: 'o1', reason: 'Spam' });
    expect(post).toHaveBeenCalledWith('/reports', {
      targetType: 'opportunity',
      targetId: 'o1',
      reason: 'Spam',
    });
  });

  it('reads public cover media and resolves the signed url', async () => {
    const { client } = stubClient({ get: () => ({ url: 'https://cdn.example/cover.jpg' }) });
    const media = await getCoverMedia(client, 'm9');
    expect(coverUrlOf(media)).toBe('https://cdn.example/cover.jpg');
    expect(coverUrlOf(undefined)).toBeNull();
  });

  it('finds the own live application for a position, else null', async () => {
    const apps = {
      items: [
        { _id: 'app1', opportunityId: 'o1', positionId: 'p1', status: 'pending' },
        { _id: 'app2', opportunityId: 'o1', positionId: 'p2', status: 'withdrawn' },
        { _id: 'app3', opportunityId: 'o9', positionId: 'p1', status: 'accepted' },
      ],
      nextCursor: null,
      limit: 50,
      total: 3,
      page: 1,
      pages: 1,
    };
    const { client, get } = stubClient({ get: () => apps });
    const found = await findMyApplicationForPosition(client, 'o1', 'p1');
    expect(get).toHaveBeenCalledWith('/applications/me', expect.objectContaining({ params: { limit: 50 } }));
    expect(found && myApplicationIdOf(found)).toBe('app1');
    expect(await findMyApplicationForPosition(client, 'o1', 'p2')).toBeNull();
    expect(await findMyApplicationForPosition(client, 'o9', 'p9')).toBeNull();
  });
});

describe('opportunity display helpers', () => {
  it('resolves ids, names, and labels locale-aware', () => {
    expect(detailIdOf(detail as never)).toBe('64f0000000000000000000b2');
    expect(positionKeyOf(position as never)).toBe('64f0000000000000000000a1');
    expect(orgDisplayName(detail.organization as never, 'en')).toBe('Association Culturelle');
    expect(orgDisplayName(detail.organization as never, 'ar')).toBe('الجمعية الثقافية');
    expect(orgDisplayName(null, 'en')).toBe('');
    expect(labelFor(detail.categoryName as never, 'ar')).toBe('ثقافة');
    expect(labelFor(null, 'en')).toBe('');
  });
});
