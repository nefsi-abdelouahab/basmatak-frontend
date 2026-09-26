import { setRequestLocale } from 'next-intl/server';
import { VolunteerOpportunitiesPage } from './VolunteerOpportunitiesPage';

interface OpportunitiesPageProps {
  params: { locale: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default function VolunteerOpportunitiesRoute({
  params: { locale },
  searchParams,
}: OpportunitiesPageProps) {
  setRequestLocale(locale);
  return <VolunteerOpportunitiesPage locale={locale} initialSearch={searchParams} />;
}
