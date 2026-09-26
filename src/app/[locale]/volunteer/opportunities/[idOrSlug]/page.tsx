import { setRequestLocale } from 'next-intl/server';
import { OpportunityDetailsPage } from './OpportunityDetailsPage';

interface OpportunityDetailsRouteProps {
  params: { locale: string; idOrSlug: string };
}

export default function OpportunityDetailsRoute({
  params: { locale, idOrSlug },
}: OpportunityDetailsRouteProps) {
  setRequestLocale(locale);
  return <OpportunityDetailsPage locale={locale} idOrSlug={idOrSlug} />;
}
