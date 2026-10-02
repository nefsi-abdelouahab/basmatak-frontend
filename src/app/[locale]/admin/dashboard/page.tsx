import { setRequestLocale } from 'next-intl/server';
import { AdminDashboardPage } from './AdminDashboardPage';

interface AdminDashboardRouteProps {
  params: { locale: string };
}

// Admin dashboard route: code.html-layout rebuild (header + six-stat row +
// activity chart + attention queue + activity feed + health + shortcuts).
// Workspace chrome (sidebar, navbar, tab bar) lives in the shared Shell;
// `admin/layout.tsx` wraps this route with it.
export default function AdminDashboardRoute({ params: { locale } }: AdminDashboardRouteProps) {
  setRequestLocale(locale);
  return <AdminDashboardPage locale={locale} />;
}
