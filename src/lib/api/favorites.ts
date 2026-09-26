import { z } from 'zod';
import type { AxiosInstance } from 'axios';

// F4 favorites module: one typed function per favorites backend endpoint
// (base `/api/v1`). Verified read-only against
// backend/src/favorites/favorites.controller.ts:
// - POST /favorites/opportunities/:id (201 created / 200 already-saved →
//   {favorited: true, favoriteCount})
// - DELETE /favorites/opportunities/:id (204, idempotent unsave)
// - POST /favorites/talents/:username (same contract, raw username, no `@`)
// - DELETE /favorites/talents/:username (204)
// - GET /favorites (own saves, both target types)
// - GET /favorites/counts (per-type totals)
// - GET /favorites/lookup (guest-tolerant batch card state
//   {favorited, favoriteCount} per key; counts-only for anonymous callers).
// Toggle routes require the volunteer role (guests 401 → frontend redirects
// to Login per decision 10; the backend never renders login UI).

export const FavoriteToggleResultSchema = z
  .object({
    favorited: z.boolean(),
    favoriteCount: z.number().optional(),
  })
  .passthrough();

export type FavoriteToggleResult = z.infer<typeof FavoriteToggleResultSchema>;

export const LookupStateSchema = z
  .object({
    favorited: z.boolean(),
    favoriteCount: z.number().optional(),
  })
  .passthrough();

export type LookupState = z.infer<typeof LookupStateSchema>;

export const FavoritesCountsSchema = z
  .object({
    opportunities: z.number().optional(),
    talents: z.number().optional(),
  })
  .passthrough();

export type FavoritesCounts = z.infer<typeof FavoritesCountsSchema>;

export type FavoriteTargetType = 'opportunity' | 'talent';

export const MAX_LOOKUP_KEYS = 50;

type HttpClient = Pick<AxiosInstance, 'get' | 'post' | 'delete'>;

export async function saveOpportunity(
  client: HttpClient,
  id: string,
): Promise<FavoriteToggleResult> {
  const { data } = await client.post(`/favorites/opportunities/${id}`);
  return FavoriteToggleResultSchema.parse(data);
}

export async function removeOpportunity(client: HttpClient, id: string): Promise<void> {
  await client.delete(`/favorites/opportunities/${id}`);
}

export async function saveTalent(
  client: HttpClient,
  username: string,
): Promise<FavoriteToggleResult> {
  const { data } = await client.post(`/favorites/talents/${username}`);
  return FavoriteToggleResultSchema.parse(data);
}

export async function removeTalent(client: HttpClient, username: string): Promise<void> {
  await client.delete(`/favorites/talents/${username}`);
}

export async function listOwnFavorites(
  client: HttpClient,
  params?: { cursor?: string; limit?: number },
): Promise<unknown> {
  const { data } = await client.get('/favorites', { params });
  return data;
}

export async function countsOwn(client: HttpClient): Promise<FavoritesCounts> {
  const { data } = await client.get('/favorites/counts');
  return FavoritesCountsSchema.parse(data);
}

export async function lookupFavorites(
  client: HttpClient,
  params: { targetType: FavoriteTargetType; targetIds: string[] },
): Promise<Record<string, LookupState>> {
  const query: Record<string, string> = {
    targetType: params.targetType,
    targetIds: params.targetIds.slice(0, MAX_LOOKUP_KEYS).join(','),
  };
  const { data } = await client.get('/favorites/lookup', { params: query });
  return z.record(z.string(), LookupStateSchema).parse(data);
}
