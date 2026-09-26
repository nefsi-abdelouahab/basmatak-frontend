import { setRequestLocale } from 'next-intl/server';
import { VolunteerTalentsPage } from './VolunteerTalentsPage';

interface TalentsPageProps {
  params: { locale: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default function VolunteerTalentsRoute({
  params: { locale },
  searchParams,
}: TalentsPageProps) {
  setRequestLocale(locale);
  return <VolunteerTalentsPage locale={locale} initialSearch={searchParams} />;
}
