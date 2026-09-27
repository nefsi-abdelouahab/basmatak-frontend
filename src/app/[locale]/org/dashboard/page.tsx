import { setRequestLocale } from 'next-intl/server';
import { OrgDashboardPage } from './OrgDashboardPage';

interface DashboardPageProps {
  params: { locale: string };
}

export default function OrgDashboardRoute({ params: { locale } }: DashboardPageProps) {
  setRequestLocale(locale);
  return <OrgDashboardPage locale={locale} />;
}
