import { setRequestLocale } from 'next-intl/server';
import { VolunteerSettingsPage } from './VolunteerSettingsPage';

interface SettingsPageProps {
  params: { locale: string };
}

export default function VolunteerSettingsRoute({ params: { locale } }: SettingsPageProps) {
  setRequestLocale(locale);
  return <VolunteerSettingsPage locale={locale} />;
}
