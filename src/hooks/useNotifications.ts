'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query/keys';
import * as notificationsApi from '../lib/api/notifications';

// Notifications hook file: bell badge + dropdown reads. Wires the real
// per-user endpoints (base `/api/v1`, verified read-only against
// backend/src/notifications/notifications.controller.ts):
// - GET /notifications/unread-count → `{ count }` (badge)
// - GET /notifications (`limit`/`cursor`) → CursorPage, newest first
// - PATCH /notifications/:notificationId/read (per-row)
// - POST /notifications/read-all → `{ updated }`
// Rows carry `{ type, isRead, readAt?, createdAt }` only — surfaces render
// the real type + date, never invented titles. Failures surface inline
// (role=alert); the global toast confirms each read action.

const DOMAIN = 'notifications';

export function notificationKeys() {
  return {
    unreadCount: queryKeys.detail(DOMAIN, 'unread-count'),
    list: (limit: number) => queryKeys.list(DOMAIN, { scope: 'list', limit }),
  };
}

function invalidateNotifications(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
}

export function useUnreadCountQuery(enabled = true) {
  return useQuery({
    queryKey: notificationKeys().unreadCount,
    queryFn: () => notificationsApi.getUnreadCount(api),
    staleTime: 30_000,
    retry: false,
    enabled,
  });
}

export function useNotificationsQuery(limit = 10, enabled = true) {
  return useQuery({
    queryKey: notificationKeys().list(limit),
    queryFn: () => notificationsApi.listNotifications(api, { limit }),
    staleTime: 30_000,
    retry: false,
    enabled,
  });
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.notificationRead', silent: true },
    mutationFn: (notificationId: string) =>
      notificationsApi.markNotificationRead(api, notificationId),
    onSuccess: () => invalidateNotifications(queryClient),
  });
}

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.allNotificationsRead', silent: true },
    mutationFn: () => notificationsApi.markAllNotificationsRead(api),
    onSuccess: () => invalidateNotifications(queryClient),
  });
}
