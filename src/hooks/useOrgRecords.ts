'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query/keys';
import * as orgRecordsApi from '../lib/api/orgRecords';
import type { OrgRecordsFilters, OrgReviewsParams } from '../lib/api/orgRecords';
import { downloadAttestation } from '../lib/api/tasks';

// F12 org-records hook file: verified-experiences archive list, CSV export,
// per-row attestation download, verify-link copy, org-given reviews read.
// Components fetch only via these hooks; keys come from the F0 factory (no
// keys.ts edits).
// Import-only reuse (no foreign-file edits): attestation streams through F6
// `tasks.ts` `downloadAttestation` (single function per endpoint).

const DOMAIN = 'org-records';

export function useOrgExperiencesQuery(filters: OrgRecordsFilters = {}) {
  const params = orgRecordsApi.buildOrgRecordsFilters(filters);
  return useQuery({
    queryKey: queryKeys.list(DOMAIN, params),
    queryFn: () => orgRecordsApi.listOrgExperiences(api, filters),
    staleTime: 30_000,
    retry: false,
  });
}

export function useOrgCsvExportMutation() {
  return useMutation({
    mutationFn: (filters: OrgRecordsFilters = {}) =>
      orgRecordsApi.exportOrgExperiencesCsv(api, filters),
  });
}

export function useOrgAttestationDownloadMutation() {
  return useMutation({
    mutationFn: (experienceId: string) => downloadAttestation(api, experienceId),
  });
}

export function useOrgReviewsGivenQuery(params: OrgReviewsParams = {}) {
  return useQuery({
    queryKey: queryKeys.list(`${DOMAIN}-reviews`, params as Record<string, unknown>),
    queryFn: () => orgRecordsApi.listOrgReviewsGiven(api, params),
    staleTime: 60_000,
    retry: false,
  });
}

// Copies the inline verification code + deep link; returns false when the
// clipboard is unavailable so the UI can fall back to selectable text.
export async function copyOrgVerificationLink(
  code: string,
  deepLink: string,
): Promise<boolean> {
  const text = `${code} ${deepLink}`;
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
