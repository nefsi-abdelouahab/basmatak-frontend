import { setRequestLocale } from 'next-intl/server';
import { VolunteerProfilePage } from './VolunteerProfilePage';

interface ProfilePageProps {
  params: { locale: string };
}

export default function VolunteerProfileRoute({ params: { locale } }: ProfilePageProps) {
  setRequestLocale(locale);
  return <VolunteerProfilePage locale={locale} />;
}
