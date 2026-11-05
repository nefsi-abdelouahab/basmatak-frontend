import { setRequestLocale } from 'next-intl/server';
import { PublicTalentCvPage } from './PublicTalentCvPage';

interface PublicTalentCvRouteProps {
  params: { locale: string; username: string };
  searchParams: { print?: string | string[] };
}

export default function PublicTalentCvRoute({
  params: { locale, username },
  searchParams,
}: PublicTalentCvRouteProps) {
  setRequestLocale(locale);
  return (
    <PublicTalentCvPage
      locale={locale}
      username={username}
      autoPrint={searchParams.print === '1'}
    />
  );
}
