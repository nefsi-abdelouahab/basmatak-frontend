import { setRequestLocale } from 'next-intl/server';
import { AdminVolunteersPage } from './AdminVolunteersPage';
import { RequireAdminManage } from '../RequireAdminManage';

interface AdminVolunteersRouteProps {
  params: { locale: string };
}

export default function AdminVolunteersRoute({ params: { locale } }: AdminVolunteersRouteProps) {
  setRequestLocale(locale);
  return (
    <RequireAdminManage locale={locale} next={`/admin/volunteers`}>
      <AdminVolunteersPage />
    </RequireAdminManage>
  );
}
