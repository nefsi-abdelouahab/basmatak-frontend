'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { errorStateFor, mapToApiError } from '@/lib/api/errors';
import { emailSchema } from '@/lib/api/auth';
import {
  ALREADY_AUTHENTICATED_CODE,
  useLoginRedirect,
  useResendVerificationMutation,
} from '@/hooks/useAuth';
import { AuthError, AuthSuccess } from '../components';
import { AuthSplit } from '../AuthSplit';
import { PasswordInput } from '../PasswordInput';

type Status =
  | { kind: 'idle' }
  | { kind: 'invalid' }
  | { kind: 'unverified' }
  | { kind: 'suspended'; code: string }
  | { kind: 'rate-limited' }
  | { kind: 'generic' };

export function LoginForm({ next, status }: { next?: string; status?: string }) {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const { login, isPending } = useLoginRedirect();
  const resend = useResendVerificationMutation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [formStatus, setFormStatus] = useState<Status>({ kind: 'idle' });
  const [resendSent, setResendSent] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const emailOk = emailSchema.safeParse(email).success;
    setEmailError(emailOk ? undefined : t('shared.invalidEmail'));
    const passwordOk = password.length > 0;
    setPasswordError(passwordOk ? undefined : t('shared.required'));
    if (!emailOk || !passwordOk) return;
    setFormStatus({ kind: 'idle' });
    try {
      await login({ email, password }, { next });
    } catch (err) {
      const apiError = mapToApiError(err);
      // Active session: the auth layer already bounced to the role home and
      // no login POST fired — stay quiet and let the redirect land instead
      // of flashing a generic error on the form being left behind.
      if (apiError.code === ALREADY_AUTHENTICATED_CODE) return;
      if (apiError.code === 'INVALID_CREDENTIALS') setFormStatus({ kind: 'invalid' });
      else if (apiError.code === 'EMAIL_NOT_VERIFIED') setFormStatus({ kind: 'unverified' });
      else if (apiError.code === 'ACCOUNT_SUSPENDED' || apiError.code === 'ACCOUNT_INACCESSIBLE')
        setFormStatus({ kind: 'suspended', code: apiError.code });
      else if (errorStateFor(apiError) === 'rate-limited') setFormStatus({ kind: 'rate-limited' });
      else setFormStatus({ kind: 'generic' });
    }
  }

  async function onResend() {
    try {
      await resend.mutateAsync();
      setResendSent(true);
    } catch {
      setFormStatus({ kind: 'generic' });
    }
  }

  return (
    <AuthSplit
      testId="auth-login"
      title={t('login.title')}
      subtitle={t('login.subtitle')}
      imageSrc="/auth/auth-vol.png"
      fit="contain"
      backHref="/"
      backLabel={tCommon('actions.goHome')}
      tagline={t('login.tagline')}
      pattern
    >
      {status === 'password-reset' ? (
        <AuthSuccess
          title={t('login.passwordResetOk')}
          description=""
        />
      ) : null}
      {next ? (
        <p data-testid="auth-continue-notice" className="text-sm font-medium text-gold-strong">
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
          className="h-10"
        />
        <div className="flex flex-col gap-1">
          <PasswordInput
            id="login-password"
            label={t('login.passwordLabel')}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={passwordError}
            className="h-10"
          />
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm font-medium text-gold-strong">
              {t('login.forgot')}
            </Link>
          </div>
        </div>
        {formStatus.kind === 'invalid' ? <AuthError message={t('login.invalidCredentials')} /> : null}
        {formStatus.kind === 'generic' ? <AuthError message={t('shared.genericError')} /> : null}
        {formStatus.kind === 'rate-limited' ? (
          <AuthError message={t('login.rateLimited')} />
        ) : null}
        <Button type="submit" disabled={isPending} className="h-10 w-full">
          {isPending ? (
            <>
              <Loader2 aria-hidden="true" size={18} className="animate-spin" />
              {t('login.submitting')}
            </>
          ) : (
            t('login.submit')
          )}
        </Button>
      </form>
      {formStatus.kind === 'unverified' ? (
        <div data-testid="auth-unverified" className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-ink">{t('login.unverifiedTitle')}</h2>
          <p className="text-sm text-ink-muted">{t('login.unverifiedDescription')}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/verify-email" className="text-sm font-medium text-gold-strong">
              {t('login.verifyNow')}
            </Link>
            <button
              type="button"
              onClick={onResend}
              disabled={resend.isPending}
              className="text-sm font-medium text-gold-strong disabled:opacity-50"
            >
              {t('login.resend')}
            </button>
          </div>
          {resendSent ? <p className="text-sm text-ink-muted">{t('login.resendSent')}</p> : null}
        </div>
      ) : null}
      {formStatus.kind === 'suspended' ? (
        <div data-testid="auth-suspended" className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-ink">{t('login.suspendedTitle')}</h2>
          <p className="text-sm text-ink-muted">{t('login.suspendedDescription')}</p>
          <Link
            href={`/system/forbidden?code=${formStatus.code}`}
            className="text-sm font-medium text-gold-strong"
          >
            {t('login.viewDetails')}
          </Link>
        </div>
      ) : null}
      {formStatus.kind === 'rate-limited' ? (
        <Link href="/system/rate-limited" className="text-sm font-medium text-gold-strong">
          {t('login.viewStatus')}
        </Link>
      ) : null}
      <p className="text-sm text-ink-muted">
        {t('login.noAccount')}{' '}
        <Link href="/create-account" className="font-medium text-gold-strong">
          {t('login.createAccount')}
        </Link>
      </p>
    </AuthSplit>
  );
}
