'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { errorStateFor, mapToApiError } from '@/lib/api/errors';
import { emailSchema } from '@/lib/api/auth';
import { useLoginRedirect, useResendVerificationMutation } from '@/hooks/useAuth';
import { AuthError, AuthShell } from '../components';

type Status =
  | { kind: 'idle' }
  | { kind: 'invalid' }
  | { kind: 'unverified' }
  | { kind: 'suspended'; code: string }
  | { kind: 'rate-limited' }
  | { kind: 'generic' };

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations('auth');
  const { login, isPending } = useLoginRedirect();
  const resend = useResendVerificationMutation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [resendSent, setResendSent] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const emailOk = emailSchema.safeParse(email).success;
    setEmailError(emailOk ? undefined : t('shared.invalidEmail'));
    const passwordOk = password.length > 0;
    setPasswordError(passwordOk ? undefined : t('shared.required'));
    if (!emailOk || !passwordOk) return;
    setStatus({ kind: 'idle' });
    try {
      await login({ email, password }, { next });
    } catch (err) {
      const apiError = mapToApiError(err);
      if (apiError.code === 'INVALID_CREDENTIALS') setStatus({ kind: 'invalid' });
      else if (apiError.code === 'EMAIL_NOT_VERIFIED') setStatus({ kind: 'unverified' });
      else if (apiError.code === 'ACCOUNT_SUSPENDED' || apiError.code === 'ACCOUNT_INACCESSIBLE')
        setStatus({ kind: 'suspended', code: apiError.code });
      else if (errorStateFor(apiError) === 'rate-limited') setStatus({ kind: 'rate-limited' });
      else setStatus({ kind: 'generic' });
    }
  }

  async function onResend() {
    try {
      await resend.mutateAsync();
      setResendSent(true);
    } catch {
      setStatus({ kind: 'generic' });
    }
  }

  return (
    <AuthShell testId="auth-login" title={t('login.title')} subtitle={t('login.subtitle')}>
      {next ? (
        <p data-testid="auth-continue-notice" className="text-sm font-medium text-primary">
          {t('login.continueNotice')}
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          id="login-email"
          label={t('login.emailLabel')}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />
        <Input
          id="login-password"
          label={t('login.passwordLabel')}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordError}
        />
        {status.kind === 'invalid' ? <AuthError message={t('login.invalidCredentials')} /> : null}
        {status.kind === 'generic' ? <AuthError message={t('shared.genericError')} /> : null}
        {status.kind === 'rate-limited' ? (
          <AuthError message={t('login.rateLimited')} />
        ) : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? t('login.submitting') : t('login.submit')}
        </Button>
      </form>
      {status.kind === 'unverified' ? (
        <div data-testid="auth-unverified" className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-ink">{t('login.unverifiedTitle')}</h2>
          <p className="text-sm text-ink-muted">{t('login.unverifiedDescription')}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/verify-email" className="text-sm font-medium text-primary">
              {t('login.verifyNow')}
            </Link>
            <button
              type="button"
              onClick={onResend}
              disabled={resend.isPending}
              className="text-sm font-medium text-primary disabled:opacity-50"
            >
              {t('login.resend')}
            </button>
          </div>
          {resendSent ? <p className="text-sm text-ink-muted">{t('login.resendSent')}</p> : null}
        </div>
      ) : null}
      {status.kind === 'suspended' ? (
        <div data-testid="auth-suspended" className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-ink">{t('login.suspendedTitle')}</h2>
          <p className="text-sm text-ink-muted">{t('login.suspendedDescription')}</p>
          <Link
            href={`/system/forbidden?code=${status.code}`}
            className="text-sm font-medium text-primary"
          >
            {t('login.viewDetails')}
          </Link>
        </div>
      ) : null}
      {status.kind === 'rate-limited' ? (
        <Link href="/system/rate-limited" className="text-sm font-medium text-primary">
          {t('login.viewStatus')}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link href="/forgot-password" className="font-medium text-primary">
          {t('login.forgot')}
        </Link>
        <p className="text-ink-muted">
          {t('login.noAccount')}{' '}
          <Link href="/create-account" className="font-medium text-primary">
            {t('login.createAccount')}
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
