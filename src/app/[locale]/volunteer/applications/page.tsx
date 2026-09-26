import { setRequestLocale } from 'next-intl/server';
import { VolunteerApplicationsPage } from './VolunteerApplicationsPage';

interface ApplicationsPageProps {
  params: { locale: string };
}

export default function VolunteerApplicationsRoute({ params: { locale } }: ApplicationsPageProps) {
  setRequestLocale(locale);
  return <VolunteerApplicationsPage locale={locale} />;
}
