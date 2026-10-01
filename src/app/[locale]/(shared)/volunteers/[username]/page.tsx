import { setRequestLocale } from 'next-intl/server';
import { PublicTalentProfilePage } from './PublicTalentProfilePage';

interface PublicProfileRouteProps {
  params: { locale: string; username: string };
}

export default function PublicProfileRoute({
  params: { locale, username },
}: PublicProfileRouteProps) {
  setRequestLocale(locale);
  return <PublicTalentProfilePage locale={locale} username={username} />;
}
