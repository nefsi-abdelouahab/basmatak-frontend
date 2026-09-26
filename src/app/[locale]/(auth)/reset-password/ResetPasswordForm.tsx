'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { mapToApiError } from '@/lib/api/errors';
import { passwordSchema } from '@/lib/api/auth';
import { useResetPasswordMutation } from '@/hooks/useAuth';
import { AuthError, AuthShell, AuthSuccess } from '../components';

export function ResetPasswordForm({ token }: { token?: string }) {
  const t = useTranslations('auth');
  const mutation = useResetPasswordMutation();
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [expired, setExpired] = useState(false);
  const [genericError, setGenericError] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <AuthShell testId="auth-reset-password" title={t('resetPassword.title')}>
        <AuthSuccess
          title={t('resetPassword.missingTokenTitle')}
          description={t('resetPassword.missingTokenDescription')}
        />
        <Link href="/forgot-password" className="text-sm font-medium text-primary">
          {t('resetPassword.requestNew')}
        </Link>
      </AuthShell>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const ok = passwordSchema.safeParse(newPassword).success;
    setPasswordError(ok ? undefined : t('shared.passwordLength'));
    if (!ok) return;
    setExpired(false);
    setGenericError(false);
    try {
      await mutation.mutateAsync({ token: token as string, newPassword });
      setDone(true);
    } catch (err) {
      const apiError = mapToApiError(err);
      if (apiError.code === 'INVALID_RESET_TOKEN') setExpired(true);
      else setGenericError(true);
    }
  }

  return (
    <AuthShell
      testId="auth-reset-password"
      title={t('resetPassword.title')}
      subtitle={t('resetPassword.subtitle')}
    >
      {done ? (
        <>
          <AuthSuccess
            title={t('resetPassword.successTitle')}
            description={t('resetPassword.successDescription')}
          />
          <Link href="/login" className="text-sm font-medium text-primary">
            {t('resetPassword.signInCta')}
          </Link>
        </>
      ) : expired ? (
        <div data-testid="auth-reset-expired" className="flex flex-col gap-2">
          <AuthSuccess
            title={t('resetPassword.expiredTitle')}
            description={t('resetPassword.expiredDescription')}
          />
          <Link href="/forgot-password" className="text-sm font-medium text-primary">
            {t('resetPassword.requestNew')}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            id="reset-new-password"
            label={t('resetPassword.newPasswordLabel')}
            type="password"
            autoComplete="new-password"
            hint={t('resetPassword.ttlHint')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={passwordError}
          />
          {genericError ? <AuthError message={t('shared.genericError')} /> : null}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t('resetPassword.submitting') : t('resetPassword.submit')}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
