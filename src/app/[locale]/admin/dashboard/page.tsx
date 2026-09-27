import { setRequestLocale } from 'next-intl/server';
import { AdminDashboardPage } from './AdminDashboardPage';

interface AdminDashboardRouteProps {
  params: { locale: string };
}

// F14 owns `admin/dashboard` only. No `admin/layout.tsx` is created by this
// session: F15 and F16 add sibling admin routes in the same parallel slate and a
// shared layout would be the one file all three would have to write.
export default function AdminDashboardRoute({ params: { locale } }: AdminDashboardRouteProps) {
  setRequestLocale(locale);
  return <AdminDashboardPage locale={locale} />;
}
