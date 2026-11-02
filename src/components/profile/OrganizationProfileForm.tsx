'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Select } from '@/components/ui/Select';
import {
  CheckboxMultiSelect,
  CompletionCard,
  ImageUploader,
  SaveBar,
  SectionCard,
  TextAreaField,
  type CompletionField,
} from '@/components/profile';
import { notify } from '@/lib/notify';
import { isValidAlgerianPhone, normalizeAlgerianPhone } from '@/lib/api/phone';
import {
  ACCOUNT_DOC_MIMES,
  ACCOUNT_IMAGE_MIMES,
  ORG_ACCOUNT_WEBSITE_PATTERN,
  accountMediaUrlOf,
  orgDisplayCode,
  validateAccountFile,
  type AccountUploadProgress,
  type OrgAccount,
  type UpdateOrgAccountInput,
} from '@/lib/api/orgAccount';
import { localizedName } from '@/lib/profile/labels';
import {
  useAccountMediaQuery,
  useOrgAccountCompletionQuery,
  useOrgAccountQuery,
  useOrgLocationsMunicipalitiesQuery,
  useOrgLocationsWilayasQuery,
  useOrgSkillCategoriesQuery,
  usePatchOrgAccountMutation,
  useUploadOrgAccountMedia,
} from '@/hooks/useOrgAccount';

const CURRENT_YEAR = new Date().getFullYear();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COVER_PURPOSE = 'organization_cover';
const LOGO_PURPOSE = 'organization_logo';
const REPORT_PURPOSE = 'organization_document';

export interface OrganizationProfileFormProps {
  mode?: 'profile' | 'onboarding';
}

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
  focusDisciplines: string[];
  operatingScope: string;
}

type MediaSlot = 'cover' | 'logo' | 'report';

type FieldErrors = Partial<Record<keyof FormState, string>>;

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
    focusDisciplines: [...(org.focusDisciplines ?? [])],
    operatingScope: org.operatingScope ?? '',
  };
}

const COMPLETION_FIELDS: readonly { key: string; href: string }[] = [
  { key: 'name', href: '#org-profile-identity' },
  { key: 'description', href: '#org-profile-facts' },
  { key: 'type', href: '#org-profile-facts' },
  { key: 'registrationNumber', href: '#org-profile-facts' },
  { key: 'location', href: '#org-profile-location' },
  { key: 'website', href: '#org-profile-contact' },
  { key: 'foundedYear', href: '#org-profile-facts' },
  { key: 'contact', href: '#org-profile-contact' },
  { key: 'focusDisciplines', href: '#org-profile-facts' },
  { key: 'operatingScope', href: '#org-profile-facts' },
  { key: 'logoMediaId', href: '#org-profile-media' },
  { key: 'coverMediaId', href: '#org-profile-media' },
];

export function OrganizationProfileForm({ mode = 'profile' }: OrganizationProfileFormProps) {
  const t = useTranslations('orgAccount');
  const onboardingT = useTranslations('orgOnboarding');
  const locale = useLocale();
  const orgQuery = useOrgAccountQuery();
  const completionQuery = useOrgAccountCompletionQuery();
  const wilayasQuery = useOrgLocationsWilayasQuery();
  const categoriesQuery = useOrgSkillCategoriesQuery();
  const updateMutation = usePatchOrgAccountMutation();
  const uploadMedia = useUploadOrgAccountMedia();

  const [form, setForm] = useState<FormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [staged, setStaged] = useState<Partial<Record<MediaSlot, string>>>({});
  const [slotErrors, setSlotErrors] = useState<Partial<Record<MediaSlot, string>>>({});
  const [slotProgress, setSlotProgress] = useState<Partial<Record<MediaSlot, number>>>({});

  useEffect(() => {
    if (orgQuery.data && form === null) setForm(fromOrg(orgQuery.data));
  }, [orgQuery.data, form]);

  const municipalitiesQuery = useOrgLocationsMunicipalitiesQuery(form?.wilayaId || undefined);

  const coverId = staged.cover ?? orgQuery.data?.coverMediaId ?? null;
  const logoId = staged.logo ?? orgQuery.data?.logoMediaId ?? null;
  const reportId = staged.report ?? orgQuery.data?.annualReportMediaId ?? null;
  const coverMedia = useAccountMediaQuery(coverId);
  const logoMedia = useAccountMediaQuery(logoId);
  const reportMedia = useAccountMediaQuery(reportId);

  const wilayas = wilayasQuery.data ?? [];
  const municipalities = municipalitiesQuery.data ?? [];

  const categoryOptions = useMemo(
    () =>
      categoriesQuery.data
        ? categoriesQuery.data
            .map((category) => ({
              value: category.id ?? category._id ?? '',
              label: localizedName(category, locale),
            }))
            .filter((option) => option.value !== '')
        : [],
    [categoriesQuery.data, locale],
  );

  if (orgQuery.isPending || completionQuery.isPending) {
    return <Loader label={t('shared.loading')} />;
  }
  if (orgQuery.isError || !orgQuery.data || !form) {
    return (
      <p role="alert" className="text-sm text-status-error">
        {t('shared.loadError')}
      </p>
    );
  }

  const org = orgQuery.data;
  const code = orgDisplayCode(org.registryId);
  const verification =
    org.verificationStatus === 'verified'
      ? t('profile.verificationVerified')
      : org.verificationStatus === 'rejected'
        ? t('profile.verificationRejected')
        : t('profile.verificationPending');
  const completion = completionQuery.data;
  const completionFields: CompletionField[] = COMPLETION_FIELDS.map((field) => ({
    key: field.key,
    href: field.href,
    label: t(`profile.completionFields.${field.key}`),
  }));

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const errors: FieldErrors = {};
    if (form!.contactPhone.trim() !== '' && !isValidAlgerianPhone(form!.contactPhone)) {
      errors.contactPhone = t('profile.invalidPhone');
    }
    if (
      form!.contactEmail.trim() !== '' &&
      !EMAIL_PATTERN.test(form!.contactEmail.trim())
    ) {
      errors.contactEmail = t('profile.invalidEmail');
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
    if (form!.municipalityId !== '' && form!.wilayaId === '') {
      errors.municipalityId = t('profile.invalidLocation');
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function onSlotFile(slot: MediaSlot, file: File | null) {
    if (!file) return;
    const allowed = slot === 'report' ? ACCOUNT_DOC_MIMES : ACCOUNT_IMAGE_MIMES;
    const check = validateAccountFile({ type: file.type, size: file.size }, allowed);
    if (!check.ok) {
      setSlotErrors((prev) => ({
        ...prev,
        [slot]: check.reason === 'size' ? t('profile.fileSizeError') : t('profile.fileTypeError'),
      }));
      notify.error(check.reason === 'size' ? 'error.fileTooLarge' : 'error.fileTypeNotAllowed');
      return;
    }
    if (!consent) {
      setConsentError(t('profile.consentRequired'));
      return;
    }
    setConsentError(null);
    setSlotErrors((prev) => ({ ...prev, [slot]: undefined }));
    setSlotProgress((prev) => ({ ...prev, [slot]: 0 }));
    const purpose =
      slot === 'cover' ? COVER_PURPOSE : slot === 'logo' ? LOGO_PURPOSE : REPORT_PURPOSE;
    try {
      const onProgress = (progress: AccountUploadProgress) =>
        setSlotProgress((prev) => ({ ...prev, [slot]: progress.percent }));
      const mediaId = await uploadMedia(
        { name: file.name, type: file.type, size: file.size, blob: file },
        { purpose, allowed, onProgress },
      );
      setStaged((prev) => ({ ...prev, [slot]: mediaId }));
      notify.success('success.fileUploaded');
    } catch {
      setSlotErrors((prev) => ({ ...prev, [slot]: t('shared.genericError') }));
      notify.error('error.uploadFailed');
    } finally {
      setSlotProgress((prev) => ({ ...prev, [slot]: undefined }));
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    const current = form;
    if (!current) return;

    const trimmed = (value: string) => {
      const next = value.trim();
      return next === '' ? undefined : next;
    };
    const input: UpdateOrgAccountInput = {};
    if (trimmed(current.nameAr)) input.nameAr = trimmed(current.nameAr);
    if (trimmed(current.nameFr)) input.nameFr = trimmed(current.nameFr);
    if (trimmed(current.description)) input.description = trimmed(current.description);
    if (trimmed(current.type)) input.type = trimmed(current.type);
    if (trimmed(current.registrationNumber)) {
      input.registrationNumber = trimmed(current.registrationNumber);
    }
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
      const phone = normalizeAlgerianPhone(current.contactPhone);
      if (phone) input.contact.phone = phone;
    }
    input.focusDisciplines = current.focusDisciplines;
    if (trimmed(current.operatingScope)) input.operatingScope = trimmed(current.operatingScope);
    if (staged.cover) input.coverMediaId = staged.cover;
    if (staged.logo) input.logoMediaId = staged.logo;
    if (staged.report) input.annualReportMediaId = staged.report;

    try {
      await updateMutation.mutateAsync(input);
      setStaged({});
    } catch {
      // Global mutation meta surfaces the failure toast.
    }
  }

  const reportUrl = accountMediaUrlOf(reportMedia.data);

  return (
    <div data-testid="org-profile-facts" className="flex flex-col gap-6">
      <SectionCard
        id="org-profile-identity"
        title={t('profile.identityTitle')}
        description={t('profile.factsHint')}
        action={
          org.slug ? (
            <Link
              data-testid="public-profile-link"
              href={`/orgs/${org.slug}`}
              className="text-sm font-medium text-gold-strong hover:underline"
            >
              {t('profile.publicLinkLabel')}
            </Link>
          ) : undefined
        }
      >
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
      </SectionCard>

      {completion ? (
        <CompletionCard
          title={
            mode === 'onboarding'
              ? onboardingT('completeProfile.checklistTitle')
              : t('profile.completionTitle')
          }
          percent={completion.percent}
          complete={completion.complete}
          missingFields={completion.missingFields}
          fields={completionFields}
          missingLabel={t('profile.completionMissing')}
          completeLabel={t('profile.completionComplete')}
          testId={mode === 'onboarding' ? 'org-checklist' : 'profile-completion'}
        />
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
        <SectionCard
          id="org-profile-facts"
          title={t('profile.factsTitle')}
          testId="org-profile-form-facts"
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                id="org-profile-name-ar"
                label={t('profile.nameArLabel')}
                value={form.nameAr}
                onChange={(event) => set('nameAr', event.target.value)}
                maxLength={200}
              />
              <Input
                id="org-profile-name-fr"
                label={t('profile.nameFrLabel')}
                value={form.nameFr}
                onChange={(event) => set('nameFr', event.target.value)}
                maxLength={200}
              />
            </div>
            <TextAreaField
              id="org-profile-description"
              label={t('profile.descriptionLabel')}
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
              maxLength={2000}
              rows={3}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                id="org-profile-type"
                label={t('profile.typeLabel')}
                value={form.type}
                onChange={(event) => set('type', event.target.value)}
                maxLength={80}
              />
              <Input
                id="org-profile-registration-number"
                label={t('profile.registrationNumberLabel')}
                value={form.registrationNumber}
                onChange={(event) => set('registrationNumber', event.target.value)}
                maxLength={80}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard id="org-profile-location" title={t('profile.locationTitle')}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                id="org-profile-wilaya"
                label={t('profile.wilayaLabel')}
                value={form.wilayaId}
                onChange={(event) => {
                  set('wilayaId', event.target.value);
                  set('municipalityId', '');
                }}
                options={[
                  { value: '', label: t('profile.selectPlaceholder') },
                  ...wilayas.map((wilaya) => ({
                    value: wilaya.code,
                    label: localizedName(wilaya, locale),
                  })),
                ]}
              />
              <Select
                id="org-profile-municipality"
                label={t('profile.municipalityLabel')}
                value={form.municipalityId}
                onChange={(event) => set('municipalityId', event.target.value)}
                disabled={form.wilayaId === ''}
                error={fieldErrors.municipalityId}
                options={[
                  { value: '', label: t('profile.selectPlaceholder') },
                  ...municipalities.map((municipality) => ({
                    value: municipality.code,
                    label: localizedName(municipality, locale),
                  })),
                ]}
              />
            </div>
            <Input
              id="org-profile-address"
              label={t('profile.addressLabel')}
              value={form.address}
              onChange={(event) => set('address', event.target.value)}
              maxLength={500}
            />
          </div>
        </SectionCard>

        <SectionCard id="org-profile-contact" title={t('profile.contactTitle')}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                id="org-profile-website"
                label={t('profile.websiteLabel')}
                placeholder={t('profile.websitePlaceholder')}
                type="url"
                value={form.website}
                onChange={(event) => set('website', event.target.value)}
                error={fieldErrors.website}
                maxLength={500}
              />
              <Input
                id="org-profile-founded-year"
                label={t('profile.foundedYearLabel')}
                type="number"
                min={1800}
                max={CURRENT_YEAR}
                value={form.foundedYear}
                onChange={(event) => set('foundedYear', event.target.value)}
                error={fieldErrors.foundedYear}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                id="org-profile-contact-email"
                label={t('profile.contactEmailLabel')}
                type="email"
                value={form.contactEmail}
                onChange={(event) => set('contactEmail', event.target.value)}
                error={fieldErrors.contactEmail}
                maxLength={254}
              />
              <Input
                id="org-profile-contact-phone"
                label={t('profile.contactPhoneLabel')}
                hint={t('profile.contactPhoneHint')}
                type="tel"
                value={form.contactPhone}
                onChange={(event) => set('contactPhone', event.target.value)}
                error={fieldErrors.contactPhone}
              />
            </div>
            <Input
              id="org-profile-operating-scope"
              label={t('profile.operatingScopeLabel')}
              value={form.operatingScope}
              onChange={(event) => set('operatingScope', event.target.value)}
              maxLength={120}
            />
            <CheckboxMultiSelect
              id="org-profile-focus-disciplines"
              label={t('profile.focusDisciplinesLabel')}
              hint={t('profile.focusDisciplinesHint')}
              options={categoryOptions}
              selected={form.focusDisciplines}
              onChange={(next) => set('focusDisciplines', next)}
              emptyLabel={t('profile.loadingOptions')}
            />
          </div>
        </SectionCard>

        <SectionCard id="org-profile-media" title={t('profile.mediaTitle')} testId="profile-media">
          <div className="flex flex-col gap-5">
            <Checkbox
              id="org-profile-consent"
              label={t('profile.consentLabel')}
              checked={consent}
              onChange={(event) => {
                setConsent(event.target.checked);
                setConsentError(null);
              }}
            />
            {consentError ? (
              <p data-testid="consent-error" className="text-sm text-status-error">
                {consentError}
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <ImageUploader
                id="org-profile-logo"
                label={t('profile.logoTitle')}
                hint={t('profile.logoHint')}
                valueUrl={accountMediaUrlOf(logoMedia.data)}
                onSelect={(file) => onSlotFile('logo', file)}
                onFileError={() => undefined}
                aspect="logo"
                buttonLabel={t('profile.logoChange')}
                emptyLabel={t('profile.logoEmptyBody')}
                error={slotErrors.logo}
                uploading={slotProgress.logo !== undefined}
                progress={slotProgress.logo ?? null}
                testId="logo"
              />
              <ImageUploader
                id="org-profile-cover"
                label={t('profile.coverTitle')}
                hint={t('profile.coverHint')}
                valueUrl={accountMediaUrlOf(coverMedia.data)}
                onSelect={(file) => onSlotFile('cover', file)}
                onFileError={() => undefined}
                aspect="cover"
                buttonLabel={t('profile.coverChange')}
                emptyLabel={t('profile.coverEmptyBody')}
                error={slotErrors.cover}
                uploading={slotProgress.cover !== undefined}
                progress={slotProgress.cover ?? null}
                testId="cover"
              />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-ink">{t('profile.reportTitle')}</p>
              <p className="mb-2 text-sm text-ink-muted">{t('profile.reportHint')}</p>
              {reportUrl ? (
                <a
                  data-testid="report-link"
                  href={reportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-gold-strong hover:underline"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  {t('profile.reportLinkLabel')}
                </a>
              ) : (
                <p data-testid="report-empty" className="text-sm text-ink-muted">
                  {t('profile.reportEmpty')}
                </p>
              )}
              <input
                id="org-profile-report"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) => {
                  void onSlotFile('report', event.target.files?.[0] ?? null);
                  event.target.value = '';
                }}
                className="mt-2 w-full text-sm text-ink"
              />
              {slotErrors.report ? (
                <p className="mt-1 text-sm text-status-error">{slotErrors.report}</p>
              ) : null}
            </div>
          </div>
        </SectionCard>

        {updateMutation.isError ? (
          <p data-testid="profile-form-error" role="alert" className="text-sm text-status-error">
            {t('profile.formError')}
          </p>
        ) : null}

        <SaveBar
          saving={updateMutation.isPending}
          saveLabel={
            mode === 'onboarding' ? onboardingT('completeProfile.save') : t('shared.save')
          }
          savingLabel={
            mode === 'onboarding' ? onboardingT('completeProfile.saving') : t('shared.saving')
          }
          hint={mode === 'onboarding' ? t('profile.onboardingSaveHint') : undefined}
        />
      </form>
    </div>
  );
}
