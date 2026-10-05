import { setRequestLocale } from 'next-intl/server';
import { AdminAuditLogsPage } from './AdminAuditLogsPage';

interface AdminAuditLogsRouteProps {
  params: { locale: string };
}

export default function AdminAuditLogsRoute({ params: { locale } }: AdminAuditLogsRouteProps) {
  setRequestLocale(locale);
  return <AdminAuditLogsPage locale={locale} />;
}
