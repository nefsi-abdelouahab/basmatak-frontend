'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations('common');
  const pathname = usePathname();
  const other = routing.locales.filter((l) => l !== locale);

  return (
    <span data-testid="language-switcher" className="flex items-center gap-2">
      <span className="sr-only">{t('language.label')}</span>
      {other.map((l) => (
        <Link key={l} href={pathname} locale={l} className="text-sm text-ink-muted hover:text-primary">
          {l === 'ar' ? t('language.arabic') : t('language.english')}
        </Link>
      ))}
    </span>
  );
}
