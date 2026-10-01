'use client';

import { useTranslations } from 'next-intl';
import { Loader } from '@/components/ui/Loader';
import { NOTIFICATION_PREF_KEYS, type NotificationPrefKey } from '@/lib/api/notifications';
import {
  useNotificationPreferencesQuery,
  usePatchNotificationPreferencesMutation,
} from '@/hooks/useAccountSettings';
import { SectionError, Toggle } from '../components';
import { SettingsCard } from './settings-ui';

// All six prefs default ON (backend lazily creates defaults on first read).
export function NotificationsSection() {
  const t = useTranslations('volunteerAccount');
  const prefsQuery = useNotificationPreferencesQuery();
  const patch = usePatchNotificationPreferencesMutation();

  if (prefsQuery.isPending) {
    return (
      <SettingsCard id="section-notifications" title={t('settings.notificationsTitle')}>
        <Loader label={t('shared.loading')} />
      </SettingsCard>
    );
  }
  if (prefsQuery.isError || !prefsQuery.data) {
    return (
      <SettingsCard id="section-notifications" title={t('settings.notificationsTitle')}>
        <SectionError testId="notifications-error" message={t('shared.loadError')} />
      </SettingsCard>
    );
  }
  const prefs = prefsQuery.data;

  async function onToggle(key: NotificationPrefKey, next: boolean) {
    try {
      await patch.mutateAsync({ ...prefs, [key]: next });
    } catch {
      // surfaced below via patch.isError
    }
  }

  return (
    <SettingsCard
      id="section-notifications"
      title={t('settings.notificationsTitle')}
      hint={t('settings.notificationsHint')}
    >
      <div data-testid="settings-notifications" className="flex flex-col gap-2">
        <ul className="flex flex-col gap-2">
          {NOTIFICATION_PREF_KEYS.map((key) => (
            <li
              key={key}
              className="flex items-center justify-between gap-4 rounded-lg p-3 transition-colors hover:bg-surface-muted"
            >
              <span className="min-w-0 text-label-md font-medium text-ink">{t(`prefs.${key}`)}</span>
              <Toggle
                checked={prefs[key] ?? true}
                onChange={(next) => onToggle(key, next)}
                label={t(`prefs.${key}`)}
                testId={`pref-${key}`}
              />
            </li>
          ))}
        </ul>
        {patch.isError ? (
          <SectionError testId="notifications-error" message={t('shared.genericError')} />
        ) : null}
      </div>
    </SettingsCard>
  );
}
