import { setRequestLocale } from 'next-intl/server';
import { PublicOpportunitiesPage } from './PublicOpportunitiesPage';

interface PublicOpportunitiesRouteProps {
  params: { locale: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default function PublicOpportunitiesRoute({
  params: { locale },
  searchParams,
}: PublicOpportunitiesRouteProps) {
  setRequestLocale(locale);
  return <PublicOpportunitiesPage locale={locale} initialSearch={searchParams} />;
}
