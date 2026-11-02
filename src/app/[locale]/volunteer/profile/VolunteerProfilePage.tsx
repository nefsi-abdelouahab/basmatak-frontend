'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Loader } from '@/components/ui/Loader';
import { CompletionCard, type CompletionField } from '@/components/profile';
import {
  useVolunteerDashboardQuery,
  useVolunteerMeQuery,
  useVolunteerProfileCompletionQuery,
} from '@/hooks/useVolunteerAccount';
import { IdentityForm } from './IdentityForm';
import { ProfileMedia } from './ProfileMedia';
import { SkillsManager } from './SkillsManager';
import { AvailabilityEditor } from './AvailabilityEditor';
import { VisibilityToggles } from './VisibilityToggles';
import { RequireVolunteer } from '../components';

const COMPLETION_FIELDS: readonly { key: string; href: string }[] = [
  { key: 'name', href: '#profile-identity' },
  { key: 'headline', href: '#profile-identity' },
  { key: 'bio', href: '#profile-identity' },
  { key: 'birthDate', href: '#profile-identity' },
  { key: 'location', href: '#profile-identity' },
  { key: 'avatar', href: '#profile-media' },
  { key: 'banner', href: '#profile-media' },
  { key: 'skills', href: '#profile-skills' },
  { key: 'availability', href: '#profile-availability' },
  { key: 'availabilityNote', href: '#profile-identity' },
  { key: 'preferredDomains', href: '#profile-identity' },
  { key: 'geographicBase', href: '#profile-identity' },
];

function CompletionSection() {
  const t = useTranslations('volunteerAccount');
  const completionQuery = useVolunteerProfileCompletionQuery();
  const dashboardQuery = useVolunteerDashboardQuery();

  if (completionQuery.isPending && dashboardQuery.isPending) {
    return <Loader label={t('shared.loading')} />;
  }

  // Prefer the dedicated endpoint; the dashboard payload carries the same
  // backend-authoritative object, so it is a safe fallback if one read fails.
  const completion =
    completionQuery.data ??
    dashboardQuery.data?.completion ?? {
      percent: dashboardQuery.data?.completionPercent ?? 0,
      missingFields: [],
      complete: false,
    };

  const fields: CompletionField[] = COMPLETION_FIELDS.map((field) => ({
    key: field.key,
    href: field.href,
    label: t(`completion.fields.${field.key}`),
  }));

  return (
    <CompletionCard
      title={t('profile.completionTitle')}
      percent={completion.percent}
      complete={completion.complete}
      missingFields={completion.missingFields}
      fields={fields}
      missingLabel={t('profile.completionMissing')}
      completeLabel={t('profile.completionComplete')}
    />
  );
}

function PublicLink() {
  const t = useTranslations('volunteerAccount');
  const meQuery = useVolunteerMeQuery();
  if (!meQuery.data) return null;
  return (
    <Link
      data-testid="public-profile-link"
      href={`/volunteer/talents/${meQuery.data.username}`}
      className="text-sm font-medium text-gold-strong hover:underline"
    >
      {t('profile.viewPublic')}
    </Link>
  );
}

export function VolunteerProfilePage({ locale }: { locale: string }) {
  const t = useTranslations('volunteerAccount');
  return (
    <RequireVolunteer locale={locale} next={`/volunteer/profile`}>
      <div data-testid="volunteer-profile" className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-ink">{t('profile.title')}</h1>
            <p className="text-sm text-ink-muted">{t('profile.subtitle')}</p>
          </div>
          <PublicLink />
        </div>
        <CompletionSection />
        <ProfileMedia />
        <IdentityForm locale={locale} />
        <SkillsManager locale={locale} />
        <AvailabilityEditor />
        <VisibilityToggles />
      </div>
    </RequireVolunteer>
  );
}
