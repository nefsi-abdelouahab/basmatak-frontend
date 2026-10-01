'use client';

import { useTranslations } from 'next-intl';
import { SubmissionDetailCard } from '../SubmissionDetail';
import { RequireOrg } from '../../applications/components';

// F11-owned deep-linkable submission detail (OQ1): same detail component as
// the inline expansion, rendered standalone under the owned route dir.
export function OrgSubmissionDetailPage({
  locale,
  submissionId,
}: {
  locale: string;
  submissionId: string;
}) {
  const t = useTranslations('orgReview');
  return (
    <RequireOrg locale={locale} next={`/org/contributions/${submissionId}`}>
      <div className="flex min-w-0 flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('contributions.detailTitle')}</h1>
          <p className="text-sm text-ink-muted">{t('contributions.mintNote')}</p>
        </div>
        <SubmissionDetailCard
          locale={locale}
          submissionId={submissionId}
          testIdPrefix="submission-detail-page"
        />
      </div>
    </RequireOrg>
  );
}
