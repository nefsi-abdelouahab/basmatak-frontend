import { setRequestLocale } from 'next-intl/server';
import { OrgApplicationDetailPage } from './OrgApplicationDetailPage';

interface ApplicationDetailRouteProps {
  params: { locale: string; applicationId: string };
}

export default function OrgApplicationDetailRoute({
  params: { locale, applicationId },
}: ApplicationDetailRouteProps) {
  setRequestLocale(locale);
  return <OrgApplicationDetailPage locale={locale} applicationId={applicationId} />;
}
