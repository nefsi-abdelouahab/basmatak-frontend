'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query/keys';
import * as tasksApi from '../lib/api/tasks';
import type {
  ActivityParams,
  ApplicationListParams,
  ParticipationListParams,
} from '../lib/api/tasks';

// F6 tasks hook file (this session's single hook file): own applications +
// own participations + volunteer activity strip + attestation download.
// Components fetch only via these hooks; keys come from the F0 factory
// (no keys.ts edits). No messaging, submission, or visibility logic lives
// here (F7/F8 own those concerns and files).

const APPLICATIONS_DOMAIN = 'volunteer-applications';
const TASKS_DOMAIN = 'volunteer-tasks';

export function useMyApplicationsQuery(params: ApplicationListParams, enabled = true) {
  const { status, from, to, cursor, limit } = params;
  return useQuery({
    queryKey: queryKeys.list(APPLICATIONS_DOMAIN, { status, from, to, cursor, limit }),
    queryFn: () => tasksApi.listMyApplications(api, params),
    staleTime: 30_000,
    retry: false,
    enabled,
  });
}

export function useApplicationQuery(applicationId: string | null) {
  return useQuery({
    queryKey: queryKeys.detail(APPLICATIONS_DOMAIN, applicationId ?? 'none'),
    queryFn: () => tasksApi.getApplication(api, applicationId as string),
    enabled: applicationId !== null,
    staleTime: 30_000,
    retry: false,
  });
}

export function useWithdrawApplicationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (applicationId: string) => tasksApi.withdrawApplication(api, applicationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(APPLICATIONS_DOMAIN) });
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(TASKS_DOMAIN) });
    },
  });
}

export function useMyParticipationsQuery(params: ParticipationListParams, enabled = true) {
  const { status, cursor, limit } = params;
  return useQuery({
    queryKey: queryKeys.list(TASKS_DOMAIN, { status, cursor, limit }),
    queryFn: () => tasksApi.listMyParticipations(api, params),
    staleTime: 30_000,
    retry: false,
    enabled,
  });
}

export function useParticipationQuery(participationId: string | null) {
  return useQuery({
    queryKey: queryKeys.detail(TASKS_DOMAIN, participationId ?? 'none'),
    queryFn: () => tasksApi.getParticipation(api, participationId as string),
    enabled: participationId !== null,
    staleTime: 30_000,
    retry: false,
  });
}

export function useWithdrawParticipationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (participationId: string) =>
      tasksApi.withdrawParticipation(api, participationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(TASKS_DOMAIN) });
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(APPLICATIONS_DOMAIN) });
    },
  });
}

export function useVolunteerActivityQuery(params?: ActivityParams) {
  return useQuery({
    queryKey: queryKeys.activity('volunteer-tasks'),
    queryFn: () => tasksApi.getVolunteerActivity(api, params),
    staleTime: 30_000,
    retry: false,
  });
}

// Attestation streams via the shared F0 blob helper (save, never
// navigation). Renders only where an experienceId is present.
export function useDownloadAttestationMutation() {
  return useMutation({
    mutationFn: (experienceId: string) => tasksApi.downloadAttestation(api, experienceId),
  });
}
