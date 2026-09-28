'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query/keys';
import * as publicOpportunitiesApi from '../lib/api/publicOpportunities';
import type { PublicOpportunitiesParams } from '../lib/api/publicOpportunities';
// Import-only reuse (never edited, never re-wrapped): `feed.ts` already owns
// the guest facet reads (`GET /skill-categories`, `GET /skills`,
// `GET /locations/wilayas`), so this session reuses the typed functions
// instead of declaring another copy of any endpoint (F17 precedent). Keys stay
// namespaced to this session's domain.
import * as feedApi from '../lib/api/feed';

// Public opportunities-list hook file: the guest feed plus its facet lookups.
// Components fetch only through these hooks; every key comes from the F0
// factory under this session's domain (no keys.ts edit).
const DOMAIN = 'public-opportunities';

export function publicOpportunitiesKeys() {
  return {
    feed: (params: PublicOpportunitiesParams) =>
      queryKeys.list(`${DOMAIN}-feed`, params as Record<string, unknown>),
    skillCategories: queryKeys.list(DOMAIN, { scope: 'skill-categories' }),
    skills: queryKeys.list(DOMAIN, { scope: 'skills' }),
    wilayas: queryKeys.list(DOMAIN, { scope: 'wilayas' }),
  };
}

export function usePublicOpportunitiesQuery(params: PublicOpportunitiesParams) {
  return useQuery({
    queryKey: publicOpportunitiesKeys().feed(params),
    queryFn: () => publicOpportunitiesApi.listPublicOpportunities(api, params),
    staleTime: 30_000,
    retry: false,
    placeholderData: (previous) => previous,
  });
}

export function usePublicOpportunitiesSkillCategoriesQuery() {
  return useQuery({
    queryKey: publicOpportunitiesKeys().skillCategories,
    queryFn: () => feedApi.listSkillCategories(api),
    staleTime: 300_000,
    retry: false,
  });
}

export function usePublicOpportunitiesSkillsQuery() {
  return useQuery({
    queryKey: publicOpportunitiesKeys().skills,
    queryFn: () => feedApi.listSkills(api),
    staleTime: 300_000,
    retry: false,
  });
}

export function usePublicOpportunitiesWilayasQuery() {
  return useQuery({
    queryKey: publicOpportunitiesKeys().wilayas,
    queryFn: () => feedApi.listWilayas(api),
    staleTime: 300_000,
    retry: false,
  });
}
