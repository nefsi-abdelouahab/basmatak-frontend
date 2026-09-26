'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { passwordSchema } from '@/lib/api/auth';
import { useChangePasswordMutation } from '@/hooks/useAccountSettings';
import { SectionError } from '../components';

export function PasswordSection() {
  const t = useTranslations('volunteerAccount');
  const change = useChangePasswordMutation();
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
    <Card title={t('settings.passwordTitle')}>
      <form
        data-testid="settings-password"
        onSubmit={onSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        <p className="text-sm text-ink-muted">{t('settings.passwordHint')}</p>
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
          <p data-testid="password-changed" className="text-sm text-status-success">
            {t('settings.passwordChanged')}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={change.isPending}>
            {change.isPending ? t('settings.changingCta') : t('settings.changeCta')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
