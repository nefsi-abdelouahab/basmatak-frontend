import { setRequestLocale } from 'next-intl/server';
import { AdminReportsPage } from './AdminReportsPage';

interface AdminReportsRouteProps {
  params: { locale: string };
}

export default function AdminReportsRoute({ params: { locale } }: AdminReportsRouteProps) {
  setRequestLocale(locale);
  return <AdminReportsPage locale={locale} />;
}
