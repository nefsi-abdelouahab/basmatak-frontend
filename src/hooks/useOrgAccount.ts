'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@/i18n/navigation';
import { api } from '../lib/api';
import { defaultTokenHooks } from '../lib/auth/storage';
import { queryKeys } from '../lib/query/keys';
// F1-owned auth endpoints (Deviation-5 pattern, same as F2): consumed
// import-only from lib/api/auth.ts — never redefined here.
import { changePassword, logoutOthers } from '../lib/api/auth';
import * as orgAccountApi from '../lib/api/orgAccount';
import type {
  AccountAllowedMimes,
  AccountPrefs,
  AccountUploadProgress,
  UpdateAccountUser,
  UpdateOrgAccountInput,
} from '../lib/api/orgAccount';
import { putPresignedAccountBytes } from '../lib/api/orgAccount';

// F13 hook file (the session's single hook file per CONVENTIONS.md).
// Endpoints live in lib/api/orgAccount.ts; components consume this module.
// F2's useAccountSettings.ts pattern is mirrored read-only: no import from,
// and no edit to, any sibling or archived hook file.

const DOMAIN = 'org-account';

export function orgAccountKeys() {
  return {
    me: queryKeysDetail('me'),
    completion: queryKeysDetail('completion'),
    user: queryKeysDetail('account-user'),
    sessions: queryKeysList('sessions'),
    prefs: queryKeysDetail('notification-preferences'),
    media: (mediaId: string) => queryKeysDetail(`media:${mediaId}`),
  };
}

function queryKeysDetail(scope: string) {
  return queryKeys.detail(DOMAIN, scope);
}

function queryKeysList(scope: string) {
  return queryKeys.list(DOMAIN, { scope });
}

export function useOrgAccountQuery() {
  return useQuery({
    queryKey: orgAccountKeys().me,
    queryFn: () => orgAccountApi.getOrgAccount(api),
    staleTime: 60_000,
    retry: false,
  });
}

export function useOrgAccountCompletionQuery() {
  return useQuery({
    queryKey: orgAccountKeys().completion,
    queryFn: () => orgAccountApi.getOrgAccountCompletion(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function useOrgLocationsWilayasQuery() {
  return useQuery({
    queryKey: queryKeysList('wilayas'),
    queryFn: () => orgAccountApi.listOrgLocationsWilayas(api),
    staleTime: 300_000,
    retry: false,
  });
}

export function useOrgLocationsMunicipalitiesQuery(wilayaId: string | undefined) {
  return useQuery({
    queryKey: queryKeysList(`municipalities:${wilayaId ?? 'none'}`),
    queryFn: () => orgAccountApi.listOrgLocationsMunicipalities(api, wilayaId as string),
    enabled: Boolean(wilayaId),
    staleTime: 300_000,
    retry: false,
  });
}

export function useOrgSkillCategoriesQuery() {
  return useQuery({
    queryKey: queryKeysList('skill-categories'),
    queryFn: () => orgAccountApi.listOrgSkillCategories(api),
    staleTime: 300_000,
    retry: false,
  });
}

export function usePatchOrgAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.orgProfileUpdated', silent: true },
    mutationFn: (input: UpdateOrgAccountInput) => orgAccountApi.patchOrgAccount(api, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

// Delete-org with sign-out: DELETE /organizations/me (soft-archive org +
// user, revokes sessions) → clear tokens → Login. Mirrors the F3 delete flow.
export function useDeleteOrgAccountMutation() {
  const router = useRouter();
  return useMutation({
    meta: { successKey: 'success.orgDeleted', silent: true },
    mutationFn: () => orgAccountApi.deleteOrgAccount(api),
    onSuccess: () => {
      defaultTokenHooks.clearTokens();
      router.replace('/login');
    },
  });
}

export function useAccountUserQuery() {
  return useQuery({
    queryKey: orgAccountKeys().user,
    queryFn: () => orgAccountApi.getAccountUser(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function usePatchAccountUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.profileUpdated', silent: true },
    mutationFn: (input: UpdateAccountUser) => orgAccountApi.patchAccountUser(api, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

export function useAccountChangePasswordMutation() {
  return useMutation({
    meta: { successKey: 'success.passwordChanged', silent: true },
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      changePassword(api, input),
  });
}

export function useAccountSessionsQuery() {
  return useQuery({
    queryKey: orgAccountKeys().sessions,
    queryFn: () => orgAccountApi.listAccountSessions(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function useRevokeAccountSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.sessionRevoked', silent: true },
    mutationFn: (sessionId: string) => orgAccountApi.revokeAccountSession(api, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
      queryClient.invalidateQueries({ queryKey: orgAccountKeys().sessions });
    },
  });
}

export function useLogoutOtherSessionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.otherSessionsSignedOut', silent: true },
    mutationFn: () => logoutOthers(api),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
      queryClient.invalidateQueries({ queryKey: orgAccountKeys().sessions });
    },
  });
}

export function useAccountPrefsQuery() {
  return useQuery({
    queryKey: orgAccountKeys().prefs,
    queryFn: () => orgAccountApi.getAccountPrefs(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function usePatchAccountPrefsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.notificationPrefsUpdated', silent: true },
    mutationFn: (prefs: AccountPrefs) => orgAccountApi.patchAccountPrefs(api, prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

// Owning-org media read (cover/logo/report preview + report link).
// Real-or-absent: null/failed reads render the neutral empty state.
export function useAccountMediaQuery(mediaId: string | null | undefined) {
  return useQuery({
    queryKey: mediaId ? orgAccountKeys().media(mediaId) : queryKeysDetail('media:none'),
    queryFn: () => orgAccountApi.getAccountMedia(api, mediaId as string),
    enabled: typeof mediaId === 'string' && mediaId.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export interface OrgAccountMediaFile {
  name: string;
  type: string;
  size: number;
  blob: Blob;
}

// 2-step media upload bound to the app client with presigned PUT bytes.
export function useUploadOrgAccountMedia() {
  return async (
    file: OrgAccountMediaFile,
    opts: {
      purpose: string;
      allowed: AccountAllowedMimes;
      onProgress?: (p: AccountUploadProgress) => void;
    },
  ): Promise<string> =>
    orgAccountApi.uploadAccountMedia(
      api,
      (url, body, onProgress) =>
        putPresignedAccountBytes(url, body, file.type, file.size, onProgress),
      { name: file.name, type: file.type, size: file.size },
      file.blob,
      { purpose: opts.purpose, allowed: opts.allowed, onProgress: opts.onProgress },
    );
}
