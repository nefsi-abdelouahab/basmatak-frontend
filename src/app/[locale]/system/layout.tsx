import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { PublicFooter } from '@/components/shell/PublicFooter';
import { PublicNavbar } from '@/components/shell/PublicNavbar';

// System states (404/403/500/maintenance/…) are unauthenticated screens,
// so they render inside the public chrome instead of the shell.
export default function SystemLayout({
  children,
  params: { locale },
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicNavbar />
      <main data-testid="shell-main" className="min-w-0 flex-1">
        {children}
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
