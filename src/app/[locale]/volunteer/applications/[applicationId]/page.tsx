import { setRequestLocale } from 'next-intl/server';
import { VolunteerApplicationDetailPage } from './VolunteerApplicationDetailPage';

interface ApplicationDetailRouteProps {
  params: { locale: string; applicationId: string };
}

export default function VolunteerApplicationDetailRoute({
  params: { locale, applicationId },
}: ApplicationDetailRouteProps) {
  setRequestLocale(locale);
  return <VolunteerApplicationDetailPage locale={locale} applicationId={applicationId} />;
}
