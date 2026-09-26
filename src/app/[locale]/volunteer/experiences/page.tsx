import { setRequestLocale } from 'next-intl/server';
import { ExperiencesPage } from './ExperiencesPage';

interface ExperiencesRouteProps {
  params: { locale: string };
}

export default function ExperiencesRoute({ params: { locale } }: ExperiencesRouteProps) {
  setRequestLocale(locale);
  return <ExperiencesPage locale={locale} />;
}
