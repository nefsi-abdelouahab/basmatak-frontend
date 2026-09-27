'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ApplicationDetail } from '../ApplicationDetail';
import { RequireTasks, SectionError } from '../components';

// F6-owned deep-linkable application detail page (OQ2-approved shape).
export function VolunteerApplicationDetailPage({
  locale,
  applicationId,
}: {
  locale: string;
  applicationId: string;
}) {
  const t = useTranslations('volunteerTasks');
  if (!applicationId) {
    return <SectionError testId="application-detail-error" message={t('applications.detailError')} />;
  }
  return (
    <RequireTasks locale={locale} next={`/volunteer/applications/${applicationId}`}>
      <div
        data-testid="volunteer-application-detail"
        className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4"
      >
        <Link
          href="/volunteer/applications"
          className="text-sm font-medium text-primary"
        >
          {t('applications.title')}
        </Link>
        <ApplicationDetail applicationId={applicationId} locale={locale} />
      </div>
    </RequireTasks>
  );
}
