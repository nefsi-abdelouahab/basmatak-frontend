'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { Pill } from '@/components/ui/Pill';
import { deviceLabel } from '@/lib/api/users';
import {
  useDeleteMySessionMutation,
  useLogoutOthersMutation,
  useMySessionsQuery,
} from '@/hooks/useAccountSettings';
import { SectionError } from '../components';

export function SessionsSection() {
  const t = useTranslations('volunteerAccount');
  const sessionsQuery = useMySessionsQuery();
  const revoke = useDeleteMySessionMutation();
  const logoutOthers = useLogoutOthersMutation();
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
    <div data-testid="settings-sessions" className="flex flex-col gap-3 rounded-lg bg-surface-muted p-3.5">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="inline-flex items-center gap-2 text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
          <Smartphone size={14} aria-hidden="true" className="shrink-0" />
          {t('settings.sessionsTitle')}
        </span>
        <span className="text-body-sm text-ink-muted">{t('settings.sessionsHint')}</span>
      </div>
      {sessionsQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
      {sessionsQuery.isError ? (
        <SectionError testId="sessions-error" message={t('shared.loadError')} />
      ) : null}
      {(sessionsQuery.data ?? []).length === 0 && !sessionsQuery.isPending ? (
        <p data-testid="sessions-empty" className="text-body-sm text-ink-muted">
          {t('settings.sessionsEmpty')}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {(sessionsQuery.data ?? []).map((s) => (
          <li
            key={s.id}
            data-testid="session-row"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2"
          >
            <span className="flex min-w-0 flex-wrap items-center gap-2 break-words text-body-sm text-ink">
              <span>{deviceLabel(s)}</span>
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
                className="text-label-sm font-medium text-status-error disabled:opacity-50"
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
        <p data-testid="logout-others-done" className="text-body-sm text-status-success">
          {t('settings.loggedOutOthers')}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-3 py-2">
        <p className="text-body-sm text-ink-muted">{t('settings.logoutOthersHint')}</p>
        {confirming ? (
          <p data-testid="logout-others-confirm" className="text-body-sm font-medium text-ink">
            {t('settings.logoutOthersConfirm')}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onLogoutOthers}
            disabled={logoutOthers.isPending}
          >
            {confirming ? t('shared.confirm') : t('settings.logoutOthers')}
          </Button>
          {confirming ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              {t('shared.cancel')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
