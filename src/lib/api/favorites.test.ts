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
  removeTalent,
  saveOpportunity,
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

  it('reads counts and hydrates card state via lookup', async () => {
    const { client, get } = stubClient({
      get: (url) => {
        if (url === '/favorites/counts') return { opportunities: 3, talents: 1 };
        if (url === '/favorites/lookup')
          return { 'opp:1': { favorited: true, favoriteCount: 4 } };
        if (url === '/favorites') return { items: [] };
        throw new Error(`unexpected ${url}`);
      },
    });
    await expect(countsOwn(client)).resolves.toEqual({ opportunities: 3, talents: 1 });
    const lookup = await lookupFavorites(client, {
      targetType: 'opportunity',
      targetIds: ['1'],
    });
    expect(lookup['opp:1']).toEqual({ favorited: true, favoriteCount: 4 });
    expect(get).toHaveBeenCalledWith('/favorites/lookup', {
      params: expect.objectContaining({ targetType: 'opportunity', targetIds: '1' }),
    });
    await expect(listOwnFavorites(client)).resolves.toEqual({ items: [] });
  });

  it('accepts toggle/count/lookup shapes', () => {
    expect(
      FavoriteToggleResultSchema.safeParse({ favorited: true, favoriteCount: 1 }).success,
    ).toBe(true);
    expect(FavoritesCountsSchema.safeParse({ opportunities: 0, talents: 0 }).success).toBe(
      true,
    );
    expect(LookupStateSchema.safeParse({ favorited: false }).success).toBe(true);
  });
});
