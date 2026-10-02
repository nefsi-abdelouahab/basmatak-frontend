'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Loader } from '@/components/ui/Loader';
import { useSessionQuery } from '@/hooks/useSession';
import { ROLE_HOME, type AuthRole } from '@/hooks/useAuth';

// Route-separation contract (single guest-only guard; no second auth system):
// - Guest-only routes (public landing + discovery lists, auth screens) render
//   for logged-out visitors. ANY authenticated session redirects to the role's
//   authenticated counterpart instead of rendering — regardless of whether the
//   session was already live at mount or became live during the visit (login /
//   register in place must navigate away via its own flow; staying on a
//   guest-only route while authenticated is never allowed, otherwise an
//   active session could open /login and switch accounts without logging out).
// - Exception: /verify-email stays reachable for authenticated-but-unverified
//   sessions (the post-login/post-register `status=unverified` gate and token
//   links that complete a pending signup). Verified sessions bounce from it
//   like any other auth screen; guests always render it.
// - Shared routes (public detail pages deep-linked from authenticated UI:
//   /opportunities/:id, /volunteers/:username, /orgs/:slug) render for
//   everyone and never mount this guard.
// - Authenticated routes keep their existing Require* guards.
//
// Enforcement rides on the single session source of truth (GET /auth/me via
// useSessionQuery): nothing renders until the session resolves, so a direct
// URL entry or a refresh cannot flash the wrong content. Tokens live in
// localStorage (unreadable server-side), so this guard is client-side by
// necessity — but it gates rendering, not just chrome.

export function guestRedirectTarget(pathname: string, role: AuthRole): string {
  const normalized = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
  if (normalized === '/opportunities') {
    if (role === 'volunteer') return '/volunteer/opportunities';
    if (role === 'organization') return '/org/opportunities';
    return '/admin/opportunities';
  }
  if (normalized === '/talents') {
    if (role === 'volunteer') return '/volunteer/talents';
    return ROLE_HOME[role];
  }
  return ROLE_HOME[role];
}

// Verify-email normalization shared by the guard: locale-less pathname in,
// trailing-slash tolerant. Unverified sessions (no emailVerifiedAt) must keep
// the gate + token links; verified sessions bounce to the role home.
export function isUnverifiedVerifyEmailVisit(
  pathname: string,
  emailVerifiedAt: string | null | undefined,
): boolean {
  const normalized = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
  return normalized === '/verify-email' && !emailVerifiedAt;
}

export function RequireGuest({ children }: { children: ReactNode }) {
  const t = useTranslations('common');
  const session = useSessionQuery();
  const router = useRouter();
  const pathname = usePathname();

  // Bounce on the CURRENT session state — never a mount-time snapshot. A
  // guest who signs in during the visit is now authenticated and must leave
  // the guest-only route via redirect; the login/register flow's own
  // navigation (role/status routing in useLoginRedirect) races the same way,
  // but both targets land inside the authenticated experience, whereas a
  // snapshot that stays "guest" would let an active session linger on /login
  // and switch accounts without logging out.
  const target =
    !session.isPending &&
    !session.isError &&
    session.data &&
    !isUnverifiedVerifyEmailVisit(pathname, session.data.emailVerifiedAt)
      ? guestRedirectTarget(pathname, session.data.role)
      : null;

  // Settles once: background refetches (e.g. the session invalidation a
  // login/register mutation triggers) must NOT tear down already-resolved
  // content back to a loader — that unmounts the page and loses its state
  // (a registration success would vanish when the refetch resolves).
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!session.isPending) setSettled(true);
  }, [session.isPending]);

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (!settled) return <Loader label={t('actions.loading')} />;
  if (target) return null;
  return <>{children}</>;
}
