'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ApiError, errorStateFor } from '../lib/api/errors';
import { getHealth, getSystemStatus } from '../lib/api/system';
import { queryKeys } from '../lib/query/keys';
import * as adminAnalyticsApi from '../lib/api/adminAnalytics';
import { listAdminVerifications } from '../lib/api/adminLists';
import { listAdminReports } from '../lib/api/adminModeration';

// F14 admin-overview hook file (this session's single hook file per
// CONVENTIONS.md). Read-only dashboard: stats overview, analytics overview,
// UTC series, attention queue, audit strip, health, system status.
//
// Keys come from the F0 factory (no keys.ts edit). Health and system status are
// read through the F0 `system.ts` functions — the same ones F16 consumes; the
// schema is never redefined here. No mutation hook ships in this session:
// moderation actions are F16, manage-table writes are F15.

const DOMAIN = 'admin-overview';
const SYSTEM_DOMAIN = 'admin-overview-system';

const READ_STALE_MS = 30_000;
const SYSTEM_STALE_MS = 15_000;

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && errorStateFor(error) === 'forbidden';
}

export interface AdminAnalyticsGate {
  /** True only once the session has resolved to the `admin` role. */
  isAdmin: boolean;
  isResolved: boolean;
  isForbidden: boolean;
}

/**
 * Shared gate for every analytics hook. `enabled` stays false until the session
 * resolves to `admin`, so no analytics payload is requested by a non-admin, and
 * the route can render the forbidden state from `isForbidden` when an endpoint
 * answers 403 for a role that was revoked mid-session.
 */
export function useAdminAnalyticsGate(
  session: { data?: { role?: string } | undefined; isPending: boolean; isError: boolean },
  analyticsError: unknown = null,
): AdminAnalyticsGate {
  const isResolved = !session.isPending;
  const isAdmin = isResolved && !session.isError && session.data?.role === 'admin';
  return { isAdmin, isResolved, isForbidden: isForbidden(analyticsError) };
}

export function useAdminStatsOverviewQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.detail(DOMAIN, 'stats-overview'),
    queryFn: () => adminAnalyticsApi.getAdminStatsOverview(api),
    enabled,
    staleTime: READ_STALE_MS,
    retry: false,
  });
}

export function useAdminAnalyticsOverviewQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.detail(DOMAIN, 'analytics-overview'),
    queryFn: () => adminAnalyticsApi.getAdminAnalyticsOverview(api),
    enabled,
    staleTime: READ_STALE_MS,
    retry: false,
  });
}

// The `days` window is part of the key so switching windows cannot serve a stale
// chart. The value is clamped to the backend's 1-90 bound before it is used.
export function useAdminAnalyticsSeriesQuery(days: number, enabled = true) {
  const bounded = adminAnalyticsApi.clampSeriesDays(days);
  return useQuery({
    queryKey: queryKeys.detail(DOMAIN, `series-${bounded}`),
    queryFn: () => adminAnalyticsApi.getAdminAnalyticsSeries(api, bounded),
    enabled,
    staleTime: READ_STALE_MS,
    retry: false,
  });
}

export function useAdminAnalyticsQueueQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.detail(DOMAIN, 'queue'),
    queryFn: () => adminAnalyticsApi.getAdminAnalyticsQueue(api),
    enabled,
    staleTime: READ_STALE_MS,
    retry: false,
  });
}

// Item-level triage reads behind the dashboard "Requires attention" rows.
// The analytics queue endpoint carries counts only, so the rows themselves
// come from the real manage endpoints: oldest-first pending verification
// dossiers (GET /admin/organizations/verifications?status=pending) and
// newest-first open reports (GET /admin/reports?status=open). Small limits:
// the dashboard shows a preview, the manage screens own the full queues.
export function useAdminPendingVerificationsQuery(limit: number, enabled = true) {
  const bounded = Math.min(50, Math.max(1, Math.floor(limit) || 1));
  return useQuery({
    queryKey: queryKeys.list(DOMAIN, { scope: 'verification-queue', limit: bounded }),
    queryFn: () => listAdminVerifications(api, { status: 'pending', limit: bounded }),
    enabled,
    staleTime: READ_STALE_MS,
    retry: false,
  });
}

export function useAdminOpenReportsQuery(limit: number, enabled = true) {
  const bounded = Math.min(50, Math.max(1, Math.floor(limit) || 1));
  return useQuery({
    queryKey: queryKeys.list(DOMAIN, { scope: 'open-reports', limit: bounded }),
    queryFn: () =>
      listAdminReports(api, { status: 'open', sort: 'newest', limit: bounded }),
    enabled,
    staleTime: READ_STALE_MS,
    retry: false,
  });
}

export function useAdminAuditLogsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.list(DOMAIN, { scope: 'audit-strip' }),
    queryFn: () => adminAnalyticsApi.listAdminAuditLogs(api, { sort: 'newest' }),
    enabled,
    staleTime: READ_STALE_MS,
    retry: false,
  });
}

// Full audit-log browser reads (filterable, cursor-paginated). Same
// `/admin/audit-logs` endpoint as the dashboard strip, with the caller's
// filters in the query key so each filter set caches independently.
export function useAdminAuditBrowserQuery(
  filters: adminAnalyticsApi.AdminAuditFilters = {},
  enabled = true,
) {
  const params = adminAnalyticsApi.buildAuditParams(filters);
  return useQuery({
    queryKey: queryKeys.list(DOMAIN, { scope: 'audit-browser', ...params }),
    queryFn: () => adminAnalyticsApi.listAdminAuditLogs(api, filters),
    enabled,
    staleTime: READ_STALE_MS,
    retry: false,
  });
}

export function useAdminAuditLogsCsvExportMutation() {
  return useMutation({
    mutationFn: (filters: adminAnalyticsApi.AdminAuditFilters = {}) =>
      adminAnalyticsApi.exportAdminAuditLogsCsv(api, filters),
  });
}

// Health and system status are the F0 public reads (shared with F16 — import
// only). The shorter stale time keeps the maintenance flag reasonably fresh.
export function useAdminHealthQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.detail(SYSTEM_DOMAIN, 'health'),
    queryFn: () => getHealth(api),
    enabled,
    staleTime: SYSTEM_STALE_MS,
    retry: false,
  });
}

export function useAdminSystemStatusQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.detail(SYSTEM_DOMAIN, 'status'),
    queryFn: () => getSystemStatus(api),
    enabled,
    staleTime: SYSTEM_STALE_MS,
    retry: false,
  });
}
