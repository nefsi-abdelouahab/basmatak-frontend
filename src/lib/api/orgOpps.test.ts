import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  buildOwnOpportunityParams,
  createOpportunity,
  createPosition,
  deleteDraftOpportunity,
  deletePosition,
  duplicateOpportunity,
  getOwnOpportunity,
  getOwnOrgGate,
  getPublishGate,
  isPublishAllowed,
  lifecycleAvailability,
  listMunicipalities,
  listOwnOpportunities,
  listSkillCategories,
  listSkills,
  listWilayas,
  opportunityIdOf,
  opportunityRefOf,
  opportunityStatusOf,
  patchOpportunity,
  patchPosition,
  positionIdOf,
  positionInputIssues,
  runLifecycleAction,
  skillCategoryIdOf,
  skillCategoryLabelOf,
  skillIdOf,
  skillIdsOfSkills,
  skillLabelOf,
  validateCoverFile,
} from './orgOpps';

function stubClient(handlers: {
  get?: (url: string, config?: unknown) => unknown;
  post?: (url: string, body?: unknown) => unknown;
  patch?: (url: string, body?: unknown) => unknown;
  delete?: (url: string) => unknown;
}) {
  const get = vi.fn(async (url: string, config?: unknown) => ({ data: handlers.get?.(url, config) }));
  const post = vi.fn(async (url: string, body?: unknown) => ({ data: handlers.post?.(url, body) }));
  const patch = vi.fn(async (url: string, body?: unknown) => ({
    data: handlers.patch?.(url, body),
  }));
  const del = vi.fn(async (url: string) => ({ data: handlers.delete?.(url) }));
  const client = { get, post, patch, delete: del } as unknown as AxiosInstance;
  return { client, get, post, patch, del };
}

const draft = {
  _id: '64f0000000000000000000c1',
  title: 'Cleanup day',
  description: 'Help out',
  status: 'draft',
  registryId: '000123',
  positions: [{ _id: '64f0000000000000000000d1', title: 'Helper', requiredCount: 3, filledCount: 0 }],
};

const pageOf = (items: unknown[]) => ({
  items,
  nextCursor: null,
  limit: 20,
  total: items.length,
  page: 1,
  pages: 1,
});

describe('lifecycleAvailability', () => {
  it('draft + verified + unlocked gate allows publish and delete-draft', () => {
    expect(lifecycleAvailability('draft', 'verified', false)).toEqual({
      canPublish: true,
      publishLockedReason: null,
      canDeleteDraft: true,
      canClose: false,
      canCancel: false,
      canComplete: false,
    });
  });

  it('draft + pending org locks publish as unverified but keeps delete-draft', () => {
    const result = lifecycleAvailability('draft', 'pending', false);
    expect(result.canPublish).toBe(false);
    expect(result.publishLockedReason).toBe('unverified');
    expect(result.canDeleteDraft).toBe(true);
  });

  it('draft + verified + locked gate locks publish as gate-locked', () => {
    const result = lifecycleAvailability('draft', 'verified', true);
    expect(result.canPublish).toBe(false);
    expect(result.publishLockedReason).toBe('gate-locked');
    expect(result.canDeleteDraft).toBe(true);
  });

  it('draft + unknown gate state stays locked (never offers publish blind)', () => {
    expect(lifecycleAvailability('draft', 'verified', undefined).canPublish).toBe(false);
    expect(lifecycleAvailability(undefined, 'verified', false).canPublish).toBe(true);
  });

  it('published allows close/cancel/complete and nothing else', () => {
    expect(lifecycleAvailability('published', 'verified', false)).toEqual({
      canPublish: false,
      publishLockedReason: null,
      canDeleteDraft: false,
      canClose: true,
      canCancel: true,
      canComplete: true,
    });
  });

  it('terminal statuses allow no lifecycle actions', () => {
    for (const status of ['closed', 'cancelled', 'completed', 'in_progress']) {
      const result = lifecycleAvailability(status, 'verified', false);
      expect(result).toMatchObject({
        canPublish: false,
        canDeleteDraft: false,
        canClose: false,
        canCancel: false,
        canComplete: false,
      });
    }
  });
});

describe('buildOwnOpportunityParams', () => {
  it('trims q, keeps whitelisted sorts, clamps limit 1..50', () => {
    expect(buildOwnOpportunityParams({ q: '  food  ', sort: 'newest', limit: 20 })).toEqual({
      q: 'food',
      sort: 'newest',
      limit: 20,
    });
    expect(buildOwnOpportunityParams({ sort: 'popular', limit: 500 }).sort).toBeUndefined();
    expect(buildOwnOpportunityParams({ limit: 500 }).limit).toBe(50);
    expect(buildOwnOpportunityParams({})).toEqual({ limit: 20 });
  });

  it('keeps status only for known opportunity statuses', () => {
    expect(buildOwnOpportunityParams({ status: 'draft' }).status).toBe('draft');
    expect(buildOwnOpportunityParams({ status: 'archived' }).status).toBeUndefined();
  });
});

describe('validateCoverFile', () => {
  it('accepts jpeg/png/webp within 5 MB', () => {
    expect(validateCoverFile({ name: 'c.jpg', type: 'image/jpeg', size: 1024 })).toEqual({ ok: true });
    expect(validateCoverFile({ name: 'c.webp', type: 'image/webp', size: 5 * 1024 * 1024 })).toEqual({
      ok: true,
    });
  });

  it('rejects pdf, gif, and oversize files before any request', () => {
    expect(validateCoverFile({ name: 'c.pdf', type: 'application/pdf', size: 100 })).toEqual({
      ok: false,
      reason: 'type',
    });
    expect(validateCoverFile({ name: 'c.jpg', type: 'image/jpeg', size: 6 * 1024 * 1024 })).toEqual({
      ok: false,
      reason: 'size',
    });
  });
});

describe('positionInputIssues', () => {
  it('flags blank titles, sub-one counts, and bad deliverables', () => {
    expect(positionInputIssues({ title: '  ', requiredCount: 2 })).toContain('title');
    expect(positionInputIssues({ title: 'Helper', requiredCount: 0 })).toContain('requiredCount');
    expect(
      positionInputIssues({ title: 'Helper', requiredCount: 1, filledCount: 2 }),
    ).toContain('requiredCount');
    expect(
      positionInputIssues({ title: 'Helper', requiredCount: 2, deliverables: 'x' }),
    ).toContain('deliverables');
    expect(positionInputIssues({ title: 'Helper', requiredCount: 2, startAt: 'not-a-date' })).toContain(
      'startAt',
    );
  });

  it('passes valid positions', () => {
    expect(
      positionInputIssues({ title: 'Helper', requiredCount: 2, deliverables: ['a'], startAt: '2026-10-01' }),
    ).toEqual([]);
  });
});

describe('isPublishAllowed', () => {
  it('allowed means locked === false, never undefined', () => {
    expect(
      isPublishAllowed({ locked: false, pendingCount: 0, threshold: 3, pendingOpportunities: [] }),
    ).toBe(true);
    expect(
      isPublishAllowed({ locked: true, pendingCount: 3, threshold: 3, pendingOpportunities: [] }),
    ).toBe(false);
    expect(isPublishAllowed(undefined)).toBe(false);
  });
});

describe('identity helpers', () => {
  it('derives ids, status, and OPP- refs', () => {
    expect(opportunityIdOf(draft)).toBe('64f0000000000000000000c1');
    expect(opportunityStatusOf(draft)).toBe('draft');
    expect(opportunityRefOf(draft)).toBe('OPP-000123');
    expect(opportunityRefOf({ title: 'x' })).toBe('');
    expect(positionIdOf(draft.positions[0])).toBe('64f0000000000000000000d1');
    expect(skillCategoryIdOf({ _id: 'c1' })).toBe('c1');
    expect(skillCategoryLabelOf({ nameFr: 'Santé', nameAr: 'الصحة' }, 'ar')).toBe('الصحة');
    expect(skillCategoryLabelOf({ nameFr: 'Santé', nameAr: 'الصحة' }, 'en')).toBe('Santé');
  });
});

describe('typed endpoint functions', () => {
  it('lists with q/sort/limit params and parses the cursor page', async () => {
    const { client, get } = stubClient({ get: () => pageOf([draft]) });
    const result = await listOwnOpportunities(client, { q: 'food', sort: 'newest' });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    const [, config] = get.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(config.params.q).toBe('food');
    expect(config.params.sort).toBe('newest');
  });

  it('reads one owned opportunity, creates, patches, and deletes drafts', async () => {
    const { client, get, post, patch, del } = stubClient({
      get: () => draft,
      post: () => draft,
      patch: () => ({ ...draft, title: 'Renamed' }),
    });
    await expect(getOwnOpportunity(client, '64f0000000000000000000c1')).resolves.toMatchObject({
      title: 'Cleanup day',
    });
    await expect(
      createOpportunity(client, { title: 'New', description: 'Desc' }),
    ).resolves.toMatchObject({ title: 'Cleanup day' });
    await expect(
      patchOpportunity(client, '64f0000000000000000000c1', { title: 'Renamed' }),
    ).resolves.toMatchObject({ title: 'Renamed' });
    await deleteDraftOpportunity(client, '64f0000000000000000000c1');
    expect(get.mock.calls[0]?.[0]).toBe('/organizations/me/opportunities/64f0000000000000000000c1');
    expect(post.mock.calls[0]?.[0]).toBe('/organizations/me/opportunities');
    expect(patch.mock.calls[0]?.[0]).toBe('/opportunities/64f0000000000000000000c1');
    expect(del.mock.calls[0]?.[0]).toBe('/opportunities/64f0000000000000000000c1');
  });

  it('runs lifecycle actions over POST .../publish|close|cancel|complete', async () => {
    const { client, post } = stubClient({ post: () => ({ ...draft, status: 'published' }) });
    for (const action of ['publish', 'close', 'cancel', 'complete'] as const) {
      await expect(
        runLifecycleAction(client, '64f0000000000000000000c1', action),
      ).resolves.toMatchObject({ status: 'published' });
    }
    expect(post.mock.calls.map((c) => c[0])).toEqual([
      '/opportunities/64f0000000000000000000c1/publish',
      '/opportunities/64f0000000000000000000c1/close',
      '/opportunities/64f0000000000000000000c1/cancel',
      '/opportunities/64f0000000000000000000c1/complete',
    ]);
  });

  it('manages positions via POST + PATCH + DELETE only (no PUT)', async () => {
    const position = { _id: '64f0000000000000000000d1', title: 'Helper', requiredCount: 3 };
    const { client, post, patch, del } = stubClient({
      post: () => position,
      patch: () => position,
    });
    await createPosition(client, '64f0000000000000000000c1', { title: 'Helper', requiredCount: 3 });
    await patchPosition(client, '64f0000000000000000000c1', '64f0000000000000000000d1', {
      requiredCount: 4,
    });
    await deletePosition(client, '64f0000000000000000000c1', '64f0000000000000000000d1');
    expect(post.mock.calls[0]?.[0]).toBe('/opportunities/64f0000000000000000000c1/positions');
    expect(patch.mock.calls[0]?.[0]).toBe(
      '/opportunities/64f0000000000000000000c1/positions/64f0000000000000000000d1',
    );
    expect(del.mock.calls[0]?.[0]).toBe(
      '/opportunities/64f0000000000000000000c1/positions/64f0000000000000000000d1',
    );
    expect('put' in client).toBe(false);
  });

  it('duplicates over the owner duplicate route', async () => {
    const { client, post } = stubClient({ post: () => ({ ...draft, status: 'draft' }) });
    await expect(duplicateOpportunity(client, '64f0000000000000000000c1')).resolves.toMatchObject({
      status: 'draft',
    });
    expect(post.mock.calls[0]?.[0]).toBe(
      '/organizations/me/opportunities/64f0000000000000000000c1/duplicate',
    );
  });

  it('reads skill categories, wilayas, municipalities, publish-gate, and org gate', async () => {
    const { client, get } = stubClient({
      get: (url: string) => {
        if (url === '/skill-categories') return [{ _id: 'c1', nameFr: 'Santé' }];
        if (url === '/locations/wilayas') return [{ code: '16', nameFr: 'Alger', nameAr: 'الجزائر' }];
        if (url.endsWith('/municipalities')) return [{ code: '1601', nameFr: 'Alger', nameAr: 'الجزائر' }];
        if (url === '/organizations/me/publish-gate') {
          return { locked: false, pendingCount: 0, threshold: 3, pendingOpportunities: [] };
        }
        if (url === '/organizations/me') return { verificationStatus: 'verified', status: 'active' };
        return undefined;
      },
    });
    await expect(listSkillCategories(client)).resolves.toHaveLength(1);
    await expect(listWilayas(client)).resolves.toHaveLength(1);
    await expect(listMunicipalities(client, '16')).resolves.toHaveLength(1);
    await expect(getPublishGate(client)).resolves.toMatchObject({ locked: false, threshold: 3 });
    await expect(getOwnOrgGate(client)).resolves.toMatchObject({ verificationStatus: 'verified' });
    expect(get.mock.calls.map((c) => c[0])).toEqual([
      '/skill-categories',
      '/locations/wilayas',
      '/locations/wilayas/16/municipalities',
      '/organizations/me/publish-gate',
      '/organizations/me',
    ]);
  });

  it('reads skills with an optional category filter and normalizes skill ids', async () => {
    const { client, get } = stubClient({
      get: () => [{ _id: '64f0000000000000000000e1', nameFr: 'Photo', nameAr: 'تصوير' }],
    });
    await expect(listSkills(client)).resolves.toHaveLength(1);
    await expect(listSkills(client, { categoryId: 'c1' })).resolves.toHaveLength(1);
    expect(get.mock.calls.map((c) => c[0])).toEqual(['/skills', '/skills']);
    const [, config] = get.mock.calls[1] as [string, { params: Record<string, unknown> }];
    expect(config.params.categoryId).toBe('c1');
    expect(skillIdOf({ _id: '64f0000000000000000000e1', nameFr: 'Photo' })).toBe(
      '64f0000000000000000000e1',
    );
    expect(skillLabelOf({ nameFr: 'Photo', nameAr: 'تصوير' }, 'ar')).toBe('تصوير');
    expect(
      skillIdsOfSkills([
        '64f0000000000000000000e1',
        'not-an-id',
        { skillId: '64f0000000000000000000e2' },
        { _id: '64f0000000000000000000e1' },
        42,
      ]),
    ).toEqual(['64f0000000000000000000e1', '64f0000000000000000000e2']);
    expect(skillIdsOfSkills(undefined)).toEqual([]);
  });
});
