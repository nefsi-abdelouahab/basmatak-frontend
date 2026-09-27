'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query/keys';
import * as orgInboxApi from '../lib/api/orgInbox';
import type {
  InboxListParams,
  SubmissionInboxParams,
} from '../lib/api/orgInbox';

// F11 hook file (the session's single hook file per CONVENTIONS.md).
// Review queues over 15 endpoints: aggregate + per-opportunity applications,
// roster + per-opportunity participants, submissions inbox + verify/reject,
// applicant public reads, verification read, owning-org evidence read. All
// list queries are independent (one slow queue never blocks the rest); every
// mutation re-reads via domain invalidation on success.

const DOMAIN = 'org-review';

// Detail keys share DOMAIN exactly (never `${DOMAIN}-suffix`): mutations
// invalidate via queryKeys.domain(DOMAIN) prefix matching, so a suffixed
// domain would silently skip detail refetch after decide actions. Ids are
// namespaced per entity to avoid cross-entity collisions.

export function useOrgApplicationsQuery(params: InboxListParams) {
  return useQuery({
    queryKey: queryKeys.list(DOMAIN, { scope: 'applications', ...params }),
    queryFn: () => orgInboxApi.listOrgApplications(api, params),
    staleTime: 30_000,
    retry: false,
  });
}

export function useOpportunityApplicationsQuery(
  opportunityId: string | undefined,
  params: Omit<InboxListParams, 'opportunityId'>,
) {
  return useQuery({
    // NOTE: the disabled key must NOT collide with any list key (a shared
    // key would leak a list payload into `detail.data`).
    queryKey: opportunityId
      ? queryKeys.list(DOMAIN, { scope: 'opp-applications', opportunityId, ...params })
      : queryKeys.list(DOMAIN, { scope: 'opp-applications-none' }),
    queryFn: () =>
      orgInboxApi.listOpportunityApplications(api, opportunityId as string, params),
    enabled: typeof opportunityId === 'string' && opportunityId.length > 0,
    staleTime: 30_000,
    retry: false,
  });
}

export function useOrgApplicationQuery(applicationId: string | undefined) {
  return useQuery({
    queryKey: applicationId
      ? queryKeys.detail(DOMAIN, `application:${applicationId}`)
      : queryKeys.detail(DOMAIN, 'none'),
    queryFn: () => orgInboxApi.getOrgApplication(api, applicationId as string),
    enabled: typeof applicationId === 'string' && applicationId.length > 0,
    staleTime: 30_000,
    retry: false,
  });
}

export function useApplicantProfileQuery(username: string | undefined) {
  return useQuery({
    queryKey: username
      ? queryKeys.detail(DOMAIN, `applicant:${username}`)
      : queryKeys.detail(DOMAIN, 'none'),
    queryFn: () => orgInboxApi.getApplicantProfile(api, username as string),
    enabled: typeof username === 'string' && username.length > 0,
    staleTime: 300_000,
    retry: false,
  });
}

export function useStartReviewApplicationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId }: { applicationId: string }) =>
      orgInboxApi.startReviewApplication(api, applicationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

export function useAcceptApplicationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId }: { applicationId: string }) =>
      orgInboxApi.acceptApplication(api, applicationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

export function useRejectApplicationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      applicationId,
      reason,
    }: {
      applicationId: string;
      reason: string;
    }) => orgInboxApi.rejectApplication(api, applicationId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

export function useOrgParticipantsQuery(params: InboxListParams) {
  return useQuery({
    queryKey: queryKeys.list(DOMAIN, { scope: 'participants', ...params }),
    queryFn: () => orgInboxApi.listOrgParticipants(api, params),
    staleTime: 30_000,
    retry: false,
  });
}

export function useOpportunityParticipantsQuery(
  opportunityId: string | undefined,
  params: Omit<InboxListParams, 'opportunityId'>,
) {
  return useQuery({
    queryKey: opportunityId
      ? queryKeys.list(DOMAIN, { scope: 'opp-participants', opportunityId, ...params })
      : queryKeys.list(DOMAIN, { scope: 'opp-participants-none' }),
    queryFn: () =>
      orgInboxApi.listOpportunityParticipants(api, opportunityId as string, params),
    enabled: typeof opportunityId === 'string' && opportunityId.length > 0,
    staleTime: 30_000,
    retry: false,
  });
}

export function useRemoveParticipationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      participationId,
      reason,
    }: {
      participationId: string;
      reason: string;
    }) => orgInboxApi.removeParticipation(api, participationId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

export function useOrgSubmissionsQuery(params: SubmissionInboxParams) {
  return useQuery({
    queryKey: queryKeys.list(DOMAIN, { scope: 'submissions', ...params }),
    queryFn: () => orgInboxApi.listOrgSubmissions(api, params),
    staleTime: 30_000,
    retry: false,
  });
}

export function useOrgSubmissionQuery(submissionId: string | undefined) {
  return useQuery({
    queryKey: submissionId
      ? queryKeys.detail(DOMAIN, `submission:${submissionId}`)
      : queryKeys.detail(DOMAIN, 'none'),
    queryFn: () => orgInboxApi.getOrgSubmission(api, submissionId as string),
    enabled: typeof submissionId === 'string' && submissionId.length > 0,
    staleTime: 30_000,
    retry: false,
  });
}

export function useVerificationQuery(verificationId: string | undefined) {
  return useQuery({
    queryKey: verificationId
      ? queryKeys.detail(DOMAIN, `verification:${verificationId}`)
      : queryKeys.detail(DOMAIN, 'none'),
    queryFn: () => orgInboxApi.getVerification(api, verificationId as string),
    enabled: typeof verificationId === 'string' && verificationId.length > 0,
    staleTime: 300_000,
    retry: false,
  });
}

export function useEvidenceMediaQuery(mediaId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.detail(DOMAIN, `evidence:${mediaId ?? 'none'}`),
    queryFn: () => orgInboxApi.getEvidenceMedia(api, mediaId as string),
    enabled: typeof mediaId === 'string' && mediaId.length > 0,
    staleTime: 300_000,
    retry: false,
  });
}

export function useStartReviewSubmissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId }: { submissionId: string }) =>
      orgInboxApi.startReviewSubmission(api, submissionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

export function useVerifySubmissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId }: { submissionId: string }) =>
      orgInboxApi.verifySubmission(api, submissionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

export function useRejectSubmissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      submissionId,
      reason,
    }: {
      submissionId: string;
      reason: string;
    }) => orgInboxApi.rejectSubmission(api, submissionId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}
