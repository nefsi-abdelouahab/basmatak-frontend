import { setRequestLocale } from 'next-intl/server';
import { PublicTalentsPage } from './PublicTalentsPage';

interface PublicTalentsRouteProps {
  params: { locale: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default function PublicTalentsRoute({
  params: { locale },
  searchParams,
}: PublicTalentsRouteProps) {
  setRequestLocale(locale);
  return <PublicTalentsPage locale={locale} initialSearch={searchParams} />;
}
