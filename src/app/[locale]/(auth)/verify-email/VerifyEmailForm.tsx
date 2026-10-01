'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Loader2, Mail, XCircle, ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { errorStateFor, mapToApiError } from '@/lib/api/errors';
import { isSafeNextPath } from '@/hooks/useAuth';
import { useResendVerificationMutation, useVerifyEmailMutation } from '@/hooks/useAuth';
import { AuthError, AuthShell, AuthSuccess } from '../components';
import { Container } from '@/components/ui/Container';

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
    <Container variant="narrow" className="flex flex-1 items-center justify-center py-8">
    <AuthShell testId="auth-verify-email" title={t('verifyEmail.title')}>
      <Link
        href="/login"
        aria-label={t('shared.backToLogin')}
        className="inline-flex h-9 w-9 items-center justify-center self-start rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <ArrowLeft aria-hidden="true" size={18} className="rtl:rotate-180" />
      </Link>
      {token && state === 'verifying' ? (
        <p data-testid="auth-verifying" className="flex items-center gap-2 text-ink-muted">
          <Loader2 aria-hidden="true" size={18} className="animate-spin text-primary" />
          {t('verifyEmail.verifying')}
        </p>
      ) : null}
      {token && state === 'success' ? (
        <>
          <div className="flex items-start gap-2">
            <CheckCircle2 aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-status-success" />
            <AuthSuccess
              title={t('verifyEmail.successTitle')}
              description={t('verifyEmail.successDescription')}
            />
          </div>
          <Link href="/login" className="text-sm font-medium text-primary">
            {t('verifyEmail.signInCta')}
          </Link>
        </>
      ) : null}
      {showUnverifiedGate ? (
        <div data-testid="auth-unverified-gate" className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <Mail aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-primary" />
            <AuthSuccess
              title={t('verifyEmail.unverifiedTitle')}
              description={t('verifyEmail.unverifiedDescription')}
            />
          </div>
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
          <div className="flex items-start gap-2">
            {!token ? (
              <Mail aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-primary" />
            ) : (
              <XCircle aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-status-error" />
            )}
            <AuthSuccess
              title={!token ? t('verifyEmail.pendingTitle') : t('verifyEmail.invalidTitle')}
              description={
                !token ? t('verifyEmail.pendingDescription') : t('verifyEmail.invalidDescription')
              }
            />
          </div>
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
    </Container>
  );
}
