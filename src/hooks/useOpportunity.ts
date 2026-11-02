'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query/keys';
import * as opportunityApi from '../lib/api/opportunity';
import type {
  ApplyInput,
  OpportunityDetail,
  OpportunityPosition,
  ReportOpportunityInput,
} from '../lib/api/opportunity';

// F5 opportunity hook file: detail, related-by-category, cover, own-application
// lookup (OQ1), apply/withdraw/report mutations. Components fetch only via
// these hooks; keys come from the F0 factory (no keys.ts edits).

const DOMAIN = 'opportunity';

export type ApplyGateReason = 'closed' | 'deadline' | 'full' | null;

// Pure seat/deadline gate for the Apply CTA (unit-tested; no hooks inside).
// `nowIso` defaults to the current time; tests inject a fixed clock.
export function applyGateFor(
  detail: Pick<OpportunityDetail, 'status' | 'applicationDeadline'>,
  position: Pick<OpportunityPosition, 'requiredCount' | 'filledCount'>,
  nowIso?: string,
): ApplyGateReason {
  if (detail.status !== undefined && detail.status !== 'published') return 'closed';
  if (detail.applicationDeadline) {
    const now = nowIso ? new Date(nowIso).getTime() : Date.now();
    if (Number.isFinite(now) && new Date(detail.applicationDeadline).getTime() < now) {
      return 'deadline';
    }
  }
  if (
    typeof position.requiredCount === 'number' &&
    typeof position.filledCount === 'number' &&
    position.filledCount >= position.requiredCount
  ) {
    return 'full';
  }
  return null;
}

export function useOpportunityDetailQuery(idOrSlug: string) {
  return useQuery({
    queryKey: queryKeys.detail(DOMAIN, idOrSlug),
    queryFn: () => opportunityApi.getOpportunityDetail(api, idOrSlug),
    staleTime: 30_000,
    retry: false,
  });
}

export function useRelatedOpportunitiesQuery(categoryId: string | null | undefined, currentId: string) {
  const effectiveCategoryId = categoryId ?? '';
  return useQuery({
    queryKey: queryKeys.list(`${DOMAIN}-related`, categoryId ? { categoryId } : undefined),
    queryFn: () =>
      opportunityApi.listRelatedOpportunities(api, {
        categoryId: effectiveCategoryId,
        excludeId: currentId,
      }),
    enabled: Boolean(categoryId),
    staleTime: 60_000,
    retry: false,
  });
}

export function useCoverMediaQuery(mediaId: string | null | undefined) {
  const effectiveMediaId = mediaId ?? '';
  return useQuery({
    queryKey: queryKeys.detail(`${DOMAIN}-cover`, mediaId ?? 'none'),
    queryFn: () => opportunityApi.getCoverMedia(api, effectiveMediaId),
    enabled: Boolean(mediaId),
    staleTime: 300_000,
    retry: false,
  });
}

// OQ1 lookup: enabled only for authenticated viewers with a selected position
// (guests never call it — Apply redirects them to Login instead).
export function useMyApplicationQuery(
  opportunityId: string,
  positionId: string | null,
  enabled: boolean,
) {
  const effectivePositionId = positionId ?? '';
  return useQuery({
    queryKey: queryKeys.detail(`${DOMAIN}-mine`, `${opportunityId}:${positionId ?? 'none'}`),
    queryFn: () =>
      opportunityApi.findMyApplicationForPosition(api, opportunityId, effectivePositionId),
    enabled: enabled && Boolean(positionId),
    staleTime: 30_000,
    retry: false,
  });
}

export function useApplyMutation(opportunityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.applicationSubmitted', silent: true },
    mutationFn: ({ positionId, input }: { positionId: string; input: ApplyInput }) =>
      opportunityApi.applyToPosition(api, opportunityId, positionId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

export function useWithdrawMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.applicationWithdrawn' },
    mutationFn: (applicationId: string) => opportunityApi.withdrawApplication(api, applicationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

export function useReportOpportunityMutation() {
  return useMutation({
    meta: { successKey: 'success.reportSubmitted', silent: true },
    mutationFn: (input: ReportOpportunityInput) => opportunityApi.reportOpportunity(api, input),
  });
}
