import { setRequestLocale } from 'next-intl/server';
import { OrgDiscoverTalentsPage } from './OrgDiscoverTalentsPage';

interface OrgDiscoverTalentsRouteProps {
  params: { locale: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default function OrgDiscoverTalentsRoute({
  params: { locale },
  searchParams,
}: OrgDiscoverTalentsRouteProps) {
  setRequestLocale(locale);
  return <OrgDiscoverTalentsPage locale={locale} initialSearch={searchParams} />;
}
