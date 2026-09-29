'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { mapToApiError } from '@/lib/api/errors';
import { passwordSchema } from '@/lib/api/auth';
import { useResetPasswordMutation } from '@/hooks/useAuth';
import { AuthError, AuthSuccess } from '../components';
import { AuthSplit } from '../AuthSplit';
import { PasswordInput } from '../PasswordInput';

export function ResetPasswordForm({ token }: { token?: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const mutation = useResetPasswordMutation();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [expired, setExpired] = useState(false);
  const [genericError, setGenericError] = useState(false);

  if (!token) {
    return (
      <AuthSplit
        testId="auth-reset-password"
        title={t('resetPassword.title')}
        subtitle={t('resetPassword.subtitle')}
        imageSrc="/auth/auth-vol.png"
      fit="contain"
      backHref="/login"
      backLabel={t('shared.backToLogin')}
        tagline={t('resetPassword.tagline')}
      >
        <AuthSuccess
          title={t('resetPassword.missingTokenTitle')}
          description={t('resetPassword.missingTokenDescription')}
        />
        <Link href="/forgot-password" className="text-sm font-medium text-primary">
          {t('resetPassword.requestNew')}
        </Link>
      </AuthSplit>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const ok = passwordSchema.safeParse(newPassword).success;
    setPasswordError(ok ? undefined : t('shared.passwordLength'));
    const match = newPassword === confirmPassword && confirmPassword !== '';
    setConfirmError(match ? undefined : t('resetPassword.mismatch'));
    if (!ok || !match) return;
    setExpired(false);
    setGenericError(false);
    try {
      await mutation.mutateAsync({ token: token as string, newPassword });
      router.push('/login?status=password-reset');
    } catch (err) {
      const apiError = mapToApiError(err);
      if (apiError.code === 'INVALID_RESET_TOKEN') setExpired(true);
      else setGenericError(true);
    }
  }

  return (
    <AuthSplit
      testId="auth-reset-password"
      title={t('resetPassword.title')}
      subtitle={t('resetPassword.subtitle')}
      imageSrc="/auth/auth-vol.png"
      fit="contain"
      backHref="/login"
      backLabel={t('shared.backToLogin')}
      tagline={t('resetPassword.tagline')}
    >
      {expired ? (
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
          <PasswordInput
            id="reset-new-password"
            label={t('resetPassword.newPasswordLabel')}
            autoComplete="new-password"
            hint={t('resetPassword.ttlHint')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={passwordError}
            className="h-10"
          />
          <PasswordInput
            id="reset-confirm-password"
            label={t('resetPassword.confirmPasswordLabel')}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={confirmError}
            className="h-10"
          />
          {genericError ? <AuthError message={t('shared.genericError')} /> : null}
          <Button type="submit" disabled={mutation.isPending} className="h-10 w-full">
            {mutation.isPending ? (
              <>
                <Loader2 aria-hidden="true" size={18} className="animate-spin" />
                {t('resetPassword.submitting')}
              </>
            ) : (
              t('resetPassword.submit')
            )}
          </Button>
        </form>
      )}
    </AuthSplit>
  );
}
