import { setRequestLocale } from 'next-intl/server';
import { AdminOpportunitiesPage } from './AdminOpportunitiesPage';
import { RequireAdminManage } from '../RequireAdminManage';

interface AdminOpportunitiesRouteProps {
  params: { locale: string };
}

export default function AdminOpportunitiesRoute({ params: { locale } }: AdminOpportunitiesRouteProps) {
  setRequestLocale(locale);
  return (
    <RequireAdminManage locale={locale} next={`/${locale}/admin/opportunities`}>
      <AdminOpportunitiesPage />
    </RequireAdminManage>
  );
}
