'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getSystemStatus } from '../lib/api/system';
import { queryKeys } from '../lib/query/keys';
import * as adminModerationApi from '../lib/api/adminModeration';
import type {
  AdminReportFilters,
  ResolveReportInput,
  StatusHistoryQuery,
} from '../lib/api/adminModeration';

// F16 admin-moderation hook file: report triage list + CSV export, assign,
// atomic resolve-with-action (consequence asserted via re-read by the
// caller — the mutation echo is never trusted alone), standalone notice,
// review-hide, status-history reads, settings table, per-key edits,
// maintenance toggle with system-status re-read.
// Components fetch only via these hooks; keys come from the F0 factory (no
// keys.ts edits). System-status reads reuse F0 `system.ts` `getSystemStatus`
// (import-only, never redefined).

const DOMAIN = 'admin-moderation';
const SETTINGS_DOMAIN = 'admin-moderation-settings';

export function useAdminReportsQuery(filters: AdminReportFilters = {}, options?: { enabled?: boolean }) {
  const params = adminModerationApi.buildReportListParams(filters);
  return useQuery({
    queryKey: queryKeys.list(DOMAIN, params),
    queryFn: () => adminModerationApi.listAdminReports(api, filters),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
    retry: false,
  });
}

export function useAdminReportsCsvExportMutation() {
  return useMutation({
    mutationFn: (filters: AdminReportFilters = {}) =>
      adminModerationApi.exportAdminReportsCsv(api, filters),
  });
}

export function useAssignAdminReportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, assignedAdminId }: { reportId: string; assignedAdminId: string }) =>
      adminModerationApi.assignAdminReport(api, reportId, { assignedAdminId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

export function useResolveAdminReportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, input }: { reportId: string; input: ResolveReportInput }) =>
      adminModerationApi.resolveAdminReport(api, reportId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

export function useSendAdminNoticeMutation() {
  return useMutation({
    mutationFn: ({ userId, message }: { userId: string; message: string }) =>
      adminModerationApi.sendAdminNotice(api, userId, { message }),
  });
}

export function useHideAdminReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => adminModerationApi.hideAdminReview(api, reviewId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

export function useStatusHistoriesQuery(query: StatusHistoryQuery | null) {
  return useQuery({
    queryKey:
      query === null
        ? queryKeys.list(`${DOMAIN}-histories`, { none: true })
        : queryKeys.list(`${DOMAIN}-histories`, {
            entityType: query.entityType,
            entityId: query.entityId,
          }),
    queryFn: () =>
      query === null
        ? Promise.resolve([])
        : adminModerationApi.readStatusHistories(api, query),
    enabled: query !== null,
    staleTime: 30_000,
    retry: false,
  });
}

export function useAdminSettingsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.list(SETTINGS_DOMAIN),
    queryFn: () => adminModerationApi.listAdminSettings(api),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
    retry: false,
  });
}

export function useUpdateAdminSettingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      adminModerationApi.updateAdminSetting(api, key, value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.domain(SETTINGS_DOMAIN) });
    },
  });
}

export function useMaintenanceToggleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { enabled: boolean; message?: string }) =>
      adminModerationApi.toggleMaintenance(api, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.domain(SETTINGS_DOMAIN) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.domain('admin-moderation-status') });
    },
  });
}

export function usePublicSystemStatusQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.domain('admin-moderation-status'),
    queryFn: () => getSystemStatus(api),
    enabled: options?.enabled ?? true,
    staleTime: 15_000,
    retry: false,
  });
}

function targetHistoryEntityOf(targetType: string): string | null {
  if (targetType === 'opportunity') return 'opportunity';
  if (targetType === 'user') return 'user';
  if (targetType === 'organization') return 'organization';
  return null;
}

export interface ResolutionConfirmation {
  reportResolved: boolean;
  reportHistoryConfirmed: boolean;
  targetHistoryConfirmed: boolean | null;
  confirmed: boolean;
}

// Consequence assertion via re-read (never the mutation echo): the report
// list is re-fetched and the row must read `resolved`; the report history
// (`entityType=reports`) must carry the `resolution` as reason; where the
// target has a history surface (opportunity/user/organization) its history
// must carry the `resolution` as reason too. History reads never throw —
// an unreadable history counts as unconfirmed, not as confirmed.
export async function confirmReportResolution(input: {
  reportId: string;
  targetType: string;
  targetId?: string;
  resolution: string;
}): Promise<ResolutionConfirmation> {
  const { reportId, targetType, targetId, resolution } = input;
  const reports = await adminModerationApi.listAdminReports(api, {});
  const row = reports.items.find((item) => adminModerationApi.reportIdOf(item) === reportId);
  const reportResolved = row?.status === 'resolved';
  const reportHistories = await adminModerationApi
    .readStatusHistories(api, { entityType: 'reports', entityId: reportId })
    .catch(() => []);
  const reportHistoryConfirmed = reportHistories.some((entry) => entry.reason === resolution);
  const historyEntity = targetHistoryEntityOf(targetType);
  let targetHistoryConfirmed: boolean | null = null;
  if (historyEntity !== null && targetId) {
    const targetHistories = await adminModerationApi
      .readStatusHistories(api, { entityType: historyEntity, entityId: targetId })
      .catch(() => []);
    targetHistoryConfirmed = targetHistories.some((entry) => entry.reason === resolution);
  }
  const confirmed =
    reportResolved === true &&
    reportHistoryConfirmed &&
    (targetHistoryConfirmed === null || targetHistoryConfirmed === true);
  return { reportResolved: reportResolved === true, reportHistoryConfirmed, targetHistoryConfirmed, confirmed };
}
