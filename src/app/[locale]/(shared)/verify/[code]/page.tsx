import { setRequestLocale } from 'next-intl/server';
import { VerifyResultPage } from './VerifyResultPage';

interface VerifyCodeRouteProps {
  params: { locale: string; code: string };
}

export default function VerifyCodeRoute({
  params: { locale, code },
}: VerifyCodeRouteProps) {
  setRequestLocale(locale);
  return <VerifyResultPage locale={locale} code={code} />;
}
