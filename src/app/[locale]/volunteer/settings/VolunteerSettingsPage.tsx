'use client';

import { useTranslations } from 'next-intl';
import { RequireVolunteer } from '../components';
import { ContactSection } from './ContactSection';
import { PasswordSection } from './PasswordSection';
import { SessionsSection } from './SessionsSection';
import { NotificationsSection } from './NotificationsSection';
import { DangerSection } from './DangerSection';

export function VolunteerSettingsPage({ locale }: { locale: string }) {
  const t = useTranslations('volunteerAccount');
  return (
    <RequireVolunteer locale={locale} next={`/${locale}/volunteer/settings`}>
      <div data-testid="volunteer-settings" className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('settings.title')}</h1>
          <p className="text-sm text-ink-muted">{t('settings.subtitle')}</p>
        </div>
        <ContactSection />
        <PasswordSection />
        <SessionsSection />
        <NotificationsSection />
        <DangerSection />
      </div>
    </RequireVolunteer>
  );
}
