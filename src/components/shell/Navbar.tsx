'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Navbar() {
  const t = useTranslations('common');

  return (
    <header data-testid="shell-navbar" className="border-b border-border bg-surface">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold text-primary">
          {t('appName')}
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-ink hover:text-primary">
            {t('nav.home')}
          </Link>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
