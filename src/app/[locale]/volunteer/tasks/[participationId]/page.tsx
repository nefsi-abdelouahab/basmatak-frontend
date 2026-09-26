import { setRequestLocale } from 'next-intl/server';
import { VolunteerTaskDetailPage } from './VolunteerTaskDetailPage';

interface TaskDetailRouteProps {
  params: { locale: string; participationId: string };
}

export default function VolunteerTaskDetailRoute({
  params: { locale, participationId },
}: TaskDetailRouteProps) {
  setRequestLocale(locale);
  return <VolunteerTaskDetailPage locale={locale} participationId={participationId} />;
}
