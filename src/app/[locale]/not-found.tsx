import { getLocale } from 'next-intl/server';
import { PublicFooter } from '@/components/shell/PublicFooter';
import { PublicNavbar } from '@/components/shell/PublicNavbar';
import { NotFoundScreen } from '@/components/system/NotFoundScreen';

// Unmatched routes render the locale 404 inside the public chrome
// (top navbar + footer), never inside the authenticated shell.
export default async function LocaleNotFound() {
  const locale = await getLocale();
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <PublicNavbar />
      <main data-testid="shell-main" className="min-w-0 flex-1">
        <NotFoundScreen />
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
