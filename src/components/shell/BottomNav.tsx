'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function BottomNav() {
  const t = useTranslations('common');

  return (
    <nav
      data-testid="shell-bottomnav"
      aria-label={t('nav.menu')}
      className="fixed inset-x-0 bottom-0 border-t border-border bg-surface lg:hidden"
    >
      <div className="flex items-center justify-around px-4 py-2">
        <Link href="/" className="rounded-md px-4 py-2 text-sm font-medium text-ink">
          {t('nav.home')}
        </Link>
      </div>
    </nav>
  );
}
