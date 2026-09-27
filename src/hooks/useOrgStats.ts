'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query/keys';
import * as orgStatsApi from '../lib/api/orgStats';

// F9 hook file (this session's single hook file per CONVENTIONS.md).
// Dashboard read-model over 8 endpoints: org facts, private aggregates,
// three inbox summaries, activity, publish-gate, notifications. All queries
// are independent (one slow endpoint never blocks the rest). Summary-only:
// no mutation lives here — opportunity CRUD is F10, review actions are F11.

const DOMAIN = 'org-workspace';

export function useMyOrganizationQuery() {
  return useQuery({
    queryKey: queryKeys.detail(DOMAIN, 'me'),
    queryFn: () => orgStatsApi.getMyOrganization(api),
    staleTime: 60_000,
    retry: false,
  });
}

export function useOrgStatsQuery() {
  return useQuery({
    queryKey: queryKeys.detail(DOMAIN, 'stats'),
    queryFn: () => orgStatsApi.getOrgStats(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function useParticipantsSummaryQuery() {
  return useQuery({
    queryKey: queryKeys.list(DOMAIN, { scope: 'participants-summary' }),
    queryFn: () => orgStatsApi.listParticipantsSummary(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function useSubmissionsSummaryQuery() {
  return useQuery({
    queryKey: queryKeys.list(DOMAIN, { scope: 'submissions-summary' }),
    queryFn: () => orgStatsApi.listSubmissionsSummary(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function useApplicationsSummaryQuery() {
  return useQuery({
    queryKey: queryKeys.list(DOMAIN, { scope: 'applications-summary' }),
    queryFn: () => orgStatsApi.listApplicationsSummary(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function useOrgActivityQuery() {
  return useQuery({
    queryKey: queryKeys.activity(DOMAIN),
    queryFn: () => orgStatsApi.getOrgActivity(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function usePublishGateQuery() {
  return useQuery({
    queryKey: queryKeys.detail(DOMAIN, 'publish-gate'),
    queryFn: () => orgStatsApi.getPublishGate(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function useNotificationsStripQuery() {
  return useQuery({
    queryKey: queryKeys.list(DOMAIN, { scope: 'notifications' }),
    queryFn: () => orgStatsApi.listNotifications(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function useOrgCoverMediaQuery(mediaId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.detail(`${DOMAIN}-cover`, mediaId ?? 'none'),
    queryFn: () => orgStatsApi.getOrgCoverMedia(api, mediaId as string),
    enabled: Boolean(mediaId),
    staleTime: 300_000,
    retry: false,
  });
}
