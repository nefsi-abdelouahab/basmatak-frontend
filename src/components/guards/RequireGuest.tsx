'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Loader } from '@/components/ui/Loader';
import { useSessionQuery } from '@/hooks/useSession';
import { ROLE_HOME, type AuthRole } from '@/hooks/useAuth';

// Route-separation contract (single guest-only guard; no second auth system):
// - Guest-only routes (public landing + discovery lists, auth screens) render
//   for logged-out visitors. An authenticated session redirects to the role's
//   authenticated counterpart instead of rendering.
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

export function RequireGuest({ children }: { children: ReactNode }) {
  const t = useTranslations('common');
  const session = useSessionQuery();
  const router = useRouter();
  const pathname = usePathname();

  // Bounce only when the visitor ARRIVED authenticated (direct URL entry,
  // refresh, or client-side navigation with a live session). A guest who
  // signs in or registers DURING the visit must keep the flow's own
  // navigation (role/status routing in useLoginRedirect) — redirecting on
  // the transition would race it and strand users on the wrong page.
  const [arrivedAuthed, setArrivedAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    if (!session.isPending && arrivedAuthed === null) {
      setArrivedAuthed(!session.isError && !!session.data);
    }
  }, [session.isPending, session.isError, session.data, arrivedAuthed]);
  const target =
    arrivedAuthed === true && !session.isError && session.data
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
