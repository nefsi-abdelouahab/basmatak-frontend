import { setRequestLocale } from 'next-intl/server';
import { PortfolioPage } from './PortfolioPage';

interface PortfolioRouteProps {
  params: { locale: string };
}

export default function PortfolioRoute({ params: { locale } }: PortfolioRouteProps) {
  setRequestLocale(locale);
  return <PortfolioPage locale={locale} />;
}
