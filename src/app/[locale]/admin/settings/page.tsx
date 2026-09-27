import { setRequestLocale } from 'next-intl/server';
import { AdminSettingsPage } from './AdminSettingsPage';

interface AdminSettingsRouteProps {
  params: { locale: string };
}

export default function AdminSettingsRoute({ params: { locale } }: AdminSettingsRouteProps) {
  setRequestLocale(locale);
  return <AdminSettingsPage locale={locale} />;
}
