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
//
// LOCALE-LESS CONTRACT: every navigation API in `@/i18n/navigation`
// (next-intl `createNavigation` with `localePrefix: 'always'`) takes a
// locale-less path and adds the prefix itself, and `usePathname()` returns a
// locale-less path. So this returns `/login`, NOT `/{locale}/login`: callers
// pass the result to that router, and a pre-prefixed value produced
// `/en/en/login` (a route that does not exist). `next` is likewise the
// locale-less path the router will be given after login, so it must not carry a
// locale either. Deliberately takes no `locale` argument so the double-prefixed
// string cannot be built here at all.
export function getLoginHref(next?: string): string {
  return next ? `/login?next=${encodeURIComponent(next)}` : '/login';
}
