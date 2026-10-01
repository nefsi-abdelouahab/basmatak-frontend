import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { RequireGuest } from '@/components/guards/RequireGuest';

// Auth screens are full-screen standalone: no navbar, no footer, no site
// chrome at all. Just the neutral canvas filling the viewport; each screen
// owns its full height (AuthSplit) or centers its card (Email Verification).
//
// Guest-only enforcement lives here, once for the whole group (same session
// mechanism as the public layout): an already-authenticated visit to any auth
// screen — sign-in, create-account, forgot/reset-password, verify-email —
// bounces to the role home instead of rendering the form. Verify-email keeps
// its unverified-session exception inside RequireGuest so the
// post-login/post-register gate and token links keep working.
export default function AuthLayout({
  children,
  params: { locale },
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return (
    <div className="flex min-h-dvh flex-col bg-surface-muted">
      <main data-testid="shell-main" className="flex min-w-0 flex-1 flex-col">
        <RequireGuest>{children}</RequireGuest>
      </main>
    </div>
  );
}
