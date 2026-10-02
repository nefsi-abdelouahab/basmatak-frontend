'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Building2, Loader2, User } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { errorStateFor, mapToApiError } from '@/lib/api/errors';
import { RegisterInputSchema } from '@/lib/api/auth';
import {
  ALREADY_AUTHENTICATED_CODE,
  useRegisterOrganizationMutation,
  useRegisterVolunteerMutation,
} from '@/hooks/useAuth';
import { AuthError, AuthSuccess } from '../components';
import { AuthSplit } from '../AuthSplit';
import { PasswordInput } from '../PasswordInput';

type AccountType = 'volunteer' | 'organization';

// Unified signup: account-type tabs drive the submitted role, the side image,
// and the role-specific copy. Both roles require exactly what the API
// requires (email + optional phone + password 8–72, via RegisterInputSchema);
// organization signup creates a single org-owner account, no member invites.
export function CreateAccountForm({ initialType }: { initialType: AccountType }) {
  const t = useTranslations('auth');
  const volunteerMutation = useRegisterVolunteerMutation();
  const organizationMutation = useRegisterOrganizationMutation();
  const [accountType, setAccountType] = useState<AccountType>(initialType);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; phone?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isOrg = accountType === 'organization';
  const mutation = isOrg ? organizationMutation : volunteerMutation;
  const copy = isOrg ? 'registerOrganization' : 'registerVolunteer';

  function selectType(next: AccountType) {
    if (next === accountType) return;
    setAccountType(next);
    setEmail('');
    setPhone('');
    setPassword('');
    setErrors({});
    setFormError(null);
    setDone(false);
  }

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
      // Active session: the auth layer already bounced to the role home and
      // no register POST fired — stay quiet and let the redirect land.
      if (apiError.code === ALREADY_AUTHENTICATED_CODE) return;
      if (apiError.code === 'EMAIL_ALREADY_REGISTERED')
        setFormError(t(`${copy}.emailTaken`));
      else if (apiError.code === 'PHONE_ALREADY_USED') setFormError(t(`${copy}.phoneUsed`));
      else if (apiError.code === 'REGISTRATION_DISABLED')
        setFormError(t(`${copy}.disabled`));
      else if (errorStateFor(apiError) === 'rate-limited')
        setFormError(t('login.rateLimited'));
      else setFormError(t('shared.genericError'));
    }
  }

  return (
    <AuthSplit
      testId="auth-create-account"
      title={t('createAccount.title')}
      subtitle={t('createAccount.subtitle')}
      imageSrc={isOrg ? '/auth/auth-org.png' : '/auth/auth-vol.png'}
      fit={isOrg ? 'cover' : 'contain'}
      backHref="/login"
      backLabel={t('shared.backToLogin')}
      tagline={t(isOrg ? 'createAccount.taglineOrg' : 'createAccount.taglineVolunteer')}
    >
      <div role="group" aria-label={t('createAccount.title')} className="grid grid-cols-2 gap-3">
        <button
          type="button"
          data-testid="auth-type-volunteer"
          aria-pressed={!isOrg}
          onClick={() => selectType('volunteer')}
          className={`flex flex-col items-center gap-1 rounded-lg border p-4 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            !isOrg
              ? 'border-primary bg-primary/5 text-ink'
              : 'border-border bg-surface text-ink-muted hover:border-primary/50 hover:text-ink'
          }`}
        >
          <User aria-hidden="true" size={22} className={!isOrg ? 'text-primary' : undefined} />
          <span className="text-sm font-semibold">{t('createAccount.volunteerTitle')}</span>
          <span className="text-xs text-ink-muted">{t('createAccount.volunteerDescription')}</span>
        </button>
        <button
          type="button"
          data-testid="auth-type-organization"
          aria-pressed={isOrg}
          onClick={() => selectType('organization')}
          className={`flex flex-col items-center gap-1 rounded-lg border p-4 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            isOrg
              ? 'border-primary bg-primary/5 text-ink'
              : 'border-border bg-surface text-ink-muted hover:border-primary/50 hover:text-ink'
          }`}
        >
          <Building2 aria-hidden="true" size={22} className={isOrg ? 'text-primary' : undefined} />
          <span className="text-sm font-semibold">{t('createAccount.orgTitle')}</span>
          <span className="text-xs text-ink-muted">{t('createAccount.orgDescription')}</span>
        </button>
      </div>

      {done ? (
        <>
          <AuthSuccess
            title={t(isOrg ? 'registerOrganization.pendingTitle' : 'registerVolunteer.successTitle')}
            description={t(
              isOrg ? 'registerOrganization.pendingDescription' : 'registerVolunteer.successDescription',
            )}
          />
          <Link
            href={isOrg ? '/org/complete-profile' : '/volunteer/profile'}
            className="text-sm font-medium text-primary"
          >
            {t(isOrg ? 'registerOrganization.continueCta' : 'registerVolunteer.continueCta')}
          </Link>
        </>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            id="register-email"
            label={t(`${copy}.emailLabel`)}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            className="h-10"
          />
          <Input
            id="register-phone"
            label={t(`${copy}.phoneLabel`)}
            type="tel"
            autoComplete="tel"
            hint={t('shared.phoneHint')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={errors.phone}
            className="h-10"
          />
          <PasswordInput
            id="register-password"
            label={t(`${copy}.passwordLabel`)}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            className="h-10"
          />
          {formError ? <AuthError message={formError} /> : null}
          <Button type="submit" disabled={mutation.isPending} className="h-10 w-full">
            {mutation.isPending ? (
              <>
                <Loader2 aria-hidden="true" size={18} className="animate-spin" />
                {t(`${copy}.submitting`)}
              </>
            ) : (
              t(`${copy}.submit`)
            )}
          </Button>
        </form>
      )}
      <p className="text-sm text-ink-muted">
        {t('createAccount.haveAccount')}{' '}
        <Link href="/login" className="font-medium text-primary">
          {t('createAccount.signIn')}
        </Link>
      </p>
    </AuthSplit>
  );
}
