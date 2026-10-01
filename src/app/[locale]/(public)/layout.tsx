import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { RequireGuest } from '@/components/guards/RequireGuest';
import { PublicFooter } from '@/components/shell/PublicFooter';
import { PublicNavbar } from '@/components/shell/PublicNavbar';

// Public layout: guest-only discovery surface (landing + opportunity/talent
// lists) with top navbar + footer. Detail pages linked from authenticated UI
// live in the (shared) group instead so both audiences keep working URLs.
export default function PublicLayout({
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
        <RequireGuest>{children}</RequireGuest>
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
