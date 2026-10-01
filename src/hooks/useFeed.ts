'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query/keys';
import * as feedApi from '../lib/api/feed';
import type {
  OpportunityFeedParams,
  OrganizationEmbed,
  TalentFeedParams,
} from '../lib/api/feed';

// F4 feed hook file: dashboard, opportunities + recommended, talents, and
// facet lookups. Components fetch only via these hooks; keys come from the
// F0 factory under the volunteer-home domain (no keys.ts edits, no archived
// module imports — feed.ts wraps every read this session needs).

const DOMAIN = 'volunteer-home';

export function feedKeys() {
  return {
    dashboard: queryKeys.detail(DOMAIN, 'dashboard'),
    opportunities: (params: OpportunityFeedParams) =>
      queryKeys.list(`${DOMAIN}-opportunities`, params as Record<string, unknown>),
    recommended: queryKeys.list(`${DOMAIN}-recommended`),
    talents: (params: TalentFeedParams) =>
      queryKeys.list(`${DOMAIN}-talents`, params as Record<string, unknown>),
    skillCategories: queryKeys.list(DOMAIN, { scope: 'skill-categories' }),
    skills: (categoryId?: string) =>
      queryKeys.list(DOMAIN, categoryId ? { scope: 'skills', categoryId } : { scope: 'skills' }),
    wilayas: queryKeys.list(DOMAIN, { scope: 'wilayas' }),
    municipalities: (wilayaId: string) =>
      queryKeys.list(DOMAIN, { scope: 'municipalities', wilayaId }),
  };
}

// Card display helpers (pure; embed-only, no fetches):
// - org names resolve per locale with fr fallback; registry refs stay
//   display-only (`OPP-<registryId>`, never a route key).
// - verified badge reads the embed `verificationStatus` only.
// - durations render from real `durationMinutes` only (null → null).
export function orgDisplayName(
  embed: OrganizationEmbed | null | undefined,
  locale: string,
): string {
  if (!embed) return '';
  if (locale === 'ar') return embed.nameAr ?? embed.nameFr ?? '';
  return embed.nameFr ?? embed.nameAr ?? '';
}

export function isOrgVerified(embed: OrganizationEmbed | null | undefined): boolean {
  return embed?.verificationStatus === 'verified';
}

export function opportunityRef(registryId: string | null | undefined): string | null {
  if (!registryId) return null;
  return `OPP-${registryId}`;
}

export function hoursLabel(durationMinutes: number | null | undefined): string | null {
  if (typeof durationMinutes !== 'number' || !Number.isFinite(durationMinutes)) return null;
  const hours = durationMinutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

export function useVolunteerHomeDashboardQuery() {
  return useQuery({
    queryKey: feedKeys().dashboard,
    queryFn: () => feedApi.getVolunteerHomeDashboard(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function useOpportunitiesQuery(params: OpportunityFeedParams, enabled = true) {
  return useQuery({
    queryKey: feedKeys().opportunities(params),
    queryFn: () => feedApi.listOpportunities(api, params),
    staleTime: 30_000,
    retry: false,
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useRecommendedQuery(enabled = true) {
  return useQuery({
    queryKey: feedKeys().recommended,
    queryFn: () => feedApi.listRecommended(api, { limit: 5 }),
    staleTime: 60_000,
    retry: false,
    enabled,
  });
}

export function useTalentsQuery(params: TalentFeedParams) {
  return useQuery({
    queryKey: feedKeys().talents(params),
    queryFn: () => feedApi.listTalents(api, params),
    staleTime: 30_000,
    retry: false,
    placeholderData: (previous) => previous,
  });
}

export function useFeedSkillCategoriesQuery() {
  return useQuery({
    queryKey: feedKeys().skillCategories,
    queryFn: () => feedApi.listSkillCategories(api),
    staleTime: 300_000,
    retry: false,
  });
}

export function useFeedSkillsQuery(categoryId?: string) {
  return useQuery({
    queryKey: feedKeys().skills(categoryId),
    queryFn: () => feedApi.listSkills(api, categoryId ? { categoryId } : undefined),
    staleTime: 300_000,
    retry: false,
  });
}

export function useFeedWilayasQuery() {
  return useQuery({
    queryKey: feedKeys().wilayas,
    queryFn: () => feedApi.listWilayas(api),
    staleTime: 300_000,
    retry: false,
  });
}

export function useFeedMunicipalitiesQuery(wilayaId: string | undefined) {
  return useQuery({
    queryKey: wilayaId ? feedKeys().municipalities(wilayaId) : feedKeys().wilayas,
    queryFn: () => feedApi.listMunicipalities(api, wilayaId as string),
    enabled: typeof wilayaId === 'string' && wilayaId.length > 0,
    staleTime: 300_000,
    retry: false,
  });
}
