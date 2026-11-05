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
// - POST /favorites/organizations/:slug (same contract, raw slug)
// - DELETE /favorites/organizations/:slug (204)
// - GET /favorites (own saves, all target types; `targetType` filter)
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
    opportunity: z.number().optional(),
    talent: z.number().optional(),
    organization: z.number().optional(),
  })
  .passthrough();

export type FavoritesCounts = z.infer<typeof FavoritesCountsSchema>;

export type FavoriteTargetType = 'opportunity' | 'talent' | 'organization';

export const FAVORITE_TARGET_TYPES = [
  'opportunity',
  'talent',
  'organization',
] as const;

export const MAX_LOOKUP_KEYS = 50;

// Summary shape is additive across target types (backend
// `favorites.service.ts`): opportunity rows carry title/slug/status plus the
// optional deadline and organization embed; talent rows carry username
// (fullName is accepted but never rendered); organization rows carry the
// localized names and status.
export const FavoriteSummarySchema = z
  .object({
    title: z.string().optional(),
    slug: z.string().optional(),
    status: z.string().nullable().optional(),
    applicationDeadline: z.string().nullable().optional(),
    organization: z
      .object({
        slug: z.string().optional(),
        nameAr: z.string().nullable().optional(),
        nameFr: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    username: z.string().optional(),
    fullName: z.string().nullable().optional(),
    nameAr: z.string().nullable().optional(),
    nameFr: z.string().nullable().optional(),
  })
  .passthrough();

export type FavoriteSummary = z.infer<typeof FavoriteSummarySchema>;

export const FavoriteItemSchema = z
  .object({
    targetType: z.enum(FAVORITE_TARGET_TYPES),
    targetId: z.string(),
    createdAt: z.string(),
    summary: FavoriteSummarySchema.nullable(),
  })
  .passthrough();

export type FavoriteItem = z.infer<typeof FavoriteItemSchema>;

export const FavoritePageSchema = z
  .object({
    items: z.array(FavoriteItemSchema),
    nextCursor: z.string().nullable().optional(),
    limit: z.number().optional(),
    total: z.number(),
    page: z.number().optional(),
    pages: z.number().optional(),
  })
  .passthrough();

export type FavoritePage = z.infer<typeof FavoritePageSchema>;

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

export async function saveOrganization(
  client: HttpClient,
  slug: string,
): Promise<FavoriteToggleResult> {
  const { data } = await client.post(`/favorites/organizations/${slug}`);
  return FavoriteToggleResultSchema.parse(data);
}

export async function removeOrganization(
  client: HttpClient,
  slug: string,
): Promise<void> {
  await client.delete(`/favorites/organizations/${slug}`);
}

export interface ListOwnFavoritesParams {
  targetType?: FavoriteTargetType;
  cursor?: string;
  limit?: number;
}

export async function listOwnFavorites(
  client: HttpClient,
  params?: ListOwnFavoritesParams,
): Promise<FavoritePage> {
  const { data } = await client.get('/favorites', { params });
  return FavoritePageSchema.parse(data);
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
