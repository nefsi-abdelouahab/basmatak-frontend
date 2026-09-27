'use client';

import { useTranslations } from 'next-intl';
import { FactsheetSection } from './FactsheetSection';
import { RequireOrg } from './components';

export function OrgProfilePage({ locale }: { locale: string }) {
  const t = useTranslations('orgAccount');
  return (
    <RequireOrg locale={locale} next={`/${locale}/org/profile`}>
      <div data-testid="org-profile" className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('profile.title')}</h1>
          <p className="text-sm text-ink-muted">{t('profile.subtitle')}</p>
        </div>
        <FactsheetSection />
      </div>
    </RequireOrg>
  );
}
