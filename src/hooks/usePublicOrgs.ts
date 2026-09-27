'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query/keys';
import * as publicOrgsApi from '../lib/api/publicOrgs';
import type {
  ArchiveStatus,
  OrgOppsParams,
  OrgSearchParams,
  PublicFeedParams,
} from '../lib/api/publicOrgs';

// F18 public-orgs hook file: landing, public org profile, and public
// opportunity details. Components fetch only via these hooks; every key comes
// from the F0 factory under the public-orgs domain (no keys.ts edit, no
// archived-module imports — publicOrgs.ts wraps every read this session needs;
// favorites toggle through F4 useFavorites read-only, never reimplemented here).

const DOMAIN = 'public-orgs';

export function publicOrgsKeys() {
  return {
    orgs: (params: OrgSearchParams) =>
      queryKeys.list(`${DOMAIN}-orgs`, params as Record<string, unknown>),
    orgProfile: (slug: string) => queryKeys.detail(`${DOMAIN}-org`, slug),
    orgOpps: (slug: string, params: OrgOppsParams) =>
      queryKeys.list(`${DOMAIN}-org-opps-${slug}`, params as Record<string, unknown>),
    orgReliability: (slug: string) => queryKeys.detail(`${DOMAIN}-reliability`, slug),
    opps: (params: PublicFeedParams) =>
      queryKeys.list(`${DOMAIN}-opps`, params as Record<string, unknown>),
    oppDetail: (idOrSlug: string) => queryKeys.detail(`${DOMAIN}-opp`, idOrSlug),
    related: (orgSlug: string, excludeId?: string) =>
      queryKeys.list(`${DOMAIN}-related-${orgSlug}`, { excludeId: excludeId ?? 'none' }),
    talentSamples: queryKeys.list(`${DOMAIN}-talent-samples`),
    skillCategories: queryKeys.list(DOMAIN, { scope: 'skill-categories' }),
    wilayas: queryKeys.list(DOMAIN, { scope: 'wilayas' }),
    media: (mediaId: string) => queryKeys.detail(`${DOMAIN}-media`, mediaId),
  };
}

export function usePublicOrgsQuery(params: OrgSearchParams) {
  return useQuery({
    queryKey: publicOrgsKeys().orgs(params),
    queryFn: () => publicOrgsApi.searchPublicOrgs(api, params),
    staleTime: 60_000,
    retry: false,
  });
}

export function usePublicOrgProfileQuery(slug: string) {
  return useQuery({
    queryKey: publicOrgsKeys().orgProfile(slug),
    queryFn: () => publicOrgsApi.getPublicOrgProfile(api, slug),
    staleTime: 60_000,
    retry: false,
    enabled: slug.trim() !== '',
  });
}

export function usePublicOrgOppsQuery(slug: string, params: OrgOppsParams) {
  return useQuery({
    queryKey: publicOrgsKeys().orgOpps(slug, params),
    queryFn: () => publicOrgsApi.listPublicOrgOpportunities(api, slug, params),
    staleTime: 30_000,
    retry: false,
    enabled: slug.trim() !== '',
  });
}

export function usePublicOrgReliabilityQuery(slug: string) {
  return useQuery({
    queryKey: publicOrgsKeys().orgReliability(slug),
    queryFn: () => publicOrgsApi.getPublicOrgReliability(api, slug),
    staleTime: 60_000,
    retry: false,
    enabled: slug.trim() !== '',
  });
}

export function usePublicOppsQuery(params: PublicFeedParams) {
  return useQuery({
    queryKey: publicOrgsKeys().opps(params),
    queryFn: () => publicOrgsApi.listPublicOpportunities(api, params),
    staleTime: 30_000,
    retry: false,
  });
}

export function usePublicOppDetailQuery(idOrSlug: string) {
  return useQuery({
    queryKey: publicOrgsKeys().oppDetail(idOrSlug),
    queryFn: () => publicOrgsApi.getPublicOpportunityDetail(api, idOrSlug),
    staleTime: 30_000,
    retry: false,
    enabled: idOrSlug.trim() !== '',
  });
}

// OQ3-approved: published-only related read through the embedded org slug.
export function useRelatedPublicOppsQuery(orgSlug: string | null, excludeId?: string) {
  return useQuery({
    queryKey: publicOrgsKeys().related(orgSlug ?? 'none', excludeId),
    queryFn: () =>
      publicOrgsApi.listRelatedPublicOpportunities(api, orgSlug ?? '', excludeId),
    staleTime: 60_000,
    retry: false,
    enabled: Boolean(orgSlug),
  });
}

export function useTalentSamplesQuery() {
  return useQuery({
    queryKey: publicOrgsKeys().talentSamples,
    queryFn: () => publicOrgsApi.listTalentSamples(api, 6),
    staleTime: 60_000,
    retry: false,
  });
}

export function usePublicSkillCategoriesQuery() {
  return useQuery({
    queryKey: publicOrgsKeys().skillCategories,
    queryFn: () => publicOrgsApi.listSkillCategories(api),
    staleTime: 300_000,
    retry: false,
  });
}

export function usePublicWilayasQuery() {
  return useQuery({
    queryKey: publicOrgsKeys().wilayas,
    queryFn: () => publicOrgsApi.listWilayas(api),
    staleTime: 300_000,
    retry: false,
  });
}

export function usePublicMediaQuery(mediaId: string | null | undefined) {
  const effectiveMediaId = mediaId ?? '';
  return useQuery({
    queryKey: publicOrgsKeys().media(mediaId ?? 'none'),
    queryFn: () => publicOrgsApi.getPublicMedia(api, effectiveMediaId),
    enabled: Boolean(mediaId),
    staleTime: 300_000,
    retry: false,
  });
}

export type { ArchiveStatus };
