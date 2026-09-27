import { setRequestLocale } from 'next-intl/server';
import { OrgOpportunitiesPage } from './OrgOpportunitiesPage';

interface OrgOpportunitiesRouteProps {
  params: { locale: string };
}

export default function OrgOpportunitiesRoute({ params: { locale } }: OrgOpportunitiesRouteProps) {
  setRequestLocale(locale);
  return <OrgOpportunitiesPage locale={locale} />;
}
