import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { PublicFooter } from '@/components/shell/PublicFooter';
import { PublicNavbar } from '@/components/shell/PublicNavbar';

// Shared layout: same public chrome as the guest-only (public) group (top
// navbar + footer, full-width sections), but WITHOUT the guest-only guard.
// These detail routes are deep-linked from authenticated UI (talent cards,
// opportunity rails, experience records), so they genuinely serve both
// audiences and must not redirect either one.
export default function SharedLayout({
  children,
  params: { locale },
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return (
    <div className="flex min-h-screen flex-col bg-surface-muted">
      <PublicNavbar />
      <main data-testid="shell-main" className="min-w-0 flex-1">
        {children}
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
