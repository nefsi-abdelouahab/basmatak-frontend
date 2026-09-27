import { setRequestLocale } from 'next-intl/server';
import { AdminOrganizationsPage } from './AdminOrganizationsPage';
import { RequireAdminManage } from '../RequireAdminManage';

interface AdminOrganizationsRouteProps {
  params: { locale: string };
}

export default function AdminOrganizationsRoute({ params: { locale } }: AdminOrganizationsRouteProps) {
  setRequestLocale(locale);
  return (
    <RequireAdminManage locale={locale} next={`/${locale}/admin/organizations`}>
      <AdminOrganizationsPage />
    </RequireAdminManage>
  );
}
