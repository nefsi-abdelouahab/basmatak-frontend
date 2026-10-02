'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { ACCOUNT_PREF_KEYS, type AccountPrefKey } from '@/lib/api/orgAccount';
import {
  useAccountPrefsQuery,
  usePatchAccountPrefsMutation,
} from '@/hooks/useOrgAccount';
import { SectionError, Toggle } from './components';

// Notifications (code.html §3, cleaned): one row per REAL preference key
// (GET/PATCH /notifications/preferences — all six keys exist in the schema,
// all default ON). Copy is neutral: the two forbidden design sentences are
// deleted; verification describes the real submission-verification notice;
// system is the neutral platform announcements bucket.
export function NotificationsSection() {
  const t = useTranslations('orgAccount');
  const prefsQuery = useAccountPrefsQuery();
  const patch = usePatchAccountPrefsMutation();

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

  async function onToggle(key: AccountPrefKey, next: boolean) {
    try {
      await patch.mutateAsync({ ...prefs, [key]: next });
    } catch {
      // surfaced below via patch.isError
    }
  }

  return (
    <Card title={t('settings.notificationsTitle')}>
      <div data-testid="settings-notifications" className="flex flex-col gap-2">
        <p className="mb-2 text-sm text-ink-muted">{t('settings.notificationsHint')}</p>
        <ul className="flex flex-col divide-y divide-border-muted">
          {ACCOUNT_PREF_KEYS.map((key) => (
            <li key={key} className="flex items-start justify-between gap-6 py-4">
              <div className="min-w-0 flex-1 pe-4">
                <p className="text-sm font-medium text-ink">{t(`prefs.${key}`)}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{t(`prefsDesc.${key}`)}</p>
              </div>
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
