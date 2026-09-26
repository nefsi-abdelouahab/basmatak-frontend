'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { UpdateVolunteerProfileSchema } from '@/lib/api/volunteers';
import { usePatchVolunteerMeMutation, useVolunteerMeQuery } from '@/hooks/useVolunteerAccount';
import { SectionError } from '../components';

export function IdentityForm() {
  const t = useTranslations('volunteerAccount');
  const meQuery = useVolunteerMeQuery();
  const patch = usePatchVolunteerMeMutation();
  const me = meQuery.data;
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [headline, setHeadline] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [availabilityNote, setAvailabilityNote] = useState<string | null>(null);
  const [geographicBase, setGeographicBase] = useState<string | null>(null);
  const [domains, setDomains] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!me) return null;
  const str = (v: string | null | undefined): string => v ?? '';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    const input = {
      firstName: str(firstName ?? me?.firstName) || undefined,
      lastName: str(lastName ?? me?.lastName) || undefined,
      headline: str(headline ?? me?.headline) || undefined,
      bio: str(bio ?? me?.bio) || undefined,
      availabilityNote: str(availabilityNote ?? me?.availabilityNote) || undefined,
      geographicBase: str(geographicBase ?? me?.geographicBase) || undefined,
      preferredDomains:
        domains === null
          ? undefined
          : domains
              .split(',')
              .map((d) => d.trim())
              .filter((d) => d.length > 0),
    };
    const parsed = UpdateVolunteerProfileSchema.safeParse(input);
    if (!parsed.success) return;
    try {
      await patch.mutateAsync(parsed.data);
      setSaved(true);
    } catch {
      // surfaced below via patch.isError
    }
  }

  return (
    <Card title={t('profile.identityTitle')}>
      <form data-testid="profile-identity" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            id="profile-first-name"
            label={t('profile.firstNameLabel')}
            value={str(firstName ?? me.firstName)}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Input
            id="profile-last-name"
            label={t('profile.lastNameLabel')}
            value={str(lastName ?? me.lastName)}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <Input
          id="profile-headline"
          label={t('profile.headlineLabel')}
          hint={t('profile.headlineHint')}
          value={str(headline ?? me.headline)}
          onChange={(e) => setHeadline(e.target.value)}
        />
        <Input
          id="profile-bio"
          label={t('profile.bioLabel')}
          value={str(bio ?? me.bio)}
          onChange={(e) => setBio(e.target.value)}
        />
        <Input
          id="profile-availability-note"
          label={t('profile.availabilityNoteLabel')}
          value={str(availabilityNote ?? me.availabilityNote)}
          onChange={(e) => setAvailabilityNote(e.target.value)}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            id="profile-domains"
            label={t('profile.domainsLabel')}
            hint={t('profile.domainsHint')}
            value={domains ?? (me.preferredDomains ?? []).join(', ')}
            onChange={(e) => setDomains(e.target.value)}
          />
          <Input
            id="profile-base"
            label={t('profile.baseLabel')}
            value={str(geographicBase ?? me.geographicBase)}
            onChange={(e) => setGeographicBase(e.target.value)}
          />
        </div>
        {patch.isError ? <SectionError testId="profile-error" message={t('profile.saveError')} /> : null}
        {saved && !patch.isError ? (
          <p data-testid="profile-saved" className="text-sm text-status-success">
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
