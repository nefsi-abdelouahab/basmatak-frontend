import { setRequestLocale } from 'next-intl/server';
import { VolunteerDashboardPage } from './VolunteerDashboardPage';

interface DashboardPageProps {
  params: { locale: string };
}

export default function VolunteerDashboardRoute({ params: { locale } }: DashboardPageProps) {
  setRequestLocale(locale);
  return <VolunteerDashboardPage locale={locale} />;
}
