import { setRequestLocale } from 'next-intl/server';
import { EditOpportunityScreen } from '../OpportunityEditor';

interface EditOpportunityRouteProps {
  params: { locale: string; id: string };
}

export default function EditOpportunityRoute({ params: { locale, id } }: EditOpportunityRouteProps) {
  setRequestLocale(locale);
  return <EditOpportunityScreen locale={locale} opportunityId={id} />;
}
