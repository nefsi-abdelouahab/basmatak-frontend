import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  FavoriteToggleResultSchema,
  FavoritesCountsSchema,
  LookupStateSchema,
  countsOwn,
  listOwnFavorites,
  lookupFavorites,
  removeOpportunity,
  removeOrganization,
  removeTalent,
  saveOpportunity,
  saveOrganization,
  saveTalent,
} from './favorites';

function stubClient(handlers: {
  get?: (url: string, config?: { params?: unknown }) => unknown;
  post?: (url: string) => unknown;
  delete?: (url: string) => unknown;
}) {
  const get = vi.fn(async (url: string, config?: { params?: unknown }) => ({
    data: handlers.get?.(url, config),
  }));
  const post = vi.fn(async (url: string) => ({ data: handlers.post?.(url) }));
  const del = vi.fn(async (url: string) => ({ data: handlers.delete?.(url) }));
  const client = { get, post, delete: del } as unknown as AxiosInstance;
  return { client, get, post, del };
}

describe('favorites api functions', () => {
  it('saves and unsaves opportunities idempotently', async () => {
    const { client, post, del } = stubClient({
      post: () => ({ favorited: true, favoriteCount: 4 }),
      delete: () => undefined,
    });
    await expect(saveOpportunity(client, '64f000000000000000000001')).resolves.toEqual({
      favorited: true,
      favoriteCount: 4,
    });
    expect(post).toHaveBeenCalledWith('/favorites/opportunities/64f000000000000000000001');
    await expect(
      removeOpportunity(client, '64f000000000000000000001'),
    ).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledWith('/favorites/opportunities/64f000000000000000000001');
  });

  it('saves and unsaves talents by raw username (no @)', async () => {
    const { client, post, del } = stubClient({
      post: () => ({ favorited: true, favoriteCount: 2 }),
      delete: () => undefined,
    });
    await expect(saveTalent(client, 'amineb')).resolves.toEqual({
      favorited: true,
      favoriteCount: 2,
    });
    expect(post).toHaveBeenCalledWith('/favorites/talents/amineb');
    await expect(removeTalent(client, 'amineb')).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledWith('/favorites/talents/amineb');
  });

  it('saves and unsaves organizations by raw slug', async () => {
    const { client, post, del } = stubClient({
      post: () => ({ favorited: true, favoriteCount: 1 }),
      delete: () => undefined,
    });
    await expect(saveOrganization(client, 'green-algeria')).resolves.toEqual({
      favorited: true,
      favoriteCount: 1,
    });
    expect(post).toHaveBeenCalledWith('/favorites/organizations/green-algeria');
    await expect(removeOrganization(client, 'green-algeria')).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledWith('/favorites/organizations/green-algeria');
  });

  it('reads counts and hydrates card state via lookup', async () => {
    const { client, get } = stubClient({
      get: (url) => {
        if (url === '/favorites/counts')
          return { opportunity: 3, talent: 1, organization: 2 };
        if (url === '/favorites/lookup')
          return { 'opp:1': { favorited: true, favoriteCount: 4 } };
        if (url === '/favorites')
          return {
            items: [
              {
                targetType: 'opportunity',
                targetId: '64f000000000000000000001',
                createdAt: '2026-01-01T00:00:00.000Z',
                summary: {
                  title: 'Beach cleanup',
                  slug: 'beach-cleanup',
                  status: 'published',
                  applicationDeadline: '2026-12-31T00:00:00.000Z',
                  organization: {
                    slug: 'green-algeria',
                    nameAr: 'الجزائر الخضراء',
                    nameFr: 'Green Algeria',
                  },
                },
              },
            ],
            total: 1,
            page: 1,
            pages: 1,
          };
        throw new Error(`unexpected ${url}`);
      },
    });
    await expect(countsOwn(client)).resolves.toEqual({
      opportunity: 3,
      talent: 1,
      organization: 2,
    });
    const lookup = await lookupFavorites(client, {
      targetType: 'opportunity',
      targetIds: ['1'],
    });
    expect(lookup['opp:1']).toEqual({ favorited: true, favoriteCount: 4 });
    expect(get).toHaveBeenCalledWith('/favorites/lookup', {
      params: expect.objectContaining({ targetType: 'opportunity', targetIds: '1' }),
    });
    const page = await listOwnFavorites(client, {
      targetType: 'opportunity',
      cursor: 'next',
      limit: 20,
    });
    expect(page.items[0].summary?.title).toBe('Beach cleanup');
    expect(page.items[0].summary?.organization?.slug).toBe('green-algeria');
    expect(get).toHaveBeenCalledWith('/favorites', {
      params: { targetType: 'opportunity', cursor: 'next', limit: 20 },
    });
  });

  it('accepts toggle/count/lookup shapes', () => {
    expect(
      FavoriteToggleResultSchema.safeParse({ favorited: true, favoriteCount: 1 }).success,
    ).toBe(true);
    expect(
      FavoritesCountsSchema.safeParse({ opportunity: 0, talent: 0, organization: 0 }).success,
    ).toBe(true);
    expect(LookupStateSchema.safeParse({ favorited: false }).success).toBe(true);
  });
});
