'use client';

import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { Loader } from '@/components/ui/Loader';
import { PUBLIC_TOGGLE_KEYS, type PublicToggleKey } from '@/lib/api/volunteers';
import { usePatchPublicSettingsMutation, useVolunteerMeQuery } from '@/hooks/useVolunteerAccount';
import { SectionError, Toggle } from '../components';
import { SettingsCard } from './settings-ui';

// Design Profile and Privacy section, wired to the real public-settings
// contract (same hooks as the profile visibility panel, reused here).
export function PrivacySection() {
  const t = useTranslations('volunteerAccount');
  const meQuery = useVolunteerMeQuery();
  const patch = usePatchPublicSettingsMutation();

  if (meQuery.isPending) {
    return (
      <SettingsCard id="section-privacy" title={t('settings.privacyTitle')}>
        <Loader label={t('shared.loading')} />
      </SettingsCard>
    );
  }
  if (meQuery.isError) {
    return (
      <SettingsCard id="section-privacy" title={t('settings.privacyTitle')}>
        <SectionError testId="settings-privacy-error" message={t('shared.loadError')} />
      </SettingsCard>
    );
  }
  const flags = meQuery.data?.publicProfile ?? {};

  async function onToggle(key: PublicToggleKey, next: boolean) {
    try {
      await patch.mutateAsync({ publicProfile: { [key]: next } });
    } catch {
      // surfaced below via patch.isError
    }
  }

  return (
    <SettingsCard
      id="section-privacy"
      title={t('settings.privacyTitle')}
      hint={t('settings.privacyHint')}
      badge={
        <span className="rounded bg-surface-muted px-2 py-0.5 text-label-xs text-ink-muted">
          {t('settings.publicAudience')}
        </span>
      }
    >
      <div data-testid="settings-privacy" className="flex flex-col gap-2">
        <ul className="flex flex-col gap-2">
          {PUBLIC_TOGGLE_KEYS.map((key) => (
            <li
              key={key}
              className="flex items-center justify-between gap-4 rounded-lg p-3 transition-colors hover:bg-surface-muted"
            >
              <span className="min-w-0 text-label-md font-medium text-ink">
                {t('profile.showPublicly', { field: t(`toggles.${key}`) })}
              </span>
              <Toggle
                checked={flags[key] ?? true}
                onChange={(next) => onToggle(key, next)}
                label={t('profile.showPublicly', { field: t(`toggles.${key}`) })}
                testId={`settings-toggle-${key}`}
              />
            </li>
          ))}
        </ul>
        <div className="flex items-start justify-between gap-4 rounded-lg bg-surface-muted p-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="inline-flex items-center gap-1.5 text-label-md font-medium text-ink">
              <Lock size={16} aria-hidden="true" className="shrink-0 text-ink-muted" />
              {t('settings.privacyLockedTitle')}
            </span>
            <span className="text-body-sm text-ink-muted">{t('settings.privacyLockedBody')}</span>
          </div>
          <span className="mt-1 shrink-0 rounded bg-primary-tint px-2 py-1 text-label-xs font-medium text-primary">
            {t('settings.privacyEnforced')}
          </span>
        </div>
        {patch.isError ? (
          <SectionError testId="settings-privacy-error" message={t('shared.genericError')} />
        ) : null}
      </div>
    </SettingsCard>
  );
}
