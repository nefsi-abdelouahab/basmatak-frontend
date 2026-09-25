'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getMe } from '../lib/api/session';
import { queryKeys } from '../lib/query/keys';

// Session hook-point for FB/F1: storage, attach, refresh, and expired-handling
// live in F0 (lib/api + lib/auth/storage); role-based redirects land in F1.
export function useSessionQuery() {
  return useQuery({
    queryKey: queryKeys.detail('session', 'me'),
    queryFn: () => getMe(api),
    staleTime: 60_000,
    retry: false,
  });
}

// Guest authed-action redirect target (decision 10: backend only ever 401s;
// the frontend redirects to sign-in). The (auth)/login route itself ships in F1.
export function getLoginHref(locale: string, next?: string): string {
  const base = `/${locale}/login`;
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}
