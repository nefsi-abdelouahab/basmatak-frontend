import { setRequestLocale } from 'next-intl/server';
import { VerifyEntryPage } from './VerifyEntryPage';

interface VerifyRouteProps {
  params: { locale: string };
}

export default function VerifyRoute({ params: { locale } }: VerifyRouteProps) {
  setRequestLocale(locale);
  return <VerifyEntryPage />;
}
