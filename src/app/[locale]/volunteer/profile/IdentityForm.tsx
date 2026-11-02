'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  CheckboxMultiSelect,
  SaveBar,
  SectionCard,
  TextAreaField,
} from '@/components/profile';
import { UpdateVolunteerProfileSchema } from '@/lib/api/volunteers';
import { localizedName } from '@/lib/profile/labels';
import {
  usePatchVolunteerMeMutation,
  useProfileMunicipalitiesQuery,
  useProfileWilayasQuery,
  useSkillCategoriesQuery,
  useVolunteerMeQuery,
} from '@/hooks/useVolunteerAccount';

interface FormState {
  firstName: string;
  lastName: string;
  headline: string;
  bio: string;
  birthDate: string;
  wilayaId: string;
  municipalityId: string;
  availabilityNote: string;
  preferredDomains: string[];
  geographicBase: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

function dateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export function IdentityForm({ locale }: { locale: string }) {
  const t = useTranslations('volunteerAccount');
  const activeLocale = useLocale() || locale;
  const meQuery = useVolunteerMeQuery();
  const categoriesQuery = useSkillCategoriesQuery();
  const patch = usePatchVolunteerMeMutation();
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const me = meQuery.data;
  const categories = categoriesQuery.data ?? [];
  useEffect(() => {
    if (!me || form !== null || categoriesQuery.isPending) return;
    // Stored domains are display names (legacy free text or previously saved
    // localized category names). Resolve them back to category ids so the
    // localized multi-select stays stable if the interface language changes.
    const ids = (me.preferredDomains ?? [])
      .map((domain) => {
        const match = (categoriesQuery.data ?? []).find(
          (category) =>
            (category.id ?? category._id) === domain ||
            localizedName(category, 'fr') === domain ||
            localizedName(category, 'ar') === domain ||
            category.name === domain,
        );
        return match ? (match.id ?? match._id ?? '') : '';
      })
      .filter((id) => id !== '');
    setForm({
      firstName: me.firstName ?? '',
      lastName: me.lastName ?? '',
      headline: me.headline ?? '',
      bio: me.bio ?? '',
      birthDate: dateInputValue(me.birthDate),
      wilayaId: me.location?.wilayaId ?? '',
      municipalityId: me.location?.municipalityId ?? '',
      availabilityNote: me.availabilityNote ?? '',
      preferredDomains: ids,
      geographicBase: me.geographicBase ?? '',
    });
  }, [me, form, categoriesQuery.isPending, categoriesQuery.data]);

  const municipalitiesQuery = useProfileMunicipalitiesQuery(form?.wilayaId || undefined);
  const wilayasQuery = useProfileWilayasQuery();

  if (meQuery.isPending || (!meQuery.isError && form === null)) {
    return (
      <SectionCard id="profile-identity" title={t('profile.identityTitle')} testId="profile-identity">
        <p className="text-sm text-ink-muted">{t('shared.loading')}</p>
      </SectionCard>
    );
  }
  if (meQuery.isError || !me || !form) {
    return (
      <SectionCard id="profile-identity" title={t('profile.identityTitle')} testId="profile-identity">
        <p role="alert" className="text-sm text-status-error">
          {t('shared.loadError')}
        </p>
      </SectionCard>
    );
  }

  const wilayas = wilayasQuery.data ?? [];
  const municipalities = municipalitiesQuery.data ?? [];

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    if (form!.firstName.trim() === '') next.firstName = t('shared.required');
    if (form!.lastName.trim() === '') next.lastName = t('shared.required');
    if (form!.headline.trim().length > 120) next.headline = t('profile.maxLength', { max: 120 });
    if (form!.bio.trim().length > 2000) next.bio = t('profile.maxLength', { max: 2000 });
    if (form!.availabilityNote.trim().length > 500) {
      next.availabilityNote = t('profile.maxLength', { max: 500 });
    }
    if (form!.geographicBase.trim().length > 120) {
      next.geographicBase = t('profile.maxLength', { max: 120 });
    }
    if (form!.preferredDomains.length > 10) {
      next.preferredDomains = t('profile.maxDomains', { max: 10 });
    }
    if (form!.birthDate !== '') {
      const parsed = new Date(`${form!.birthDate}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now()) {
        next.birthDate = t('profile.invalidBirthDate');
      }
    }
    if (form!.municipalityId !== '' && form!.wilayaId === '') {
      next.municipalityId = t('profile.locationRequiresWilaya');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    const input: Record<string, unknown> = {
      firstName: form!.firstName.trim(),
      lastName: form!.lastName.trim(),
      headline: form!.headline.trim(),
      bio: form!.bio.trim(),
      availabilityNote: form!.availabilityNote.trim(),
      geographicBase: form!.geographicBase.trim(),
    };
    if (categoriesQuery.isSuccess) {
      // Persist display names, not raw category ids: the public talent page
      // renders preferredDomains directly.
      input.preferredDomains = form!.preferredDomains
        .map((id) => categoryOptions.find((option) => option.value === id)?.label ?? '')
        .filter((label) => label !== '');
    }
    if (form!.birthDate !== '') input.birthDate = form!.birthDate;
    if (form!.wilayaId !== '' || form!.municipalityId !== '') {
      input.location = {};
      if (form!.wilayaId !== '') (input.location as Record<string, string>).wilayaId = form!.wilayaId;
      if (form!.municipalityId !== '') {
        (input.location as Record<string, string>).municipalityId = form!.municipalityId;
      }
    }
    const parsed = UpdateVolunteerProfileSchema.safeParse(input);
    if (!parsed.success) {
      setErrors({ ...errors, headline: t('shared.genericError') });
      return;
    }
    try {
      await patch.mutateAsync(parsed.data);
    } catch {
      // Global mutation meta surfaces the failure toast.
    }
  }

  const categoryOptions = categories
    .map((category) => ({
      value: category.id ?? category._id ?? '',
      label: localizedName(category, activeLocale),
    }))
    .filter((option) => option.value !== '');

  return (
    <SectionCard
      id="profile-identity"
      title={t('profile.identityTitle')}
      description={t('profile.identityHint')}
      testId="profile-identity"
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            id="profile-first-name"
            label={t('profile.firstNameLabel')}
            value={form.firstName}
            onChange={(event) => set('firstName', event.target.value)}
            error={errors.firstName}
            maxLength={80}
          />
          <Input
            id="profile-last-name"
            label={t('profile.lastNameLabel')}
            value={form.lastName}
            onChange={(event) => set('lastName', event.target.value)}
            error={errors.lastName}
            maxLength={80}
          />
        </div>
        <Input
          id="profile-headline"
          label={t('profile.headlineLabel')}
          hint={t('profile.headlineHint')}
          value={form.headline}
          onChange={(event) => set('headline', event.target.value)}
          error={errors.headline}
          maxLength={120}
        />
        <TextAreaField
          id="profile-bio"
          label={t('profile.bioLabel')}
          value={form.bio}
          onChange={(event) => set('bio', event.target.value)}
          error={errors.bio}
          maxLength={2000}
          rows={4}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            id="profile-birth-date"
            label={t('profile.birthDateLabel')}
            type="date"
            value={form.birthDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => set('birthDate', event.target.value)}
            error={errors.birthDate}
          />
          <Input
            id="profile-base"
            label={t('profile.baseLabel')}
            value={form.geographicBase}
            onChange={(event) => set('geographicBase', event.target.value)}
            error={errors.geographicBase}
            maxLength={120}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            id="profile-wilaya"
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
                label: localizedName(wilaya, activeLocale),
              })),
            ]}
          />
          <Select
            id="profile-municipality"
            label={t('profile.municipalityLabel')}
            value={form.municipalityId}
            onChange={(event) => set('municipalityId', event.target.value)}
            disabled={form.wilayaId === ''}
            error={errors.municipalityId}
            options={[
              { value: '', label: t('profile.selectPlaceholder') },
              ...municipalities.map((municipality) => ({
                value: municipality.code,
                label: localizedName(municipality, activeLocale),
              })),
            ]}
          />
        </div>
        <TextAreaField
          id="profile-availability-note"
          label={t('profile.availabilityNoteLabel')}
          value={form.availabilityNote}
          onChange={(event) => set('availabilityNote', event.target.value)}
          error={errors.availabilityNote}
          maxLength={500}
          rows={2}
        />
        <CheckboxMultiSelect
          id="profile-domains"
          label={t('profile.domainsLabel')}
          hint={t('profile.domainsHint')}
          options={categoryOptions}
          selected={form.preferredDomains}
          onChange={(next) => set('preferredDomains', next.slice(0, 10))}
          emptyLabel={t('profile.loadingOptions')}
        />
        {errors.preferredDomains ? (
          <p className="text-sm text-status-error">{errors.preferredDomains}</p>
        ) : null}
        <SaveBar
          saving={patch.isPending}
          saveLabel={t('shared.save')}
          savingLabel={t('shared.saving')}
        />
      </form>
    </SectionCard>
  );
}
