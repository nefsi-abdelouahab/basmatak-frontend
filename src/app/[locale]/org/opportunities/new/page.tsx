import { setRequestLocale } from 'next-intl/server';
import { NewOpportunityScreen } from '../OpportunityEditor';

interface NewOpportunityRouteProps {
  params: { locale: string };
}

export default function NewOpportunityRoute({ params: { locale } }: NewOpportunityRouteProps) {
  setRequestLocale(locale);
  return <NewOpportunityScreen locale={locale} />;
}
