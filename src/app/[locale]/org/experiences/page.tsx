import { setRequestLocale } from 'next-intl/server';
import { OrgExperiencesPage } from './OrgExperiencesPage';

interface OrgExperiencesRouteProps {
  params: { locale: string };
}

export default function OrgExperiencesRoute({ params: { locale } }: OrgExperiencesRouteProps) {
  setRequestLocale(locale);
  return <OrgExperiencesPage locale={locale} />;
}
