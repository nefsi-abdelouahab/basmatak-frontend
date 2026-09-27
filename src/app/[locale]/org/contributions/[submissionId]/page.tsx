import { setRequestLocale } from 'next-intl/server';
import { OrgSubmissionDetailPage } from './OrgSubmissionDetailPage';

interface SubmissionDetailRouteProps {
  params: { locale: string; submissionId: string };
}

export default function OrgSubmissionDetailRoute({
  params: { locale, submissionId },
}: SubmissionDetailRouteProps) {
  setRequestLocale(locale);
  return <OrgSubmissionDetailPage locale={locale} submissionId={submissionId} />;
}
