import { setRequestLocale } from 'next-intl/server';
import { OrgOpportunitiesPage } from './OrgOpportunitiesPage';

interface OrgOpportunitiesRouteProps {
  params: { locale: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default function OrgOpportunitiesRoute({
  params: { locale },
  searchParams,
}: OrgOpportunitiesRouteProps) {
  setRequestLocale(locale);
  return <OrgOpportunitiesPage locale={locale} initialSearch={searchParams} />;
}
