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
    <RequireOrg locale={locale} next={`/${locale}/org/applications/${applicationId}`}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
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
