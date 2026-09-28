'use client';

import { useQuery, type QueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query/keys';
import * as publicTalentApi from '../lib/api/publicTalent';
import type { PublicTalentFilters } from '../lib/api/publicTalent';
// Import-only reuse (never edited, never re-wrapped): F4 `feed.ts` already owns
// the guest `GET /locations/wilayas` read and F2 `volunteers.ts` the
// `GET /skills` read, so this session reuses the typed functions instead of
// declaring a third copy of either endpoint. Keys stay namespaced to this
// session's domain (convention 2).
import * as feedApi from '../lib/api/feed';
import * as volunteersApi from '../lib/api/volunteers';

// F17 public-talent hook file: the merged public profile, its opt-out-gated
// sections, the public reviews page, guest media reads, and the public talent
// directory. Components fetch only through these hooks; every key comes from
// the F0 factory (no `keys.ts` edit).
//
// GATING: the experiences paginator is `enabled` ONLY from
// `experiencesGateOpen(profile)`. The standalone route does not re-apply
// `showExperiences`, so a closed gate must mean zero requests, not a hidden
// result. `limit` defaults to the backend MAX_LIMIT so the first page aligns
// with the profile's embedded window and "load more" only ever adds unseen
// rows (design D1/D9). Portfolio needs no paginator: the embedded `{ items }`
// set is already complete.

const PROFILE_DOMAIN = 'public-talent-profile';
const DISCOVERY_DOMAIN = 'public-talent-discovery';
const LOOKUP_DOMAIN = 'public-talent-lookup';

export function publicTalentKeys() {
  return {
    profile: (username: string) => queryKeys.detail(PROFILE_DOMAIN, username),
    experiences: (username: string, cursor?: string) =>
      queryKeys.list(`${PROFILE_DOMAIN}-experiences`, { username, cursor: cursor ?? null }),
    reviews: (username: string, cursor?: string) =>
      queryKeys.list(`${PROFILE_DOMAIN}-reviews`, { username, cursor: cursor ?? null }),
    media: (mediaId: string) => queryKeys.detail(`${PROFILE_DOMAIN}-media`, mediaId),
    directory: (params: Record<string, string>) =>
      queryKeys.list(DISCOVERY_DOMAIN, params),
    skills: queryKeys.list(LOOKUP_DOMAIN, { scope: 'skills' }),
    wilayas: queryKeys.list(LOOKUP_DOMAIN, { scope: 'wilayas' }),
    categories: queryKeys.list(LOOKUP_DOMAIN, { scope: 'categories' }),
  };
}

export function usePublicTalentProfileQuery(username: string) {
  return useQuery({
    queryKey: publicTalentKeys().profile(username),
    queryFn: () => publicTalentApi.getPublicTalentProfile(api, username),
    staleTime: 60_000,
    retry: false,
    enabled: username.trim() !== '',
  });
}

/**
 * Paginator for the experiences block. `enabled` must come from
 * `experiencesGateOpen(profile)` so an opted-out volunteer never triggers a
 * request to the ungated standalone route.
 */
export function usePublicTalentExperiencesQuery(
  username: string,
  cursor: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: publicTalentKeys().experiences(username, cursor),
    queryFn: () =>
      publicTalentApi.getPublicTalentExperiences(api, username, {
        cursor,
        limit: publicTalentApi.PUBLIC_PAGE_MAX,
      }),
    staleTime: 60_000,
    retry: false,
    enabled: enabled && username.trim() !== '',
  });
}

/**
 * Reviews are ungated server-side, so `enabled` waits for the profile to resolve
 * rather than firing for a username that turns out to be missing (404) or opted
 * out. An empty result still renders the section's neutral empty state.
 */
export function usePublicTalentReviewsQuery(
  username: string,
  cursor: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: publicTalentKeys().reviews(username, cursor),
    queryFn: () =>
      publicTalentApi.getPublicTalentReviews(api, username, {
        cursor,
        limit: 10,
      }),
    staleTime: 60_000,
    retry: false,
    enabled: enabled && username.trim() !== '',
  });
}

/** Guest read of one media row; `enabled` gates on a present id only. */
export function usePublicMediaQuery(mediaId: string | null | undefined) {
  const effective = mediaId ?? '';
  return useQuery({
    queryKey: publicTalentKeys().media(effective),
    queryFn: () => publicTalentApi.getPublicMedia(api, effective),
    staleTime: 300_000,
    retry: false,
    enabled: effective !== '',
  });
}

/**
 * Directory list. An out-of-whitelist `sort` is refused here, so the query stays
 * disabled and no request is issued; the page renders the neutral message.
 */
export function usePublicTalentsQuery(filters: PublicTalentFilters) {
  const built = publicTalentApi.buildTalentsQuery(filters);
  return useQuery({
    queryKey: publicTalentKeys().directory(built.ok ? built.params : { invalid: 'sort' }),
    queryFn: () => publicTalentApi.listPublicTalents(api, filters),
    staleTime: 30_000,
    retry: false,
    enabled: built.ok,
  });
}

export function usePublicTalentSkillsQuery() {
  return useQuery({
    queryKey: publicTalentKeys().skills,
    queryFn: () => volunteersApi.listSkills(api),
    staleTime: 300_000,
    retry: false,
  });
}

export function usePublicTalentWilayasQuery() {
  return useQuery({
    queryKey: publicTalentKeys().wilayas,
    queryFn: () => feedApi.listWilayas(api),
    staleTime: 300_000,
    retry: false,
  });
}

export function usePublicTalentCategoriesQuery() {
  return useQuery({
    queryKey: publicTalentKeys().categories,
    queryFn: () => volunteersApi.listSkillCategories(api),
    staleTime: 300_000,
    retry: false,
  });
}

// F4's `useToggleTalentFavoriteMutation` is reused unchanged and its
// `invalidateFeedLists` only knows the `volunteer-home*` domains, so a favorite
// toggled from a public page would leave this session's cached cards stale
// (`aria-pressed` stuck on the old value). These two narrow invalidators close
// that gap from the owning side instead of editing the shared hook.
export function invalidatePublicTalentProfile(queryClient: QueryClient, username: string) {
  queryClient.invalidateQueries({ queryKey: publicTalentKeys().profile(username) });
}

export function invalidatePublicTalentDirectory(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.domain(DISCOVERY_DOMAIN) });
}
