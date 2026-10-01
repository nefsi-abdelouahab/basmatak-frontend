'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { BadgeCheck, Mail, Phone } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Pill } from '@/components/ui/Pill';
import { emailSchema, phoneSchema } from '@/lib/api/auth';
import { usePatchUsersMeMutation, useUsersMeQuery } from '@/hooks/useAccountSettings';
import { SectionError } from '../components';

export function ContactSection() {
  const t = useTranslations('volunteerAccount');
  const meQuery = useUsersMeQuery();
  const patch = usePatchUsersMeMutation();
  const [email, setEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [emailChanged, setEmailChanged] = useState(false);
  const [saved, setSaved] = useState(false);

  if (meQuery.isPending) {
    return (
      <div data-testid="settings-contact" className="flex flex-col gap-3">
        <Loader label={t('shared.loading')} />
      </div>
    );
  }
  if (meQuery.isError || !meQuery.data) {
    return (
      <div data-testid="settings-contact" className="flex flex-col gap-3">
        <SectionError testId="contact-error" message={t('shared.loadError')} />
      </div>
    );
  }
  const me = meQuery.data;
  const emailValue = email ?? me.email;
  const phoneValue = phone ?? me.phone ?? '';

  function focusField(id: string) {
    document.getElementById(id)?.focus();
  }

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
    <div data-testid="settings-contact" className="flex flex-col gap-3">
      <div className="flex items-start gap-3 rounded-lg bg-primary-tint p-3.5">
        <BadgeCheck size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-label-sm font-semibold text-ink">{t('settings.statusTitle')}</span>
          <span className="break-words text-body-sm text-ink-muted">
            {t(me.emailVerifiedAt ? 'settings.statusBodyVerified' : 'settings.statusBodyUnverified', {
              email: me.email,
            })}
          </span>
        </div>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <p className="text-body-sm text-ink-muted">{t('settings.contactHint')}</p>
        <div className="flex flex-col gap-3 rounded-lg bg-surface-muted p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
              <Mail size={14} aria-hidden="true" className="shrink-0" />
              {t('settings.emailLabel')}
            </span>
            <span className="inline-flex items-center gap-2">
              {me.emailVerifiedAt ? (
                <Pill tone="success">{t('settings.verifiedBadge')}</Pill>
              ) : (
                <Pill tone="pending">{t('settings.unverifiedBadge')}</Pill>
              )}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => focusField('settings-email')}
              >
                {t('settings.changeEmailCta')}
              </Button>
            </span>
          </div>
          <span className="break-all text-body-md font-medium text-ink">{me.email}</span>
          <Input
            id="settings-email"
            label={t('settings.emailLabel')}
            type="email"
            autoComplete="email"
            value={emailValue}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
          />
        </div>
        <div className="flex flex-col gap-3 rounded-lg bg-surface-muted p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
              <Phone size={14} aria-hidden="true" className="shrink-0" />
              {t('settings.phoneLabel')}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => focusField('settings-phone')}
            >
              {t('settings.editPhoneCta')}
            </Button>
          </div>
          {me.phone ? (
            <span dir="ltr" className="text-body-md font-medium text-ink">
              {me.phone}
            </span>
          ) : null}
          <Input
            id="settings-phone"
            label={t('settings.phoneLabel')}
            type="tel"
            autoComplete="tel"
            value={phoneValue}
            onChange={(e) => setPhone(e.target.value)}
            error={phoneError}
          />
        </div>
        {emailChanged ? (
          <div data-testid="verify-notice" className="flex flex-col gap-1">
            <p className="text-body-sm text-ink">{t('settings.verifyNotice')}</p>
            <Link href="/verify-email" className="text-body-sm font-medium text-primary">
              {t('settings.verifyCta')}
            </Link>
          </div>
        ) : null}
        {patch.isError ? <SectionError testId="contact-error" message={t('shared.genericError')} /> : null}
        {saved && !patch.isError ? (
          <p data-testid="contact-saved" className="text-body-sm text-status-success">
            {t('shared.saved')}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={patch.isPending}>
            {patch.isPending ? t('shared.saving') : t('shared.save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
