'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { CircleCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { ApiError } from '@/lib/api/errors';
import {
  accountSaveFieldError,
  diffAccountForm,
  type AccountFormField,
  type AccountFormValues,
} from '@/lib/api/orgAccount';
import {
  useAccountUserQuery,
  useOrgAccountQuery,
  usePatchAccountUserMutation,
  usePatchOrgAccountMutation,
} from '@/hooks/useOrgAccount';
import { SectionError } from './components';

// Account information (code.html §1): organization names (nameAr/nameFr are
// the only real name fields — no single-name backend field exists), account
// email + phone (PATCH /users/me, email change re-verifies), and portal URL
// (PATCH /organizations/me website). One Save/Discard row writes whichever
// source changed; inline states only, no toasts. Validate + diff goes
// through the pure diffAccountForm helper (normalize-then-validate for
// phone, partial payloads for both PATCH endpoints).
export function AccountInformationSection() {
  const t = useTranslations('orgAccount');
  const orgQuery = useOrgAccountQuery();
  const meQuery = useAccountUserQuery();
  const patchOrg = usePatchOrgAccountMutation();
  const patchUser = usePatchAccountUserMutation();

  const [nameAr, setNameAr] = useState<string | null>(null);
  const [nameFr, setNameFr] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [website, setWebsite] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [emailChanged, setEmailChanged] = useState(false);
  const [saved, setSaved] = useState(false);

  const org = orgQuery.data;
  const me = meQuery.data;

  useEffect(() => {
    setSaved(false);
  }, [org?.updatedAt, me?.email, me?.phone]);

  if (orgQuery.isPending || meQuery.isPending) {
    return (
      <Card title={t('settings.accountTitle')}>
        <Loader label={t('shared.loading')} />
      </Card>
    );
  }
  if (orgQuery.isError || !org || meQuery.isError || !me) {
    return (
      <Card title={t('settings.accountTitle')}>
        <SectionError testId="contact-error" message={t('shared.loadError')} />
      </Card>
    );
  }

  // Narrowed snapshots: render-scope guards above prove non-null, but TS
  // resets narrowing inside the submit closure — these carry the proof.
  const orgSnapshot = org;
  const meSnapshot = me;

  const formValues: AccountFormValues = {
    nameAr: nameAr ?? orgSnapshot.nameAr ?? '',
    nameFr: nameFr ?? orgSnapshot.nameFr ?? '',
    email: email ?? meSnapshot.email,
    phone: phone ?? meSnapshot.phone ?? '',
    website: website ?? orgSnapshot.website ?? '',
  };

  // Validate + diff in one pure call (lib/api/orgAccount): only changed,
  // valid fields are submitted; phone is normalized before comparison so a
  // re-typed-but-identical number is not "dirty".
  const preview = diffAccountForm(
    {
      nameAr: orgSnapshot.nameAr,
      nameFr: orgSnapshot.nameFr,
      website: orgSnapshot.website,
      email: meSnapshot.email,
      phone: meSnapshot.phone,
    },
    formValues,
  );
  const dirty = preview.dirty;

  function onDiscard() {
    setNameAr(null);
    setNameFr(null);
    setEmail(null);
    setPhone(null);
    setWebsite(null);
    setErrors({});
    setSaved(false);
    setEmailChanged(false);
  }

  const fieldMessage: Record<AccountFormField, string> = {
    nameAr: t('shared.genericError'),
    nameFr: t('shared.genericError'),
    email: t('shared.invalidEmail'),
    phone: t('shared.phoneInvalid'),
    website: t('profile.invalidWebsite'),
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    setEmailChanged(false);
    const diff = diffAccountForm(
      {
        nameAr: orgSnapshot.nameAr,
        nameFr: orgSnapshot.nameFr,
        website: orgSnapshot.website,
        email: meSnapshot.email,
        phone: meSnapshot.phone,
      },
      formValues,
    );
    const nextErrors: Record<string, string | undefined> = {};
    for (const field of diff.invalid) nextErrors[field] = fieldMessage[field];
    setErrors(nextErrors);
    if (diff.invalid.length > 0 || !diff.dirty) return;
    try {
      if (Object.keys(diff.orgInput).length > 0) await patchOrg.mutateAsync(diff.orgInput);
      if (Object.keys(diff.userInput).length > 0) {
        const updated = await patchUser.mutateAsync(diff.userInput);
        setEmailChanged(diff.userInput.email !== undefined && updated.email !== meSnapshot.email);
      }
      setSaved(true);
    } catch (err) {
      // Surface the real server cause on its field (e.g. 409 number-in-use
      // on phone) instead of the generic fallback below.
      const field = accountSaveFieldError(err, {
        email: diff.userInput.email !== undefined,
        phone: diff.userInput.phone !== undefined,
      });
      if (field) {
        const conflict = err instanceof ApiError && err.code === 'CONTACT_CONFLICT';
        const message = conflict
          ? field === 'email'
            ? t('settings.emailTaken')
            : t('settings.phoneTaken')
          : fieldMessage[field];
        setErrors({ [field]: message });
      }
      // Anything unmapped keeps the generic SectionError via isError below.
    }
  }

  const failed = patchOrg.isError || patchUser.isError;
  const saving = patchOrg.isPending || patchUser.isPending;

  return (
    <Card title={t('settings.accountTitle')}>
      <p className="mb-4 text-sm text-ink-muted">{t('settings.accountHint')}</p>
      <form data-testid="settings-contact" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          id="org-settings-name-ar"
          label={t('profile.nameArLabel')}
          value={formValues.nameAr}
          maxLength={200}
          onChange={(e) => setNameAr(e.target.value)}
          error={errors.nameAr}
        />
        <Input
          id="org-settings-name-fr"
          label={t('profile.nameFrLabel')}
          value={formValues.nameFr}
          maxLength={200}
          onChange={(e) => setNameFr(e.target.value)}
          error={errors.nameFr}
        />
        <Input
          id="org-settings-email"
          label={t('settings.emailLabel')}
          type="email"
          autoComplete="email"
          value={formValues.email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        {meSnapshot.emailVerifiedAt ? (
          <p data-testid="email-verified-badge" className="flex items-center gap-1.5 text-xs text-ink-muted">
            <CircleCheck size={15} aria-hidden="true" className="shrink-0 text-ink" />
            <span>{t('settings.verifiedEmail')}</span>
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="org-settings-phone"
            label={t('settings.phoneLabel')}
            type="tel"
            autoComplete="tel"
            value={formValues.phone}
            onChange={(e) => setPhone(e.target.value)}
            error={errors.phone}
          />
          <Input
            id="org-settings-website"
            label={t('profile.websiteLabel')}
            type="url"
            inputMode="url"
            placeholder="https://"
            value={formValues.website}
            onChange={(e) => setWebsite(e.target.value)}
            error={errors.website}
          />
        </div>
        {emailChanged ? (
          <div data-testid="verify-notice" className="flex flex-col gap-1">
            <p className="text-sm text-ink">{t('settings.verifyNotice')}</p>
            <Link href="/verify-email" className="text-sm font-medium text-primary">
              {t('settings.verifyCta')}
            </Link>
          </div>
        ) : null}
        {failed && Object.values(errors).every((error) => !error) ? (
          <SectionError testId="contact-error" message={t('shared.genericError')} />
        ) : null}
        {saved && !failed ? (
          <p data-testid="contact-saved" className="text-sm text-status-success">
            {t('shared.saved')}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="submit" disabled={saving || !dirty}>
            {saving ? t('shared.saving') : t('settings.saveChanges')}
          </Button>
          <Button type="button" variant="ghost" onClick={onDiscard} disabled={saving || !dirty}>
            {t('settings.discardChanges')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
