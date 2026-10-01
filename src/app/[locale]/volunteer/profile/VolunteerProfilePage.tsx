'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { useVolunteerDashboardQuery, useVolunteerMeQuery } from '@/hooks/useVolunteerAccount';
import { IdentityForm } from './IdentityForm';
import { AvatarUploader } from './AvatarUploader';
import { SkillsManager } from './SkillsManager';
import { AvailabilityEditor } from './AvailabilityEditor';
import { VisibilityToggles } from './VisibilityToggles';
import { RequireVolunteer, SectionError } from '../components';

function CompletionCard() {
  const t = useTranslations('volunteerAccount');
  const dashboardQuery = useVolunteerDashboardQuery();
  if (dashboardQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (dashboardQuery.isError)
    return <SectionError testId="completion-error" message={t('shared.loadError')} />;
  return (
    <Card title={t('profile.completionTitle')}>
      <p data-testid="profile-completion" className="text-2xl font-semibold text-ink">
        {t('profile.completionValue', {
          percent: dashboardQuery.data.completionPercent,
        })}
      </p>
    </Card>
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
      className="text-sm font-medium text-primary"
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
          <div>
            <h1 className="text-2xl font-bold text-ink">{t('profile.title')}</h1>
            <p className="text-sm text-ink-muted">{t('profile.subtitle')}</p>
          </div>
          <PublicLink />
        </div>
        <CompletionCard />
        <AvatarUploader />
        <IdentityForm />
        <SkillsManager locale={locale} />
        <AvailabilityEditor />
        <VisibilityToggles />
      </div>
    </RequireVolunteer>
  );
}
