'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Laptop, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { Pill } from '@/components/ui/Pill';
import { sessionDeviceLabel, type AccountSession } from '@/lib/api/orgAccount';
import {
  useAccountSessionsQuery,
  useLogoutOtherSessionsMutation,
  useRevokeAccountSessionMutation,
} from '@/hooks/useOrgAccount';
import { SectionError } from './components';

// Active sessions (code.html §2): real rows from GET /users/me/sessions —
// device metadata + derived isCurrent only. The backend captures no
// geo/IP, so no location lines are rendered (the design's city lines are
// omitted, not replaced).
function SessionIcon({ session }: { session: AccountSession }) {
  const kind = session.device?.device ?? '';
  if (/mobile|iphone|ipad|ipod|android|tablet/i.test(kind))
    return <Smartphone size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />;
  if (/laptop|mac/i.test(kind))
    return <Laptop size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />;
  return <Monitor size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />;
}

export function SessionsSection() {
  const t = useTranslations('orgAccount');
  const locale = useLocale();
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

  function activeLabel(session: AccountSession): string {
    if (session.isCurrent) return t('settings.currentSession');
    const at = session.lastUsedAt ?? session.createdAt;
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return t('settings.sessionsHint');
    return t('settings.lastActive', {
      date: date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    });
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
        <ul className="flex flex-col divide-y divide-border-muted">
          {(sessionsQuery.data ?? []).map((s) => (
            <li
              key={s.id}
              data-testid="session-row"
              className="flex items-start justify-between gap-4 py-4"
            >
              <div className="flex min-w-0 items-start gap-3.5">
                <SessionIcon session={s} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                    <span className="break-words">{sessionDeviceLabel(s)}</span>
                    {s.isCurrent ? (
                      <span data-testid="this-device-badge">
                        <Pill tone="success">{t('settings.thisDevice')}</Pill>
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">{activeLabel(s)}</p>
                </div>
              </div>
              {!s.isCurrent ? (
                <button
                  type="button"
                  onClick={() => onRevoke(s.id)}
                  disabled={revoke.isPending}
                  className="shrink-0 py-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
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
        <div className="flex flex-col gap-2 pt-1">
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
