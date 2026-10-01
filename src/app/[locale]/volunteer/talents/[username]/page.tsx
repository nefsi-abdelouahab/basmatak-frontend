import { setRequestLocale } from 'next-intl/server';
import { VolunteerTalentProfilePage } from './VolunteerTalentProfilePage';

interface VolunteerTalentProfileRouteProps {
  params: { locale: string; username: string };
}

export default function VolunteerTalentProfileRoute({
  params: { locale, username },
}: VolunteerTalentProfileRouteProps) {
  setRequestLocale(locale);
  return <VolunteerTalentProfilePage locale={locale} username={username} />;
}
