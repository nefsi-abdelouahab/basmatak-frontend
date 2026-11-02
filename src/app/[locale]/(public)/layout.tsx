import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { RequireGuest } from '@/components/guards/RequireGuest';
import { PublicFooter } from '@/components/shell/PublicFooter';
import { PublicNavbar } from '@/components/shell/PublicNavbar';

// Public layout: guest-only discovery surface (landing + opportunity/talent
// lists) with top navbar + footer. Detail pages linked from authenticated UI
// live in the (shared) group instead so both audiences keep working URLs.
//
// The guest-only guard wraps the WHOLE chrome (navbar + content + footer),
// not just the page body: an authenticated visit must never render the public
// navbar/footer at all — it bounces to the role counterpart instead. Gating
// only the children would still flash guest chrome for authed sessions.
export default function PublicLayout({
  children,
  params: { locale },
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <RequireGuest>
        <PublicNavbar />
        <main data-testid="shell-main" className="min-w-0 flex-1">
          {children}
        </main>
        <PublicFooter locale={locale} />
      </RequireGuest>
    </div>
  );
}
