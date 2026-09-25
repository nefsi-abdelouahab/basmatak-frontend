'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function Sidebar() {
  const t = useTranslations('common');

  return (
    <aside
      data-testid="shell-sidebar"
      className="hidden w-64 shrink-0 border-e border-border bg-surface p-4 lg:block"
    >
      <nav aria-label={t('nav.menu')}>
        <Link
          href="/"
          className="block rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
        >
          {t('nav.home')}
        </Link>
      </nav>
    </aside>
  );
}
