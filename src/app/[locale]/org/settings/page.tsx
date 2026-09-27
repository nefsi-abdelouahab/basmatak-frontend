import { setRequestLocale } from 'next-intl/server';
import { OrgSettingsPage } from './OrgSettingsPage';

interface SettingsPageProps {
  params: { locale: string };
}

export default function OrgSettingsRoute({ params: { locale } }: SettingsPageProps) {
  setRequestLocale(locale);
  return <OrgSettingsPage locale={locale} />;
}
