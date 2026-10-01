'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ParticipationDetail } from '../ParticipationDetail';
import { RequireTasks } from '../../applications/components';

// F6-owned deep-linkable participation detail page (OQ2-approved shape).
export function VolunteerTaskDetailPage({
  locale,
  participationId,
}: {
  locale: string;
  participationId: string;
}) {
  const t = useTranslations('volunteerTasks');
  return (
    <RequireTasks locale={locale} next={`/volunteer/tasks/${participationId}`}>
      <div
        data-testid="volunteer-task-detail"
        className="flex min-w-0 flex-col gap-4"
      >
        <Link href="/volunteer/tasks" className="text-sm font-medium text-primary">
          {t('participations.title')}
        </Link>
        <ParticipationDetail participationId={participationId} locale={locale} />
      </div>
    </RequireTasks>
  );
}
