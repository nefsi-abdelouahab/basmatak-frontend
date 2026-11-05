import { setRequestLocale } from 'next-intl/server';
import { VolunteerFavoritesPage } from './VolunteerFavoritesPage';

interface FavoritesRouteProps {
  params: { locale: string };
}

export default function FavoritesRoute({ params: { locale } }: FavoritesRouteProps) {
  setRequestLocale(locale);
  return <VolunteerFavoritesPage locale={locale} />;
}
