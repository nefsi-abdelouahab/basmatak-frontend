import { setRequestLocale } from 'next-intl/server';
import { AdminVerificationsPage } from './AdminVerificationsPage';
import { RequireAdminManage } from '../RequireAdminManage';

interface AdminVerificationsRouteProps {
  params: { locale: string };
}

export default function AdminVerificationsRoute({ params: { locale } }: AdminVerificationsRouteProps) {
  setRequestLocale(locale);
  return (
    <RequireAdminManage locale={locale} next={`/${locale}/admin/verifications`}>
      <AdminVerificationsPage />
    </RequireAdminManage>
  );
}
