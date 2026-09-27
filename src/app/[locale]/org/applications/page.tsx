import { setRequestLocale } from 'next-intl/server';
import { OrgApplicationsPage } from './OrgApplicationsPage';

interface ApplicationsPageProps {
  params: { locale: string };
}

export default function OrgApplicationsRoute({ params: { locale } }: ApplicationsPageProps) {
  setRequestLocale(locale);
  return <OrgApplicationsPage locale={locale} />;
}
