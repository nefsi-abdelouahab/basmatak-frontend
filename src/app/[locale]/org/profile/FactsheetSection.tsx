'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import {
  ACCOUNT_DOC_MIMES,
  ACCOUNT_IMAGE_MIMES,
  ORG_ACCOUNT_PHONE_PATTERN,
  ORG_ACCOUNT_WEBSITE_PATTERN,
  accountMediaUrlOf,
  completionView,
  orgDisplayCode,
  validateAccountFile,
  type AccountAllowedMimes,
  type AccountUploadProgress,
  type OrgAccount,
  type UpdateOrgAccountInput,
} from '@/lib/api/orgAccount';
import {
  useAccountMediaQuery,
  useOrgAccountCompletionQuery,
  useOrgAccountQuery,
  usePatchOrgAccountMutation,
  useUploadOrgAccountMedia,
} from '@/hooks/useOrgAccount';
import { ProgressBar, SectionError } from './components';

const MONGO_ID = /^[0-9a-fA-F]{24}$/;
const CURRENT_YEAR = new Date().getFullYear();
const COVER_PURPOSE = 'organization_cover';
const LOGO_PURPOSE = 'organization_logo';
const REPORT_PURPOSE = 'organization_document';

interface FormState {
  nameAr: string;
  nameFr: string;
  description: string;
  type: string;
  registrationNumber: string;
  wilayaId: string;
  municipalityId: string;
  address: string;
  website: string;
  foundedYear: string;
  contactEmail: string;
  contactPhone: string;
  focusDisciplines: string;
  operatingScope: string;
}

function fromOrg(org: OrgAccount): FormState {
  return {
    nameAr: org.nameAr ?? '',
    nameFr: org.nameFr ?? '',
    description: org.description ?? '',
    type: org.type ?? '',
    registrationNumber: org.registrationNumber ?? '',
    wilayaId: org.location?.wilayaId ?? '',
    municipalityId: org.location?.municipalityId ?? '',
    address: org.location?.address ?? '',
    website: org.website ?? '',
    foundedYear: org.foundedYear === undefined ? '' : String(org.foundedYear),
    contactEmail: org.contact?.email ?? '',
    contactPhone: org.contact?.phone ?? '',
    focusDisciplines: (org.focusDisciplines ?? []).join(', '),
    operatingScope: org.operatingScope ?? '',
  };
}

type MediaSlot = 'cover' | 'logo' | 'report';

const SLOT_META: Record<
  MediaSlot,
  { purpose: string; allowed: AccountAllowedMimes; accept: string }
> = {
  cover: { purpose: COVER_PURPOSE, allowed: ACCOUNT_IMAGE_MIMES, accept: 'image/jpeg,image/png,image/webp' },
  logo: { purpose: LOGO_PURPOSE, allowed: ACCOUNT_IMAGE_MIMES, accept: 'image/jpeg,image/png,image/webp' },
  report: { purpose: REPORT_PURPOSE, allowed: ACCOUNT_DOC_MIMES, accept: 'image/jpeg,image/png,image/webp,application/pdf' },
};

export function FactsheetSection({ locale }: { locale: string }) {
  const t = useTranslations('orgAccount');
  const orgQuery = useOrgAccountQuery();
  const completionQuery = useOrgAccountCompletionQuery();
  const updateMutation = usePatchOrgAccountMutation();
  const uploadMedia = useUploadOrgAccountMedia();

  const [form, setForm] = useState<FormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [staged, setStaged] = useState<Partial<Record<MediaSlot, string>>>({});
  const [slotErrors, setSlotErrors] = useState<Partial<Record<MediaSlot, string>>>({});
  const [slotProgress, setSlotProgress] = useState<Partial<Record<MediaSlot, number>>>({});

  useEffect(() => {
    if (orgQuery.data && form === null) setForm(fromOrg(orgQuery.data));
  }, [orgQuery.data, form]);

  const coverId = staged.cover ?? orgQuery.data?.coverMediaId ?? null;
  const logoId = staged.logo ?? orgQuery.data?.logoMediaId ?? null;
  const reportId = staged.report ?? orgQuery.data?.annualReportMediaId ?? null;
  const coverMedia = useAccountMediaQuery(coverId);
  const logoMedia = useAccountMediaQuery(logoId);
  const reportMedia = useAccountMediaQuery(reportId);

  if (orgQuery.isPending || completionQuery.isPending) {
    return (
      <Card title={t('profile.factsTitle')}>
        <Loader label={t('shared.loading')} />
      </Card>
    );
  }
  if (orgQuery.isError || !orgQuery.data || !form) {
    return (
      <Card title={t('profile.factsTitle')}>
        <SectionError testId="profile-error" message={t('shared.loadError')} />
      </Card>
    );
  }

  const org = orgQuery.data;
  const completion = completionQuery.data ? completionView(completionQuery.data) : null;
  const code = orgDisplayCode(org.registryId);
  const verification =
    org.verificationStatus === 'verified'
      ? t('profile.verificationVerified')
      : org.verificationStatus === 'rejected'
        ? t('profile.verificationRejected')
        : t('profile.verificationPending');

  const set = (key: keyof FormState) => (value: string) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  };

  function validate(): boolean {
    const errors: Partial<Record<keyof FormState, string>> = {};
    if (form!.contactPhone.trim() !== '' && !ORG_ACCOUNT_PHONE_PATTERN.test(form!.contactPhone.trim())) {
      errors.contactPhone = t('profile.invalidPhone');
    }
    if (form!.website.trim() !== '' && !ORG_ACCOUNT_WEBSITE_PATTERN.test(form!.website.trim())) {
      errors.website = t('profile.invalidWebsite');
    }
    if (form!.foundedYear.trim() !== '') {
      const year = Number(form!.foundedYear.trim());
      if (!Number.isInteger(year) || year < 1800 || year > CURRENT_YEAR) {
        errors.foundedYear = t('profile.invalidYear');
      }
    }
    const disciplines = form!.focusDisciplines
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (disciplines.some((d) => !MONGO_ID.test(d))) {
      errors.focusDisciplines = t('profile.invalidDisciplines');
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function onSlotFile(slot: MediaSlot, file: File | null) {
    if (!file) return;
    const meta = SLOT_META[slot];
    const check = validateAccountFile({ type: file.type, size: file.size }, meta.allowed);
    if (!check.ok) {
      setSlotErrors((prev) => ({
        ...prev,
        [slot]: check.reason === 'size' ? t('profile.fileSizeError') : t('profile.fileTypeError'),
      }));
      return;
    }
    if (!consent) {
      setConsentError(t('profile.consentRequired'));
      return;
    }
    setConsentError(null);
    setSlotErrors((prev) => ({ ...prev, [slot]: undefined }));
    setSlotProgress((prev) => ({ ...prev, [slot]: 0 }));
    try {
      const onProgress = (p: AccountUploadProgress) =>
        setSlotProgress((prev) => ({ ...prev, [slot]: p.percent }));
      const mediaId = await uploadMedia(
        { name: file.name, type: file.type, size: file.size, blob: file },
        { purpose: meta.purpose, allowed: meta.allowed, onProgress },
      );
      setStaged((prev) => ({ ...prev, [slot]: mediaId }));
    } catch {
      setSlotErrors((prev) => ({ ...prev, [slot]: t('shared.genericError') }));
    } finally {
      setSlotProgress((prev) => ({ ...prev, [slot]: undefined }));
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSaved(false);
    if (!validate()) return;
    const current = form;
    if (!current) return;
    try {
      const disciplines = current.focusDisciplines
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const trimmed = (s: string) => (s.trim() === '' ? undefined : s.trim());
      const input: UpdateOrgAccountInput = {};
      if (trimmed(current.nameAr)) input.nameAr = trimmed(current.nameAr);
      if (trimmed(current.nameFr)) input.nameFr = trimmed(current.nameFr);
      if (trimmed(current.description)) input.description = trimmed(current.description);
      if (trimmed(current.type)) input.type = trimmed(current.type);
      if (trimmed(current.registrationNumber)) input.registrationNumber = trimmed(current.registrationNumber);
      if (current.wilayaId !== '' || current.municipalityId !== '' || trimmed(current.address)) {
        input.location = {};
        if (current.wilayaId !== '') input.location.wilayaId = current.wilayaId;
        if (current.municipalityId !== '') input.location.municipalityId = current.municipalityId;
        if (trimmed(current.address)) input.location.address = trimmed(current.address);
      }
      if (trimmed(current.website)) input.website = trimmed(current.website);
      if (trimmed(current.foundedYear)) input.foundedYear = Number(trimmed(current.foundedYear));
      if (trimmed(current.contactEmail) || trimmed(current.contactPhone)) {
        input.contact = {};
        if (trimmed(current.contactEmail)) input.contact.email = trimmed(current.contactEmail);
        if (trimmed(current.contactPhone)) input.contact.phone = trimmed(current.contactPhone);
      }
      if (disciplines.length > 0) input.focusDisciplines = disciplines;
      if (trimmed(current.operatingScope)) input.operatingScope = trimmed(current.operatingScope);
      if (staged.cover) input.coverMediaId = staged.cover;
      if (staged.logo) input.logoMediaId = staged.logo;
      if (staged.report) input.annualReportMediaId = staged.report;
      await updateMutation.mutateAsync(input);
      setStaged({});
      setSaved(true);
    } catch {
      setFormError(t('profile.formError'));
    }
  }

  const slots: {
    slot: MediaSlot;
    inputId: string;
    mediaId: string | null;
    previewUrl: string | null;
    loading: boolean;
  }[] = [
    {
      slot: 'cover',
      inputId: 'org-profile-cover',
      mediaId: coverId,
      previewUrl: accountMediaUrlOf(coverMedia.data),
      loading: coverMedia.isPending && coverId !== null,
    },
    {
      slot: 'logo',
      inputId: 'org-profile-logo',
      mediaId: logoId,
      previewUrl: accountMediaUrlOf(logoMedia.data),
      loading: logoMedia.isPending && logoId !== null,
    },
    {
      slot: 'report',
      inputId: 'org-profile-report',
      mediaId: reportId,
      previewUrl: accountMediaUrlOf(reportMedia.data),
      loading: reportMedia.isPending && reportId !== null,
    },
  ];

  return (
    <Card title={t('profile.factsTitle')}>
      <div data-testid="org-profile-facts" className="flex flex-col gap-6">
        <p className="text-sm text-ink-muted">{t('profile.factsHint')}</p>
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <dt className="text-ink-muted">{t('profile.codeLabel')}</dt>
            <dd data-testid="profile-code" className="font-medium text-ink">
              {code}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">{t('profile.verificationLabel')}</dt>
            <dd data-testid="profile-verification" className="font-medium text-ink">
              {verification}
            </dd>
          </div>
        </dl>
        {org.slug ? (
          <Link
            data-testid="public-profile-link"
            href={`/${locale}/orgs/${org.slug}`}
            className="text-sm font-medium text-primary"
          >
            {t('profile.publicLinkLabel')}
          </Link>
        ) : null}
        {completion ? (
          <div
            data-testid="profile-completion"
            className="rounded-md border border-border bg-surface-muted px-4 py-3"
          >
            <p className="text-sm font-medium text-ink">
              {t('profile.completionTitle')}: {completion.percent}%{' '}
              {completion.complete ? `· ${t('profile.completionComplete')}` : null}
            </p>
            {!completion.complete ? (
              <p className="mt-1 text-sm text-ink-muted">
                {t('profile.completionMissing')}: {completion.missing.join(', ')}
              </p>
            ) : null}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              id="org-profile-name-ar"
              label={t('profile.nameArLabel')}
              value={form.nameAr}
              onChange={(e) => set('nameAr')(e.target.value)}
              maxLength={200}
            />
            <Input
              id="org-profile-name-fr"
              label={t('profile.nameFrLabel')}
              value={form.nameFr}
              onChange={(e) => set('nameFr')(e.target.value)}
              maxLength={200}
            />
          </div>
          <div>
            <label htmlFor="org-profile-description" className="mb-1 block text-sm font-medium text-ink">
              {t('profile.descriptionLabel')}
            </label>
            <textarea
              id="org-profile-description"
              value={form.description}
              onChange={(e) => set('description')(e.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink focus:border-primary focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              id="org-profile-type"
              label={t('profile.typeLabel')}
              value={form.type}
              onChange={(e) => set('type')(e.target.value)}
            />
            <Input
              id="org-profile-registration-number"
              label={t('profile.registrationNumberLabel')}
              value={form.registrationNumber}
              onChange={(e) => set('registrationNumber')(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              id="org-profile-wilaya"
              label={t('profile.wilayaLabel')}
              value={form.wilayaId}
              onChange={(e) => set('wilayaId')(e.target.value)}
            />
            <Input
              id="org-profile-municipality"
              label={t('profile.municipalityLabel')}
              value={form.municipalityId}
              onChange={(e) => set('municipalityId')(e.target.value)}
            />
          </div>
          <Input
            id="org-profile-address"
            label={t('profile.addressLabel')}
            value={form.address}
            onChange={(e) => set('address')(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              id="org-profile-website"
              label={t('profile.websiteLabel')}
              type="url"
              value={form.website}
              onChange={(e) => set('website')(e.target.value)}
              error={fieldErrors.website}
            />
            <Input
              id="org-profile-founded-year"
              label={t('profile.foundedYearLabel')}
              type="number"
              value={form.foundedYear}
              onChange={(e) => set('foundedYear')(e.target.value)}
              error={fieldErrors.foundedYear}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              id="org-profile-contact-email"
              label={t('profile.contactEmailLabel')}
              type="email"
              value={form.contactEmail}
              onChange={(e) => set('contactEmail')(e.target.value)}
            />
            <Input
              id="org-profile-contact-phone"
              label={t('profile.contactPhoneLabel')}
              type="tel"
              value={form.contactPhone}
              onChange={(e) => set('contactPhone')(e.target.value)}
              error={fieldErrors.contactPhone}
            />
          </div>
          <Input
            id="org-profile-focus-disciplines"
            label={t('profile.focusDisciplinesLabel')}
            hint={t('profile.focusDisciplinesHint')}
            value={form.focusDisciplines}
            onChange={(e) => set('focusDisciplines')(e.target.value)}
            error={fieldErrors.focusDisciplines}
          />
          <Input
            id="org-profile-operating-scope"
            label={t('profile.operatingScopeLabel')}
            value={form.operatingScope}
            onChange={(e) => set('operatingScope')(e.target.value)}
          />

          <div data-testid="profile-media" className="flex flex-col gap-4">
            <Checkbox
              id="org-profile-consent"
              label={t('profile.consentLabel')}
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                setConsentError(null);
              }}
            />
            {consentError ? (
              <p data-testid="consent-error" className="text-sm text-status-error">
                {consentError}
              </p>
            ) : null}
            {slots.map(({ slot, inputId, mediaId, previewUrl, loading }) => {
              const meta = SLOT_META[slot];
              const title =
                slot === 'cover'
                  ? t('profile.coverTitle')
                  : slot === 'logo'
                    ? t('profile.logoTitle')
                    : t('profile.reportTitle');
              const hint =
                slot === 'cover'
                  ? t('profile.coverHint')
                  : slot === 'logo'
                    ? t('profile.logoHint')
                    : t('profile.reportHint');
              const progress = slotProgress[slot];
              return (
                <div key={slot}>
                  <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-ink">
                    {title}
                  </label>
                  {loading ? <Loader label={t('shared.loading')} /> : null}
                  {!loading && !previewUrl ? (
                    <p data-testid={`${slot}-empty`} className="text-sm text-ink-muted">
                      {slot === 'cover'
                        ? t('profile.coverEmptyBody')
                        : slot === 'logo'
                          ? t('profile.logoEmptyBody')
                          : t('profile.reportEmpty')}
                    </p>
                  ) : null}
                  {!loading && previewUrl && slot !== 'report' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      data-testid={`${slot}-preview`}
                      src={previewUrl}
                      alt=""
                      className="h-24 w-full rounded-md border border-border object-cover"
                    />
                  ) : null}
                  {!loading && previewUrl && slot === 'report' ? (
                    <a
                      data-testid="report-link"
                      href={previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-primary"
                    >
                      {t('profile.reportLinkLabel')}
                    </a>
                  ) : null}
                  {!loading && mediaId && !previewUrl ? (
                    <p data-testid={`${slot}-attached`} className="text-sm text-ink-muted">
                      {slot === 'cover'
                        ? t('profile.coverAttached')
                        : slot === 'logo'
                          ? t('profile.logoAttached')
                          : t('profile.reportAttached')}
                    </p>
                  ) : null}
                  <input
                    id={inputId}
                    type="file"
                    accept={meta.accept}
                    onChange={(e) => onSlotFile(slot, e.target.files?.[0] ?? null)}
                    className="mt-1 w-full text-sm text-ink"
                  />
                  <p className="mt-1 text-sm text-ink-muted">{hint}</p>
                  {progress !== undefined ? (
                    <ProgressBar percent={progress} label={t('profile.uploadingLabel')} />
                  ) : null}
                  {slotErrors[slot] ? (
                    <p data-testid={`${slot}-error`} className="mt-1 text-sm text-status-error">
                      {slotErrors[slot]}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          {formError ? (
            <p data-testid="profile-form-error" className="text-sm text-status-error">
              {formError}
            </p>
          ) : null}
          {updateMutation.isError && !formError ? (
            <SectionError testId="profile-form-error" message={t('shared.genericError')} />
          ) : null}
          {saved && !updateMutation.isError ? (
            <p data-testid="profile-saved" className="text-sm text-status-success">
              {t('shared.saved')}
            </p>
          ) : null}
          <div>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? t('shared.saving') : t('shared.save')}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}
