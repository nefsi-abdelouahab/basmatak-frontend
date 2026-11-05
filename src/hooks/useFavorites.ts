'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ApiError, mapToApiError } from '../lib/api/errors';
import { queryKeys } from '../lib/query/keys';
import * as favoritesApi from '../lib/api/favorites';
import type { FavoriteTargetType } from '../lib/api/favorites';
import { getLoginHref } from './useSession';

// F4 favorites hook file (the session's second hook file per the roadmap
// split: useFeed.ts reads, useFavorites.ts saves). Toggles are optimistic
// (flip → reconcile with server or roll back); card state hydrates via the
// guest-tolerant `GET /favorites/lookup` batch. Guests never mutate: save
// attempts redirect to Login (decision 10 — backend only 401s).

const DOMAIN = 'volunteer-home-favorites';

export function favoritesKeys() {
  return {
    counts: queryKeys.detail(DOMAIN, 'counts'),
    list: (params: { targetType?: FavoriteTargetType; cursor?: string }) =>
      queryKeys.list(DOMAIN, { scope: 'mine', ...params }),
    lookup: (targetType: FavoriteTargetType, targetIds: string[]) =>
      queryKeys.list(DOMAIN, { scope: 'lookup', targetType, targetIds }),
  };
}

export function isAuthError(err: unknown): boolean {
  const mapped = mapToApiError(err);
  return mapped instanceof ApiError && mapped.statusCode === 401;
}

/**
 * Locale-less `/login?next=…` for the locale-aware router; see `getLoginHref`
 * for why the locale is not part of the path.
 */
export function loginHrefForSave(next: string): string {
  return getLoginHref(next);
}

export function useFavoritesCountsQuery(enabled = true) {
  return useQuery({
    queryKey: favoritesKeys().counts,
    queryFn: () => favoritesApi.countsOwn(api),
    staleTime: 30_000,
    retry: false,
    enabled,
  });
}

export function useFavoritesLookupQuery(
  targetType: FavoriteTargetType,
  targetIds: string[],
  enabled = true,
) {
  return useQuery({
    queryKey: favoritesKeys().lookup(targetType, targetIds),
    queryFn: () => favoritesApi.lookupFavorites(api, { targetType, targetIds }),
    staleTime: 30_000,
    retry: false,
    enabled: enabled && targetIds.length > 0,
  });
}

export function useMyFavoritesQuery(
  params: { targetType?: FavoriteTargetType; cursor?: string } = {},
  enabled = true,
) {
  return useQuery({
    queryKey: favoritesKeys().list(params),
    queryFn: () =>
      favoritesApi.listOwnFavorites(api, {
        targetType: params.targetType,
        cursor: params.cursor,
      }),
    staleTime: 30_000,
    retry: false,
    enabled,
  });
}

function invalidateFeedLists(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.domain('volunteer-home') });
  queryClient.invalidateQueries({ queryKey: queryKeys.domain('volunteer-home-opportunities') });
  queryClient.invalidateQueries({ queryKey: queryKeys.domain('volunteer-home-talents') });
  queryClient.invalidateQueries({ queryKey: queryKeys.domain('volunteer-home-recommended') });
  queryClient.invalidateQueries({ queryKey: queryKeys.domain('public-orgs-opp') });
  queryClient.invalidateQueries({ queryKey: queryKeys.domain('opportunity') });
  queryClient.invalidateQueries({ queryKey: queryKeys.domain('public-opportunities-feed') });
  queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
}

export function useToggleOpportunityFavoriteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: (variables: { favorited: boolean }) => variables.favorited ? 'success.favoriteRemoved' : 'success.favoriteAdded' },
    mutationFn: async ({
      id,
      favorited,
    }: {
      id: string;
      favorited: boolean;
    }): Promise<{ favorited: boolean }> => {
      if (favorited) {
        await favoritesApi.removeOpportunity(api, id);
        return { favorited: false };
      }
      return favoritesApi.saveOpportunity(api, id);
    },
    onSuccess: () => invalidateFeedLists(queryClient),
  });
}

export function useToggleTalentFavoriteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: (variables: { favorited: boolean }) => variables.favorited ? 'success.favoriteRemoved' : 'success.favoriteAdded' },
    mutationFn: async ({
      username,
      favorited,
    }: {
      username: string;
      favorited: boolean;
    }): Promise<{ favorited: boolean }> => {
      if (favorited) {
        await favoritesApi.removeTalent(api, username);
        return { favorited: false };
      }
      return favoritesApi.saveTalent(api, username);
    },
    onSuccess: () => invalidateFeedLists(queryClient),
  });
}

export function useToggleOrganizationFavoriteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: (variables: { favorited: boolean }) => variables.favorited ? 'success.favoriteRemoved' : 'success.favoriteAdded' },
    mutationFn: async ({
      slug,
      favorited,
    }: {
      slug: string;
      favorited: boolean;
    }): Promise<{ favorited: boolean }> => {
      if (favorited) {
        await favoritesApi.removeOrganization(api, slug);
        return { favorited: false };
      }
      return favoritesApi.saveOrganization(api, slug);
    },
    onSuccess: () => invalidateFeedLists(queryClient),
  });
}
