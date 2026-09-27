import { setRequestLocale } from 'next-intl/server';
import { OrgProfilePage } from './OrgProfilePage';

interface ProfilePageProps {
  params: { locale: string };
}

export default function OrgProfileRoute({ params: { locale } }: ProfilePageProps) {
  setRequestLocale(locale);
  return <OrgProfilePage locale={locale} />;
}
