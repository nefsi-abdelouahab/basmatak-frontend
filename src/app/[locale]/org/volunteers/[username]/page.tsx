import { setRequestLocale } from 'next-intl/server';
import { OrgVolunteerProfilePage } from './OrgVolunteerProfilePage';

interface OrgVolunteerProfileRouteProps {
  params: { locale: string; username: string };
}

export default function OrgVolunteerProfileRoute({
  params: { locale, username },
}: OrgVolunteerProfileRouteProps) {
  setRequestLocale(locale);
  return <OrgVolunteerProfilePage locale={locale} username={username} />;
}
