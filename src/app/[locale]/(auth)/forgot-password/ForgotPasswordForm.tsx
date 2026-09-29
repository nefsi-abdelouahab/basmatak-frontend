'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { errorStateFor, mapToApiError } from '@/lib/api/errors';
import { emailSchema } from '@/lib/api/auth';
import { useForgotPasswordMutation } from '@/hooks/useAuth';
import { AuthError, AuthSuccess } from '../components';
import { AuthSplit } from '../AuthSplit';

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const mutation = useForgotPasswordMutation();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const ok = emailSchema.safeParse(email).success;
    setEmailError(ok ? undefined : t('shared.invalidEmail'));
    if (!ok) return;
    setFormError(null);
    try {
      await mutation.mutateAsync({ email });
      setDone(true);
    } catch (err) {
      const apiError = mapToApiError(err);
      if (errorStateFor(apiError) === 'rate-limited')
        setFormError(t('forgotPassword.rateLimited'));
      else setFormError(t('shared.genericError'));
    }
  }

  return (
    <AuthSplit
      testId="auth-forgot-password"
      title={t('forgotPassword.title')}
      subtitle={t('forgotPassword.subtitle')}
      imageSrc="/auth/auth-vol.png"
      fit="contain"
      backHref="/login"
      backLabel={t('shared.backToLogin')}
      tagline={t('forgotPassword.tagline')}
    >
      {done ? (
        <>
          <AuthSuccess
            title={t('forgotPassword.successTitle')}
            description={t('forgotPassword.successDescription')}
          />
          <Link href="/login" className="text-sm font-medium text-primary">
            {t('shared.backToLogin')}
          </Link>
        </>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            id="forgot-email"
            label={t('forgotPassword.emailLabel')}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
            className="h-10"
          />
          {formError ? <AuthError message={formError} /> : null}
          <Button type="submit" disabled={mutation.isPending} className="h-10 w-full">
            {mutation.isPending ? (
              <>
                <Loader2 aria-hidden="true" size={18} className="animate-spin" />
                {t('forgotPassword.submitting')}
              </>
            ) : (
              t('forgotPassword.submit')
            )}
          </Button>
          <Link href="/login" className="text-sm font-medium text-primary">
            {t('shared.backToLogin')}
          </Link>
        </form>
      )}
    </AuthSplit>
  );
}
