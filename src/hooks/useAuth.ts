'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@/i18n/navigation';
import { api } from '../lib/api';
import { defaultTokenHooks } from '../lib/auth/storage';
import { getMe, logout, type SessionUser } from '../lib/api/session';
import { queryKeys } from '../lib/query/keys';
import * as authApi from '../lib/api/auth';
import type { LoginInput, RegisterInput } from '../lib/api/auth';

// F1 hook file (the session's single hook file per CONVENTIONS.md).
// Token storage, JWT attach, and refresh live in F0; this module only stores
// the pair on auth success and derives navigation from GET /auth/me.

export type AuthRole = SessionUser['role'];

// Approved role-default landing paths (Q1): F4/F9/F14 own these routes.
export const ROLE_HOME: Record<AuthRole, string> = {
  volunteer: '/volunteer/dashboard',
  organization: '/org/dashboard',
  admin: '/admin/dashboard',
};

export const VERIFY_EMAIL_PATH = '/verify-email';

// Decision-10 guest-continue guard: only same-origin relative paths survive;
// absolute URLs and protocol-relative URLs fall back to the role default.
export function isSafeNextPath(next: unknown): next is string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//');
}

export function resolvePostLoginTarget(role: AuthRole, next?: string | null): string {
  if (isSafeNextPath(next)) return next;
  return ROLE_HOME[role] ?? '/';
}

function storeTokens(tokens: { accessToken: string; refreshToken: string }): void {
  defaultTokenHooks.setTokens({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(api, input),
    onSuccess: (tokens) => {
      storeTokens(tokens);
      queryClient.invalidateQueries({ queryKey: queryKeys.domain('session') });
    },
  });
}

// Full sign-in flow: login → store → GET /auth/me → role redirect.
// Unverified emails land on verify-email with a resend CTA (and the original
// destination preserved as `next` when one was requested).
export function useLoginRedirect() {
  const router = useRouter();
  const mutation = useLoginMutation();

  const login = async (input: LoginInput, opts?: { next?: string | null }) => {
    await mutation.mutateAsync(input);
    const me = await getMe(api);
    if (!me.emailVerifiedAt) {
      const target =
        isSafeNextPath(opts?.next) && opts?.next
          ? `${VERIFY_EMAIL_PATH}?status=unverified&next=${encodeURIComponent(opts.next)}`
          : `${VERIFY_EMAIL_PATH}?status=unverified`;
      router.push(target);
      return target;
    }
    const target = resolvePostLoginTarget(me.role, opts?.next);
    router.push(target);
    return target;
  };

  return { ...mutation, login };
}

export function useRegisterVolunteerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.registerVolunteer(api, input),
    onSuccess: (tokens) => {
      storeTokens(tokens);
      queryClient.invalidateQueries({ queryKey: queryKeys.domain('session') });
    },
  });
}

export function useRegisterOrganizationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.registerOrganization(api, input),
    onSuccess: (tokens) => {
      storeTokens(tokens);
      queryClient.invalidateQueries({ queryKey: queryKeys.domain('session') });
    },
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: (input: { email: string }) => authApi.forgotPassword(api, input),
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: (input: { token: string; newPassword: string }) =>
      authApi.resetPassword(api, input),
  });
}

export function useVerifyEmailMutation() {
  return useMutation({
    mutationFn: (input: { token: string }) => authApi.verifyEmail(api, input),
  });
}

export function useResendVerificationMutation() {
  return useMutation({
    mutationFn: () => authApi.resendVerification(api),
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(api, input),
  });
}

export function useLogoutOthersMutation() {
  return useMutation({
    mutationFn: () => authApi.logoutOthers(api),
  });
}

// No UI in F1 (screen ships in F2); exposed here so settings can consume it.
export function useLogoutAllMutation() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logoutAll(api),
    onSuccess: () => {
      defaultTokenHooks.clearTokens();
      queryClient.clear();
      router.push('/login');
    },
  });
}

export function useLogoutMutation() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => logout(api),
    onSuccess: () => {
      defaultTokenHooks.clearTokens();
      queryClient.clear();
      router.push('/login');
    },
  });
}
