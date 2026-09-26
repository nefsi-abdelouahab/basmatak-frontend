'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@/i18n/navigation';
import { api } from '../lib/api';
import { defaultTokenHooks } from '../lib/auth/storage';
import { queryKeys } from '../lib/query/keys';
import * as usersApi from '../lib/api/users';
import type { UpdateUsersMe } from '../lib/api/users';
import * as notificationsApi from '../lib/api/notifications';
import type { NotificationPrefs } from '../lib/api/notifications';
// F1-owned auth endpoints (Deviation 5): consumed import-only from
// lib/api/auth.ts — never redefined here.
import { changePassword, logoutOthers } from '../lib/api/auth';

// F2 settings hook file: email/phone re-verify, change-password UI,
// sessions list/revoke + logout-others, notification prefs, soft delete.

const DOMAIN = 'account-settings';

export function useUsersMeQuery() {
  return useQuery({
    queryKey: queryKeys.detail(DOMAIN, 'me'),
    queryFn: () => usersApi.getUsersMe(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function usePatchUsersMeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUsersMe) => usersApi.patchUsersMe(api, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
      queryClient.invalidateQueries({ queryKey: queryKeys.domain('session') });
    },
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      changePassword(api, input),
  });
}

export function useMySessionsQuery() {
  return useQuery({
    queryKey: queryKeys.list(`${DOMAIN}-sessions`),
    queryFn: () => usersApi.listMySessions(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function useDeleteMySessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => usersApi.deleteMySession(api, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
      queryClient.invalidateQueries({ queryKey: queryKeys.list(`${DOMAIN}-sessions`) });
    },
  });
}

export function useLogoutOthersMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => logoutOthers(api),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
      queryClient.invalidateQueries({ queryKey: queryKeys.list(`${DOMAIN}-sessions`) });
    },
  });
}

export function useNotificationPreferencesQuery() {
  return useQuery({
    queryKey: queryKeys.detail(DOMAIN, 'notification-preferences'),
    queryFn: () => notificationsApi.getNotificationPreferences(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function usePatchNotificationPreferencesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prefs: NotificationPrefs) =>
      notificationsApi.patchNotificationPreferences(api, prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

// Soft delete with sign-out: DELETE /users/me → clear tokens → landing.
export function useDeleteAccountMutation() {
  const router = useRouter();
  return useMutation({
    mutationFn: () => usersApi.deleteUsersMe(api),
    onSuccess: () => {
      defaultTokenHooks.clearTokens();
      router.push('/');
    },
  });
}
