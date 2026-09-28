import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { PublicFooter } from '@/components/shell/PublicFooter';
import { PublicNavbar } from '@/components/shell/PublicNavbar';

// Auth pages are unauthenticated, so they share the public chrome
// (top navbar + footer) instead of the authenticated 3-column shell.
export default function AuthLayout({
  children,
  params: { locale },
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <PublicNavbar />
      <main data-testid="shell-main" className="min-w-0 flex-1">
        {children}
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
