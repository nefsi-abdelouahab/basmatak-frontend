'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { Pill } from '@/components/ui/Pill';
import { sessionDeviceLabel } from '@/lib/api/orgAccount';
import {
  useAccountSessionsQuery,
  useLogoutOtherSessionsMutation,
  useRevokeAccountSessionMutation,
} from '@/hooks/useOrgAccount';
import { SectionError } from './components';

export function SessionsSection() {
  const t = useTranslations('orgAccount');
  const sessionsQuery = useAccountSessionsQuery();
  const revoke = useRevokeAccountSessionMutation();
  const logoutOthers = useLogoutOtherSessionsMutation();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  async function onRevoke(id: string) {
    try {
      await revoke.mutateAsync(id);
    } catch {
      // surfaced below via revoke.isError
    }
  }

  async function onLogoutOthers() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setDone(false);
    try {
      await logoutOthers.mutateAsync();
      setDone(true);
    } catch {
      // surfaced below via logoutOthers.isError
    }
  }

  return (
    <Card title={t('settings.sessionsTitle')}>
      <div data-testid="settings-sessions" className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">{t('settings.sessionsHint')}</p>
        {sessionsQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {sessionsQuery.isError ? (
          <SectionError testId="sessions-error" message={t('shared.loadError')} />
        ) : null}
        {(sessionsQuery.data ?? []).length === 0 && !sessionsQuery.isPending ? (
          <p data-testid="sessions-empty" className="text-sm text-ink-muted">
            {t('settings.sessionsEmpty')}
          </p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {(sessionsQuery.data ?? []).map((s) => (
            <li
              key={s.id}
              data-testid="session-row"
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
            >
              <span className="flex flex-wrap items-center gap-2 text-sm text-ink">
                <span>{sessionDeviceLabel(s)}</span>
                {s.isCurrent ? (
                  <span data-testid="this-device-badge">
                    <Pill tone="success">{t('settings.thisDevice')}</Pill>
                  </span>
                ) : null}
              </span>
              {!s.isCurrent ? (
                <button
                  type="button"
                  onClick={() => onRevoke(s.id)}
                  disabled={revoke.isPending}
                  className="text-sm font-medium text-status-error disabled:opacity-50"
                >
                  {t('settings.revoke')}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {revoke.isError || logoutOthers.isError ? (
          <SectionError testId="sessions-error" message={t('shared.genericError')} />
        ) : null}
        {done ? (
          <p data-testid="logout-others-done" className="text-sm text-status-success">
            {t('settings.loggedOutOthers')}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink-muted">{t('settings.logoutOthersHint')}</p>
          {confirming ? (
            <p data-testid="logout-others-confirm" className="text-sm font-medium text-ink">
              {t('settings.logoutOthersConfirm')}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onLogoutOthers}
              disabled={logoutOthers.isPending}
            >
              {confirming ? t('shared.confirm') : t('settings.logoutOthers')}
            </Button>
            {confirming ? (
              <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                {t('shared.cancel')}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
