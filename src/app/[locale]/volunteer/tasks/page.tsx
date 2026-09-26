import { setRequestLocale } from 'next-intl/server';
import { VolunteerTasksPage } from './VolunteerTasksPage';

interface TasksPageProps {
  params: { locale: string };
}

export default function VolunteerTasksRoute({ params: { locale } }: TasksPageProps) {
  setRequestLocale(locale);
  return <VolunteerTasksPage locale={locale} />;
}
