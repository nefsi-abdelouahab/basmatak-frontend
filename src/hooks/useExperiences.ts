'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query/keys';
import * as experiencesApi from '../lib/api/experiences';
import type { ExperienceFilters } from '../lib/api/experiences';
import * as tasksApi from '../lib/api/tasks';
import * as volunteersApi from '../lib/api/volunteers';

// F8 experiences hook file: own enriched experience list + detail, category /
// skill / date filters, visibility toggles, attestation download, own reviews
// read, verify-link copy. Components fetch only via these hooks; keys come
// from the F0 factory (no keys.ts edits).
// Import-only reuse (no foreign-file edits): attestation streams through
// F6 `tasks.ts` `downloadAttestation` (single function per endpoint);
// skill/category lookups call F2 `volunteers.ts` typed functions.

const DOMAIN = 'volunteer-experiences';

export function useMyExperiencesQuery(filters: ExperienceFilters = {}) {
  const params = experiencesApi.buildExperienceFilters(filters);
  return useQuery({
    queryKey: queryKeys.list(DOMAIN, params),
    queryFn: () => experiencesApi.listMyExperiences(api, filters),
    staleTime: 30_000,
    retry: false,
  });
}

export function useExperienceDetailQuery(experienceId: string | null) {
  return useQuery({
    queryKey: queryKeys.detail(DOMAIN, experienceId ?? 'none'),
    queryFn: () =>
      experienceId
        ? experiencesApi.getExperienceDetail(api, experienceId)
        : Promise.resolve(null),
    staleTime: 30_000,
    retry: false,
    enabled: experienceId !== null,
  });
}

export function usePatchExperienceVisibilityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: (variables: { publicVisibility: 'public' | 'private' }) => variables.publicVisibility === 'public' ? 'success.experiencePublic' : 'success.experiencePrivate' },
    mutationFn: ({
      experienceId,
      publicVisibility,
    }: {
      experienceId: string;
      publicVisibility: 'public' | 'private';
    }) => experiencesApi.patchExperienceVisibility(api, experienceId, publicVisibility),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

export function useAttestationDownloadMutation() {
  return useMutation({
    meta: { successKey: 'success.attestationDownloaded', silent: true },
    mutationFn: (experienceId: string) => tasksApi.downloadAttestation(api, experienceId),
  });
}

export function useMyReviewsQuery() {
  return useQuery({
    queryKey: queryKeys.list(`${DOMAIN}-reviews`),
    queryFn: () => experiencesApi.listMyReviews(api),
    staleTime: 60_000,
    retry: false,
  });
}

export function useFilterSkillCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.list('skill-categories'),
    queryFn: () => volunteersApi.listSkillCategories(api),
    staleTime: 300_000,
    retry: false,
  });
}

export function useFilterSkillsQuery(categoryId?: string) {
  return useQuery({
    queryKey: queryKeys.list('skills', categoryId ? { categoryId } : undefined),
    queryFn: () => volunteersApi.listSkills(api, categoryId ? { categoryId } : undefined),
    staleTime: 300_000,
    retry: false,
  });
}

// Copies the inline verification code + deep link; returns false when the
// clipboard is unavailable so the UI can fall back to selectable text.
export async function copyVerificationLink(code: string, deepLink: string): Promise<boolean> {
  const text = `${code} ${deepLink}`;
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
