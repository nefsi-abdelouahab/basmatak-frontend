'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { errorStateFor, mapToApiError } from '@/lib/api/errors';
import { isSafeNextPath } from '@/hooks/useAuth';
import { useResendVerificationMutation, useVerifyEmailMutation } from '@/hooks/useAuth';
import { AuthError, AuthShell, AuthSuccess } from '../components';

type VerifyState = 'verifying' | 'success' | 'invalid';

export function VerifyEmailForm({
  token,
  status,
  next,
}: {
  token?: string;
  status?: string;
  next?: string;
}) {
  const t = useTranslations('auth');
  const verify = useVerifyEmailMutation();
  const resend = useResendVerificationMutation();
  const [state, setState] = useState<VerifyState>(token ? 'verifying' : 'invalid');
  const [resendSent, setResendSent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    verify
      .mutateAsync({ token })
      .then(() => setState('success'))
      .catch(() => setState('invalid'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onResend() {
    setResendError(null);
    try {
      await resend.mutateAsync();
      setResendSent(true);
    } catch (err) {
      const apiError = mapToApiError(err);
      if (errorStateFor(apiError) === 'rate-limited')
        setResendError(t('verifyEmail.rateLimited'));
      else setResendError(t('shared.genericError'));
    }
  }

  const showUnverifiedGate = !token && status === 'unverified';
  const continueHref = isSafeNextPath(next) && next ? next : '/';

  return (
    <AuthShell testId="auth-verify-email" title={t('verifyEmail.title')}>
      {token && state === 'verifying' ? (
        <p data-testid="auth-verifying" className="text-ink-muted">
          {t('verifyEmail.verifying')}
        </p>
      ) : null}
      {token && state === 'success' ? (
        <>
          <AuthSuccess
            title={t('verifyEmail.successTitle')}
            description={t('verifyEmail.successDescription')}
          />
          <Link href="/login" className="text-sm font-medium text-primary">
            {t('verifyEmail.signInCta')}
          </Link>
        </>
      ) : null}
      {showUnverifiedGate ? (
        <div data-testid="auth-unverified-gate" className="flex flex-col gap-2">
          <AuthSuccess
            title={t('verifyEmail.unverifiedTitle')}
            description={t('verifyEmail.unverifiedDescription')}
          />
          <button
            type="button"
            onClick={onResend}
            disabled={resend.isPending}
            className="self-start text-sm font-medium text-primary disabled:opacity-50"
          >
            {t('verifyEmail.resend')}
          </button>
          <Link href={continueHref} className="text-sm font-medium text-primary">
            {t('verifyEmail.continueCta')}
          </Link>
        </div>
      ) : null}
      {(!token && !showUnverifiedGate) || (token && state === 'invalid') ? (
        <div data-testid="auth-verify-invalid" className="flex flex-col gap-2">
          <AuthSuccess
            title={!token ? t('verifyEmail.missingTokenTitle') : t('verifyEmail.invalidTitle')}
            description={
              !token ? t('verifyEmail.missingTokenDescription') : t('verifyEmail.invalidDescription')
            }
          />
          <button
            type="button"
            onClick={onResend}
            disabled={resend.isPending}
            className="self-start text-sm font-medium text-primary disabled:opacity-50"
          >
            {t('verifyEmail.requestNew')}
          </button>
        </div>
      ) : null}
      {resendSent ? <p className="text-sm text-ink-muted">{t('verifyEmail.resendSent')}</p> : null}
      {resendError ? <AuthError message={resendError} /> : null}
    </AuthShell>
  );
}
