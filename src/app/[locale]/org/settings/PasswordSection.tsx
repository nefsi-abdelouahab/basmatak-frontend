'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { passwordSchema } from '@/lib/api/auth';
import { useAccountChangePasswordMutation } from '@/hooks/useOrgAccount';
import { SectionError } from './components';

// Change password (code.html §2): current + new + confirm-new. The backend
// takes {currentPassword, newPassword} (8–72 chars, POST
// /auth/change-password); confirmation is a client-side match check only.
export function PasswordSection() {
  const t = useTranslations('orgAccount');
  const change = useAccountChangePasswordMutation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [currentError, setCurrentError] = useState<string | undefined>();
  const [nextError, setNextError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setDone(false);
    const currentOk = current.length > 0;
    const nextOk = passwordSchema.safeParse(next).success;
    const confirmOk = confirm === next;
    setCurrentError(currentOk ? undefined : t('shared.required'));
    setNextError(nextOk ? undefined : t('shared.passwordLength'));
    setConfirmError(confirmOk ? undefined : t('settings.passwordMismatch'));
    if (!currentOk || !nextOk || !confirmOk) return;
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setConfirm('');
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
        className="flex max-w-lg flex-col gap-4"
        noValidate
      >
        <p className="text-sm text-ink-muted">{t('settings.passwordHint')}</p>
        <Input
          id="org-settings-current-password"
          label={t('settings.currentLabel')}
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={currentError}
        />
        <Input
          id="org-settings-new-password"
          label={t('settings.newLabel')}
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={nextError}
        />
        <Input
          id="org-settings-confirm-password"
          label={t('settings.confirmNewLabel')}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={confirmError}
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
          <Button type="submit" variant="secondary" disabled={change.isPending}>
            {change.isPending ? t('settings.changingCta') : t('settings.updatePassword')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
