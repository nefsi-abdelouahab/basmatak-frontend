'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Languages } from 'lucide-react';
import { usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { NavIconLink } from './NavIconLink';

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations('common');
  const pathname = usePathname();
  const other = routing.locales.filter((l) => l !== locale);

  return (
    <span data-testid="language-switcher" className="flex items-center gap-2">
      <span className="sr-only">{t('language.label')}</span>
      {other.map((l) => (
        <NavIconLink
          key={l}
          href={pathname}
          locale={l}
          label={l === 'ar' ? t('language.arabic') : t('language.english')}
          icon={<Languages size={18} aria-hidden="true" />}
          className="inline-flex"
        />
      ))}
    </span>
  );
}
