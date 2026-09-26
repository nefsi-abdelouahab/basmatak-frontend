'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Select } from '@/components/ui/Select';
import { SessionExpiredScreen } from '@/components/system/SessionExpiredScreen';
import { ServerErrorScreen } from '@/components/system/ServerErrorScreen';
import { errorStateFor, mapToApiError } from '@/lib/api/errors';
import { defaultTokenHooks } from '@/lib/auth/storage';
import {
  COVER_MIMES,
  ORG_PHONE_PATTERN,
  ORG_WEBSITE_PATTERN,
  validateUploadFile,
  type Organization,
  type UpdateOrganizationInput,
} from '@/lib/api/organizations';
import {
  useDeleteOrganizationMutation,
  useMunicipalitiesQuery,
  useOwnOrganizationQuery,
  useProfileCompletionQuery,
  useUpdateOrganizationMutation,
  useUploadOrgMedia,
  useWilayasQuery,
} from '@/hooks/useOrgOnboarding';

const MONGO_ID = /^[0-9a-fA-F]{24}$/;
const CURRENT_YEAR = new Date().getFullYear();

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

function fromOrg(org: Organization): FormState {
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

export function CompleteProfileForm() {
  const t = useTranslations('orgOnboarding');
  const router = useRouter();
  const orgQuery = useOwnOrganizationQuery();
  const completionQuery = useProfileCompletionQuery();
  const wilayasQuery = useWilayasQuery();
  const updateMutation = useUpdateOrganizationMutation();
  const deleteMutation = useDeleteOrganizationMutation();
  const uploadMedia = useUploadOrgMedia();

  const [form, setForm] = useState<FormState | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (orgQuery.data && form === null) setForm(fromOrg(orgQuery.data));
  }, [orgQuery.data, form]);

  const municipalitiesQuery = useMunicipalitiesQuery(form?.wilayaId || undefined);

  if (orgQuery.isPending || completionQuery.isPending) {
    return (
      <Card>
        <div data-testid="org-complete-profile-loading">
          <Loader label={t('completeProfile.loading')} />
          <p className="mt-2 text-ink-muted">{t('completeProfile.loading')}</p>
        </div>
      </Card>
    );
  }

  if (orgQuery.isError) {
    const state = errorStateFor(mapToApiError(orgQuery.error));
    if (state === 'session-expired') return <SessionExpiredScreen />;
    return <ServerErrorScreen />;
  }

  if (!form) return null;

  const set = (key: keyof FormState) => (value: string) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  };

  function validate(): boolean {
    const errors: Partial<Record<keyof FormState, string>> = {};
    if (form!.contactPhone.trim() !== '' && !ORG_PHONE_PATTERN.test(form!.contactPhone.trim())) {
      errors.contactPhone = t('completeProfile.invalidPhone');
    }
    if (form!.website.trim() !== '' && !ORG_WEBSITE_PATTERN.test(form!.website.trim())) {
      errors.website = t('completeProfile.invalidWebsite');
    }
    if (form!.foundedYear.trim() !== '') {
      const year = Number(form!.foundedYear);
      if (!Number.isInteger(year) || year < 1800 || year > CURRENT_YEAR) {
        errors.foundedYear = t('completeProfile.invalidYear');
      }
    }
    const disciplines = form!.focusDisciplines
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (disciplines.some((d) => !MONGO_ID.test(d))) {
      errors.focusDisciplines = t('completeProfile.genericError');
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSaved(false);
    if (!validate()) return;
    const current = form;
    if (!current) return;

    const disciplines = current.focusDisciplines
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      let coverMediaId: string | undefined;
      if (coverFile) {
        const check = validateUploadFile(
          { type: coverFile.type, size: coverFile.size },
          COVER_MIMES,
        );
        if (!check.ok) {
          setCoverError(
            check.reason === 'size'
              ? t('dossier.fileSizeError')
              : t('dossier.fileTypeError'),
          );
          return;
        }
        coverMediaId = await uploadMedia(
          { name: coverFile.name, type: coverFile.type, size: coverFile.size, blob: coverFile },
          { purpose: 'organization_cover', allowed: COVER_MIMES },
        );
      }

      const input: UpdateOrganizationInput = {};
      const trimmed = (s: string) => (s.trim() === '' ? undefined : s.trim());
      if (trimmed(form.nameAr)) input.nameAr = trimmed(form.nameAr);
      if (trimmed(form.nameFr)) input.nameFr = trimmed(form.nameFr);
      if (trimmed(form.description)) input.description = trimmed(form.description);
      if (trimmed(form.type)) input.type = trimmed(form.type);
      if (trimmed(form.registrationNumber))
        input.registrationNumber = trimmed(form.registrationNumber);
      if (form.wilayaId !== '' || form.municipalityId !== '' || trimmed(form.address)) {
        input.location = {};
        if (form.wilayaId !== '') input.location.wilayaId = form.wilayaId;
        if (form.municipalityId !== '') input.location.municipalityId = form.municipalityId;
        if (trimmed(form.address)) input.location.address = trimmed(form.address);
      }
      if (trimmed(form.website)) input.website = trimmed(form.website);
      if (trimmed(form.foundedYear)) input.foundedYear = Number(trimmed(form.foundedYear));
      if (trimmed(form.contactEmail) || trimmed(form.contactPhone)) {
        input.contact = {};
        if (trimmed(form.contactEmail)) input.contact.email = trimmed(form.contactEmail);
        if (trimmed(form.contactPhone)) input.contact.phone = trimmed(form.contactPhone);
      }
      if (disciplines.length > 0) input.focusDisciplines = disciplines;
      if (trimmed(form.operatingScope)) input.operatingScope = trimmed(form.operatingScope);
      if (coverMediaId) input.coverMediaId = coverMediaId;

      await updateMutation.mutateAsync(input);
      setCoverFile(null);
      setSaved(true);
    } catch {
      setFormError(t('completeProfile.genericError'));
    }
  }

  async function onDelete() {
    try {
      await deleteMutation.mutateAsync();
      defaultTokenHooks.clearTokens();
      router.replace('/login');
    } catch {
      setFormError(t('completeProfile.genericError'));
    }
  }

  const completion = completionQuery.data;
  const wilayas = wilayasQuery.data ?? [];
  const municipalities = municipalitiesQuery.data ?? [];

  return (
    <div data-testid="org-complete-profile" className="flex flex-col gap-6">
      <Card>
        <h1 className="mb-1 text-2xl font-bold text-ink">{t('completeProfile.title')}</h1>
        <p className="mb-6 text-ink-muted">{t('completeProfile.subtitle')}</p>

        {completion ? (
          <div
            data-testid="org-checklist"
            className="mb-6 rounded-md border border-border bg-surface-muted px-4 py-3"
          >
            <p className="text-sm font-medium text-ink">
              {t('completeProfile.checklistTitle')}: {completion.percent}%{' '}
              {completion.complete ? `· ${t('completeProfile.completeLabel')}` : null}
            </p>
            {!completion.complete ? (
              <p className="mt-1 text-sm text-ink-muted">
                {t('completeProfile.missingLabel')}: {completion.missing.join(', ')}
              </p>
            ) : null}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              id="org-name-ar"
              label={t('completeProfile.nameArLabel')}
              value={form.nameAr}
              onChange={(e) => set('nameAr')(e.target.value)}
              maxLength={200}
            />
            <Input
              id="org-name-fr"
              label={t('completeProfile.nameFrLabel')}
              value={form.nameFr}
              onChange={(e) => set('nameFr')(e.target.value)}
              maxLength={200}
            />
          </div>
          <div>
            <label htmlFor="org-description" className="mb-1 block text-sm font-medium text-ink">
              {t('completeProfile.descriptionLabel')}
            </label>
            <textarea
              id="org-description"
              value={form.description}
              onChange={(e) => set('description')(e.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink focus:border-primary focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              id="org-type"
              label={t('completeProfile.typeLabel')}
              value={form.type}
              onChange={(e) => set('type')(e.target.value)}
            />
            <Input
              id="org-registration-number"
              label={t('completeProfile.registrationNumberLabel')}
              value={form.registrationNumber}
              onChange={(e) => set('registrationNumber')(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              id="org-wilaya"
              label={t('completeProfile.wilayaLabel')}
              value={form.wilayaId}
              onChange={(e) => {
                set('wilayaId')(e.target.value);
                set('municipalityId')('');
              }}
              options={[
                { value: '', label: t('completeProfile.selectPlaceholder') },
                ...wilayas.map((w) => ({ value: w.code, label: w.nameFr })),
              ]}
            />
            <Select
              id="org-municipality"
              label={t('completeProfile.municipalityLabel')}
              value={form.municipalityId}
              onChange={(e) => set('municipalityId')(e.target.value)}
              disabled={form.wilayaId === ''}
              options={[
                { value: '', label: t('completeProfile.selectPlaceholder') },
                ...municipalities.map((m) => ({ value: m.code, label: m.nameFr })),
              ]}
            />
          </div>
          <Input
            id="org-address"
            label={t('completeProfile.addressLabel')}
            value={form.address}
            onChange={(e) => set('address')(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              id="org-website"
              label={t('completeProfile.websiteLabel')}
              type="url"
              value={form.website}
              onChange={(e) => set('website')(e.target.value)}
              error={fieldErrors.website}
            />
            <Input
              id="org-founded-year"
              label={t('completeProfile.foundedYearLabel')}
              type="number"
              value={form.foundedYear}
              onChange={(e) => set('foundedYear')(e.target.value)}
              error={fieldErrors.foundedYear}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              id="org-contact-email"
              label={t('completeProfile.contactEmailLabel')}
              type="email"
              value={form.contactEmail}
              onChange={(e) => set('contactEmail')(e.target.value)}
            />
            <Input
              id="org-contact-phone"
              label={t('completeProfile.contactPhoneLabel')}
              type="tel"
              value={form.contactPhone}
              onChange={(e) => set('contactPhone')(e.target.value)}
              error={fieldErrors.contactPhone}
            />
          </div>
          <Input
            id="org-focus-disciplines"
            label={t('completeProfile.focusDisciplinesLabel')}
            hint={t('completeProfile.focusDisciplinesHint')}
            value={form.focusDisciplines}
            onChange={(e) => set('focusDisciplines')(e.target.value)}
            error={fieldErrors.focusDisciplines}
          />
          <Input
            id="org-operating-scope"
            label={t('completeProfile.operatingScopeLabel')}
            value={form.operatingScope}
            onChange={(e) => set('operatingScope')(e.target.value)}
          />
          <div>
            <label htmlFor="org-cover" className="mb-1 block text-sm font-medium text-ink">
              {t('completeProfile.coverLabel')}
            </label>
            <input
              id="org-cover"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                setCoverFile(e.target.files?.[0] ?? null);
                setCoverError(null);
              }}
              className="w-full text-sm text-ink"
            />
            <p className="mt-1 text-sm text-ink-muted">{t('completeProfile.coverHint')}</p>
            {coverError ? <p className="mt-1 text-sm text-status-error">{coverError}</p> : null}
          </div>

          {formError ? (
            <p data-testid="org-form-error" className="text-sm text-status-error">
              {formError}
            </p>
          ) : null}
          {saved ? (
            <p data-testid="org-form-saved" className="text-sm text-status-success">
              {t('completeProfile.saved')}
            </p>
          ) : null}
          <div>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending
                ? t('completeProfile.saving')
                : t('completeProfile.save')}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-semibold text-ink">{t('completeProfile.deleteTitle')}</h2>
        <p className="mb-4 text-sm text-ink-muted">{t('completeProfile.deleteDescription')}</p>
        {confirmingDelete ? (
          <div className="flex flex-wrap gap-3">
            <Button
              variant="danger"
              onClick={onDelete}
              disabled={deleteMutation.isPending}
            >
              {t('completeProfile.deleteConfirm')}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
              {t('completeProfile.deleteCancel')}
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirmingDelete(true)}>
            {t('completeProfile.deleteCta')}
          </Button>
        )}
      </Card>
    </div>
  );
}
