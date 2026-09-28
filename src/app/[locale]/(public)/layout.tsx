import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { PublicFooter } from '@/components/shell/PublicFooter';
import { PublicNavbar } from '@/components/shell/PublicNavbar';

// Public layout: top navbar + footer, full-width sections. No sidebar,
// no bottom nav — those belong to the authenticated shell only.
export default function PublicLayout({
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
