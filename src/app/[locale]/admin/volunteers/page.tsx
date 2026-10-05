import { setRequestLocale } from 'next-intl/server';
import { AdminVolunteersPage } from './AdminVolunteersPage';
import { RequireAdminManage } from '../RequireAdminManage';

interface AdminVolunteersRouteProps {
  params: { locale: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default function AdminVolunteersRoute({
  params: { locale },
  searchParams,
}: AdminVolunteersRouteProps) {
  setRequestLocale(locale);
  return (
    <RequireAdminManage locale={locale} next={`/admin/volunteers`}>
      <AdminVolunteersPage initialSearch={searchParams} />
    </RequireAdminManage>
  );
}
