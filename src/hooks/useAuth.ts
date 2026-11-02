'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@/i18n/navigation';
import { api } from '../lib/api';
import { defaultTokenHooks } from '../lib/auth/storage';
import { getMe, logout, type SessionUser } from '../lib/api/session';
import { ApiError } from '../lib/api/errors';
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

export const ALREADY_AUTHENTICATED_CODE = 'ALREADY_AUTHENTICATED';

// Active-session guard (auth layer): a live session must never be silently
// replaced by a second login/register. Fast-path guests (no stored access
// token) with zero network calls so the normal sign-in/register flow is
// untouched; only when tokens exist do we confirm via GET /auth/me (which
// also honors the refresh path — an expired-but-refreshable session is still
// active and must not be overwritten).
export async function getActiveSession(): Promise<SessionUser | null> {
  if (!defaultTokenHooks.getAccessToken()) return null;
  try {
    return await getMe(api);
  } catch {
    return null;
  }
}

async function throwIfAlreadyAuthenticated(router: {
  replace: (href: string) => void;
}): Promise<void> {
  const active = await getActiveSession();
  if (active) {
    router.replace(ROLE_HOME[active.role]);
    throw new ApiError({
      statusCode: 409,
      code: ALREADY_AUTHENTICATED_CODE,
      message: 'Already signed in. Sign out first to switch accounts.',
    });
  }
}

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
    meta: { successKey: 'success.signedIn', silent: true },
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
// An already-authenticated session is bounced to its role home and the login
// POST never fires, so an Org session cannot be silently switched to a
// Volunteer (or vice versa) without signing out first.
export function useLoginRedirect() {
  const router = useRouter();
  const mutation = useLoginMutation();

  const login = async (input: LoginInput, opts?: { next?: string | null }) => {
    await throwIfAlreadyAuthenticated(router);
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
  const router = useRouter();
  return useMutation({
    meta: { successKey: 'success.accountCreated', silent: true },
    mutationFn: async (input: RegisterInput) => {
      await throwIfAlreadyAuthenticated(router);
      return authApi.registerVolunteer(api, input);
    },
    onSuccess: (tokens) => {
      storeTokens(tokens);
      queryClient.invalidateQueries({ queryKey: queryKeys.domain('session') });
    },
  });
}

export function useRegisterOrganizationMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    meta: { successKey: 'success.accountCreated', silent: true },
    mutationFn: async (input: RegisterInput) => {
      await throwIfAlreadyAuthenticated(router);
      return authApi.registerOrganization(api, input);
    },
    onSuccess: (tokens) => {
      storeTokens(tokens);
      queryClient.invalidateQueries({ queryKey: queryKeys.domain('session') });
    },
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    meta: { successKey: 'success.resetLinkSent', silent: true },
    mutationFn: (input: { email: string }) => authApi.forgotPassword(api, input),
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    meta: { successKey: 'success.passwordReset', silent: true },
    mutationFn: (input: { token: string; newPassword: string }) =>
      authApi.resetPassword(api, input),
  });
}

export function useVerifyEmailMutation() {
  return useMutation({
    meta: { successKey: 'success.emailVerified', silent: true },
    mutationFn: (input: { token: string }) => authApi.verifyEmail(api, input),
  });
}

export function useResendVerificationMutation() {
  return useMutation({
    meta: { successKey: 'success.verificationSent', silent: true },
    mutationFn: () => authApi.resendVerification(api),
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    meta: { successKey: 'success.passwordChanged', silent: true },
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(api, input),
  });
}

export function useLogoutOthersMutation() {
  return useMutation({
    meta: { successKey: 'success.otherSessionsSignedOut', silent: true },
    mutationFn: () => authApi.logoutOthers(api),
  });
}

// No UI in F1 (screen ships in F2); exposed here so settings can consume it.
export function useLogoutAllMutation() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.signedOut' },
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
    meta: { successKey: 'success.signedOut' },
    mutationFn: () => logout(api),
    onSuccess: () => {
      defaultTokenHooks.clearTokens();
      queryClient.clear();
      router.push('/login');
    },
  });
}
