'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query/keys';
import * as adminListsApi from '../lib/api/adminLists';
import type {
  AdminOpportunitiesFilters,
  AdminOrganizationsFilters,
  AdminStatusChange,
  AdminVerificationsFilters,
  AdminVolunteersFilters,
} from '../lib/api/adminLists';

// F15 admin-manage hook file: the four admin tables (volunteers,
// organizations, verifications, opportunities) with CSV exports,
// detail-gated reads (experiences, latest dossier, histories, user), and
// status/assign/approve/reject/notice mutations. Components fetch only via
// these hooks; keys come from the F0 factory (no keys.ts edits).

const DOMAIN = 'admin-manage';

export function useAdminVolunteersQuery(filters: AdminVolunteersFilters = {}) {
  const params = adminListsApi.buildAdminListQuery(filters);
  return useQuery({
    queryKey: queryKeys.list(`${DOMAIN}-volunteers`, params),
    queryFn: () => adminListsApi.listAdminVolunteers(api, filters),
    staleTime: 30_000,
    retry: false,
  });
}

export function useAdminVolunteersCsvMutation() {
  return useMutation({
    mutationFn: (filters: AdminVolunteersFilters = {}) =>
      adminListsApi.exportAdminVolunteersCsv(api, filters),
  });
}

export function useAdminVolunteerExperiencesQuery(volunteerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.detail(`${DOMAIN}-volunteer-experiences`, volunteerId ?? 'none'),
    queryFn: () =>
      adminListsApi.getAdminVolunteerExperiences(api, volunteerId as string),
    enabled: typeof volunteerId === 'string' && volunteerId !== '',
    staleTime: 30_000,
    retry: false,
  });
}

export function useAdminUserQuery(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.detail(`${DOMAIN}-user`, userId ?? 'none'),
    queryFn: () => adminListsApi.getAdminUser(api, userId as string),
    enabled: typeof userId === 'string' && userId !== '',
    staleTime: 30_000,
    retry: false,
  });
}

export function useAdminUserStatusMutation() {
  return useMutation({
    mutationFn: ({ userId, change }: { userId: string; change: AdminStatusChange }) =>
      adminListsApi.setAdminUserStatus(api, userId, change),
  });
}

export function useAdminNoticeMutation() {
  return useMutation({
    mutationFn: ({ userId, message }: { userId: string; message: string }) =>
      adminListsApi.sendAdminNotice(api, userId, message),
  });
}

export function useAdminOrganizationsQuery(filters: AdminOrganizationsFilters = {}) {
  const params = adminListsApi.buildAdminListQuery(filters);
  return useQuery({
    queryKey: queryKeys.list(`${DOMAIN}-organizations`, params),
    queryFn: () => adminListsApi.listAdminOrganizations(api, filters),
    staleTime: 30_000,
    retry: false,
  });
}

export function useAdminOrganizationsCsvMutation() {
  return useMutation({
    mutationFn: (filters: AdminOrganizationsFilters = {}) =>
      adminListsApi.exportAdminOrganizationsCsv(api, filters),
  });
}

export function useAdminOrganizationStatusMutation() {
  return useMutation({
    mutationFn: ({
      organizationId,
      change,
    }: {
      organizationId: string;
      change: AdminStatusChange;
    }) => adminListsApi.setAdminOrganizationStatus(api, organizationId, change),
  });
}

export function useAdminVerificationsQuery(filters: AdminVerificationsFilters = {}) {
  const params = adminListsApi.buildAdminListQuery({
    status: filters.status ?? 'pending',
    assignedAdminId: filters.assignedAdminId,
    cursor: filters.cursor,
    limit: filters.limit,
  });
  return useQuery({
    queryKey: queryKeys.list(`${DOMAIN}-verifications`, params),
    queryFn: () => adminListsApi.listAdminVerifications(api, filters),
    staleTime: 30_000,
    retry: false,
  });
}

export function useAdminVerificationAssignMutation() {
  return useMutation({
    mutationFn: ({
      rowId,
      assignedAdminId,
    }: {
      rowId: string;
      assignedAdminId: string;
    }) => adminListsApi.assignAdminVerification(api, rowId, assignedAdminId),
  });
}

export function useAdminLatestDossierQuery(organizationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.detail(`${DOMAIN}-latest-dossier`, organizationId ?? 'none'),
    queryFn: () => adminListsApi.getAdminLatestDossier(api, organizationId as string),
    enabled: typeof organizationId === 'string' && organizationId !== '',
    staleTime: 30_000,
    retry: false,
  });
}

export function useAdminVerificationApproveMutation() {
  return useMutation({
    mutationFn: (organizationId: string) =>
      adminListsApi.approveAdminVerification(api, organizationId),
  });
}

export function useAdminVerificationRejectMutation() {
  return useMutation({
    mutationFn: ({
      organizationId,
      rejectionReason,
    }: {
      organizationId: string;
      rejectionReason: string;
    }) => adminListsApi.rejectAdminVerification(api, organizationId, rejectionReason),
  });
}

export function useAdminDossierMediaQuery(mediaId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.detail(`${DOMAIN}-dossier-media`, mediaId ?? 'none'),
    queryFn: () => adminListsApi.getDossierMedia(api, mediaId as string),
    enabled: typeof mediaId === 'string' && mediaId !== '',
    staleTime: 60_000,
    retry: false,
  });
}

export function useAdminOpportunitiesQuery(filters: AdminOpportunitiesFilters = {}) {
  const params = adminListsApi.buildAdminListQuery(filters);
  return useQuery({
    queryKey: queryKeys.list(`${DOMAIN}-opportunities`, params),
    queryFn: () => adminListsApi.listAdminOpportunities(api, filters),
    staleTime: 30_000,
    retry: false,
  });
}

export function useAdminOpportunitiesCsvMutation() {
  return useMutation({
    mutationFn: (filters: AdminOpportunitiesFilters = {}) =>
      adminListsApi.exportAdminOpportunitiesCsv(api, filters),
  });
}

export function useAdminOpportunityStatusMutation() {
  return useMutation({
    mutationFn: ({
      opportunityId,
      change,
    }: {
      opportunityId: string;
      change: AdminStatusChange;
    }) => adminListsApi.setAdminOpportunityStatus(api, opportunityId, change),
  });
}

export function useAdminStatusHistoriesQuery(
  entityType: string | undefined,
  entityId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.list(`${DOMAIN}-histories`, {
      entityType,
      entityId,
    }),
    queryFn: () =>
      adminListsApi.getAdminStatusHistories(
        api,
        entityType as string,
        entityId as string,
      ),
    enabled:
      typeof entityType === 'string' &&
      entityType !== '' &&
      typeof entityId === 'string' &&
      entityId !== '',
    staleTime: 30_000,
    retry: false,
  });
}
