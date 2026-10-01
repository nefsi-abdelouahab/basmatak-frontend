import { setRequestLocale } from 'next-intl/server';
import { PublicOpportunityDetailsPage } from './PublicOpportunityDetailsPage';

interface PublicOpportunityDetailsRouteProps {
  params: { locale: string; idOrSlug: string };
}

export default function PublicOpportunityDetailsRoute({
  params: { locale, idOrSlug },
}: PublicOpportunityDetailsRouteProps) {
  setRequestLocale(locale);
  return <PublicOpportunityDetailsPage locale={locale} idOrSlug={idOrSlug} />;
}
