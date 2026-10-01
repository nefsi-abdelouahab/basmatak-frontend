'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { passwordSchema } from '@/lib/api/auth';
import { useChangePasswordMutation } from '@/hooks/useAccountSettings';
import { SectionError } from '../components';

export function PasswordSection() {
  const t = useTranslations('volunteerAccount');
  const change = useChangePasswordMutation();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [currentError, setCurrentError] = useState<string | undefined>();
  const [nextError, setNextError] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setDone(false);
    const currentOk = current.length > 0;
    const nextOk = passwordSchema.safeParse(next).success;
    setCurrentError(currentOk ? undefined : t('shared.required'));
    setNextError(nextOk ? undefined : t('shared.passwordLength'));
    if (!currentOk || !nextOk) return;
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setDone(true);
    } catch {
      // surfaced below via change.isError
    }
  }

  return (
    <div data-testid="settings-password" className="flex flex-col gap-3 rounded-lg bg-surface-muted p-3.5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="inline-flex items-center gap-2 text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
            <KeyRound size={14} aria-hidden="true" className="shrink-0" />
            {t('settings.passwordTitle')}
          </span>
          <span aria-hidden="true" className="tracking-widest text-body-md text-ink">
            {'\u2022'.repeat(12)}
          </span>
          <span className="text-label-xs text-ink-muted">{t('settings.passwordHint')}</span>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="self-start sm:self-center"
        >
          {t('settings.changeCta')}
        </Button>
      </div>
      {open ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            id="settings-current-password"
            label={t('settings.currentLabel')}
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            error={currentError}
          />
          <Input
            id="settings-new-password"
            label={t('settings.newLabel')}
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            error={nextError}
          />
          {change.isError ? (
            <SectionError testId="password-error" message={t('shared.genericError')} />
          ) : null}
          {done && !change.isError ? (
            <p data-testid="password-changed" className="text-body-sm text-status-success">
              {t('settings.passwordChanged')}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={change.isPending}>
              {change.isPending ? t('settings.changingCta') : t('settings.changeCta')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t('shared.cancel')}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
