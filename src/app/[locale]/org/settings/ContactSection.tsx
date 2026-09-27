'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { emailSchema, phoneSchema } from '@/lib/api/auth';
import { useAccountUserQuery, usePatchAccountUserMutation } from '@/hooks/useOrgAccount';
import { SectionError } from './components';

export function ContactSection() {
  const t = useTranslations('orgAccount');
  const meQuery = useAccountUserQuery();
  const patch = usePatchAccountUserMutation();
  const [email, setEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [emailChanged, setEmailChanged] = useState(false);
  const [saved, setSaved] = useState(false);

  if (meQuery.isPending) {
    return (
      <Card title={t('settings.contactTitle')}>
        <Loader label={t('shared.loading')} />
      </Card>
    );
  }
  if (meQuery.isError || !meQuery.data) {
    return (
      <Card title={t('settings.contactTitle')}>
        <SectionError testId="contact-error" message={t('shared.loadError')} />
      </Card>
    );
  }
  const me = meQuery.data;
  const emailValue = email ?? me.email;
  const phoneValue = phone ?? me.phone ?? '';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    setEmailChanged(false);
    const nextEmail = emailValue.trim();
    const nextPhone = phoneValue.trim();
    const emailOk = nextEmail === me.email || emailSchema.safeParse(nextEmail).success;
    const phoneOk = nextPhone === '' || phoneSchema.safeParse(nextPhone).success;
    setEmailError(emailOk ? undefined : t('shared.invalidEmail'));
    setPhoneError(phoneOk ? undefined : t('shared.phoneInvalid'));
    if (!emailOk || !phoneOk) return;
    const input: { email?: string; phone?: string } = {};
    if (nextEmail !== me.email) input.email = nextEmail;
    if (nextPhone !== (me.phone ?? '')) input.phone = nextPhone;
    if (Object.keys(input).length === 0) return;
    try {
      const updated = await patch.mutateAsync(input);
      setSaved(true);
      setEmailChanged(updated.email !== me.email && input.email !== undefined);
    } catch {
      // surfaced below via patch.isError
    }
  }

  return (
    <Card title={t('settings.contactTitle')}>
      <form data-testid="settings-contact" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <p className="text-sm text-ink-muted">{t('settings.contactHint')}</p>
        <Input
          id="org-settings-email"
          label={t('settings.emailLabel')}
          type="email"
          autoComplete="email"
          value={emailValue}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />
        <Input
          id="org-settings-phone"
          label={t('settings.phoneLabel')}
          type="tel"
          autoComplete="tel"
          value={phoneValue}
          onChange={(e) => setPhone(e.target.value)}
          error={phoneError}
        />
        {emailChanged ? (
          <div data-testid="verify-notice" className="flex flex-col gap-1">
            <p className="text-sm text-ink">{t('settings.verifyNotice')}</p>
            <Link href="/verify-email" className="text-sm font-medium text-primary">
              {t('settings.verifyCta')}
            </Link>
          </div>
        ) : null}
        {patch.isError ? <SectionError testId="contact-error" message={t('shared.genericError')} /> : null}
        {saved && !patch.isError ? (
          <p data-testid="contact-saved" className="text-sm text-status-success">
            {t('shared.saved')}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={patch.isPending}>
            {patch.isPending ? t('shared.saving') : t('shared.save')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
