'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { errorStateFor, mapToApiError } from '@/lib/api/errors';
import { RegisterInputSchema } from '@/lib/api/auth';
import { useRegisterOrganizationMutation } from '@/hooks/useAuth';
import { AuthError, AuthShell, AuthSuccess } from '../components';

export function RegisterOrganizationForm() {
  const t = useTranslations('auth');
  const mutation = useRegisterOrganizationMutation();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; phone?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = RegisterInputSchema.safeParse({
      email,
      password,
      phone: phone === '' ? undefined : phone,
    });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors({
        email: flat.email ? t('shared.invalidEmail') : undefined,
        phone: flat.phone ? t('shared.phoneInvalid') : undefined,
        password: flat.password ? t('shared.passwordLength') : undefined,
      });
      return;
    }
    setErrors({});
    setFormError(null);
    try {
      await mutation.mutateAsync(parsed.data);
      setDone(true);
    } catch (err) {
      const apiError = mapToApiError(err);
      if (apiError.code === 'EMAIL_ALREADY_REGISTERED')
        setFormError(t('registerOrganization.emailTaken'));
      else if (apiError.code === 'PHONE_ALREADY_USED')
        setFormError(t('registerOrganization.phoneUsed'));
      else if (apiError.code === 'REGISTRATION_DISABLED')
        setFormError(t('registerOrganization.disabled'));
      else if (errorStateFor(apiError) === 'rate-limited')
        setFormError(t('login.rateLimited'));
      else setFormError(t('shared.genericError'));
    }
  }

  return (
    <AuthShell
      testId="auth-register-organization"
      title={t('registerOrganization.title')}
      subtitle={t('registerOrganization.subtitle')}
    >
      {done ? (
        <>
          <AuthSuccess
            title={t('registerOrganization.pendingTitle')}
            description={t('registerOrganization.pendingDescription')}
          />
          <Link href="/org/complete-profile" className="text-sm font-medium text-primary">
            {t('registerOrganization.continueCta')}
          </Link>
        </>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            id="register-org-email"
            label={t('registerOrganization.emailLabel')}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          <Input
            id="register-org-phone"
            label={t('registerOrganization.phoneLabel')}
            type="tel"
            autoComplete="tel"
            hint={t('shared.phoneHint')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={errors.phone}
          />
          <Input
            id="register-org-password"
            label={t('registerOrganization.passwordLabel')}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          {formError ? <AuthError message={formError} /> : null}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? t('registerOrganization.submitting')
              : t('registerOrganization.submit')}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
