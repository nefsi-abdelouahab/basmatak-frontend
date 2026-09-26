'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { NOTIFICATION_PREF_KEYS, type NotificationPrefKey } from '@/lib/api/notifications';
import {
  useNotificationPreferencesQuery,
  usePatchNotificationPreferencesMutation,
} from '@/hooks/useAccountSettings';
import { SectionError, Toggle } from '../components';

// All six prefs default ON (backend lazily creates defaults on first read).
export function NotificationsSection() {
  const t = useTranslations('volunteerAccount');
  const prefsQuery = useNotificationPreferencesQuery();
  const patch = usePatchNotificationPreferencesMutation();

  if (prefsQuery.isPending) {
    return (
      <Card title={t('settings.notificationsTitle')}>
        <Loader label={t('shared.loading')} />
      </Card>
    );
  }
  if (prefsQuery.isError || !prefsQuery.data) {
    return (
      <Card title={t('settings.notificationsTitle')}>
        <SectionError testId="notifications-error" message={t('shared.loadError')} />
      </Card>
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
    <Card title={t('settings.notificationsTitle')}>
      <div data-testid="settings-notifications" className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{t('settings.notificationsHint')}</p>
        <ul className="flex flex-col gap-2">
          {NOTIFICATION_PREF_KEYS.map((key) => (
            <li
              key={key}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <span className="text-sm text-ink">{t(`prefs.${key}`)}</span>
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
    </Card>
  );
}
