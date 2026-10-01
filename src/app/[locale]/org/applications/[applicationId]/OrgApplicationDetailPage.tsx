'use client';

import { useTranslations } from 'next-intl';
import { ApplicationDetailCard } from '../ApplicationDetail';
import { RequireOrg } from '../components';

// F11-owned deep-linkable application detail (OQ1): same detail component as
// the inline expansion, rendered standalone under the owned route dir.
export function OrgApplicationDetailPage({
  locale,
  applicationId,
}: {
  locale: string;
  applicationId: string;
}) {
  const t = useTranslations('orgReview');
  return (
    <RequireOrg locale={locale} next={`/org/applications/${applicationId}`}>
      <div className="flex min-w-0 flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('applications.detailTitle')}</h1>
        </div>
        <ApplicationDetailCard
          locale={locale}
          applicationId={applicationId}
          testIdPrefix="application-detail-page"
        />
      </div>
    </RequireOrg>
  );
}
