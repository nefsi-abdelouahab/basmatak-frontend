import { setRequestLocale } from 'next-intl/server';
import { SubmitContributionPage } from './SubmitContributionPage';

interface SubmitPageProps {
  params: { locale: string; participationId: string };
}

export default function SubmitContributionRoute({
  params: { locale, participationId },
}: SubmitPageProps) {
  setRequestLocale(locale);
  return <SubmitContributionPage locale={locale} participationId={participationId} />;
}
