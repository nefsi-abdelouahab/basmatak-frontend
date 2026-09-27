'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { mapToApiError } from '@/lib/api/errors';
import {
  APPLICATION_STATUSES,
  canAcceptApplication,
  canRejectApplication,
  canStartReviewApplication,
  type InboxApplication,
} from '@/lib/api/orgInbox';
import {
  useAcceptApplicationMutation,
  useApplicantProfileQuery,
  useOrgApplicationQuery,
  useRejectApplicationMutation,
  useStartReviewApplicationMutation,
} from '@/hooks/useOrgInbox';
import { ReasonDialog, SectionError, StatusPill, joinName } from './components';

// F11-owned application detail: joins + cover message + applicant public
// blocks (opt-out empty states) + start-review/accept/reject-with-reason.
// Shared by the inline expansion and the [applicationId] deep-link page. No
// messaging UI ("Ask clarification" stays deleted).
export function ApplicationDetail({
  locale,
  applicationId,
  testIdPrefix,
}: {
  locale: string;
  applicationId: string;
  testIdPrefix: string;
}) {
  const t = useTranslations('orgReview');
  const detailQuery = useOrgApplicationQuery(applicationId);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const startReview = useStartReviewApplicationMutation();
  const accept = useAcceptApplicationMutation();
  const reject = useRejectApplicationMutation();

  if (detailQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (detailQuery.isError) {
    return <SectionError testId={`${testIdPrefix}-error`} message={t('shared.loadError')} />;
  }

  const detail = detailQuery.data as InboxApplication;
  const status = detail.status;
  // Exact-enum labels only; unknown backend values render raw (never crash).
  const statusLabel = (APPLICATION_STATUSES as readonly string[]).includes(status)
    ? t(`tabs.${status as (typeof APPLICATION_STATUSES)[number]}`)
    : status;
  const username =
    detail.applicant?.username ?? detail.volunteer?.username ?? undefined;

  return (
    <div data-testid={`${testIdPrefix}`} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={status} label={statusLabel} />
        <span className="text-sm text-ink-muted">{joinName(detail.opportunity, locale)}</span>
      </div>
      {detail.message ? (
        <div>
          <h4 className="text-sm font-medium text-ink">{t('applications.messageLabel')}</h4>
          <p data-testid={`${testIdPrefix}-message`} className="mt-1 text-sm text-ink-muted">
            {detail.message}
          </p>
        </div>
      ) : null}
      <ApplicantBlock username={username} testIdPrefix={testIdPrefix} />
      <div className="flex flex-wrap gap-2">
        {canStartReviewApplication(status) ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={startReview.isPending}
            onClick={() => startReview.mutate({ applicationId })}
            data-testid={`${testIdPrefix}-start-review`}
          >
            {t('applications.startReview')}
          </Button>
        ) : null}
        {canAcceptApplication(status) ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={accept.isPending}
            onClick={() => accept.mutate({ applicationId })}
            data-testid={`${testIdPrefix}-accept`}
          >
            {t('applications.accept')}
          </Button>
        ) : null}
        {canRejectApplication(status) && !rejectOpen ? (
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => {
              setReason('');
              setRejectOpen(true);
            }}
            data-testid={`${testIdPrefix}-reject`}
          >
            {t('applications.reject')}
          </Button>
        ) : null}
      </div>
      {startReview.isError || accept.isError ? (
        <SectionError
          testId={`${testIdPrefix}-action-error`}
          message={mapToApiError(startReview.error ?? accept.error).message}
        />
      ) : null}
      {rejectOpen ? (
        <ReasonDialog
          testId={`${testIdPrefix}-reject-dialog`}
          title={t('applications.rejectTitle')}
          reasonLabel={t('applications.reasonLabel')}
          reasonPlaceholder={t('applications.reasonPlaceholder')}
          requiredMessage={t('applications.reasonRequired')}
          reason={reason}
          onReason={setReason}
          confirmLabel={t('applications.confirm')}
          cancelLabel={t('applications.cancel')}
          pending={reject.isPending}
          onConfirm={() =>
            reject.mutate(
              { applicationId, reason: reason.trim() },
              { onSuccess: () => setRejectOpen(false) },
            )
          }
          onCancel={() => setRejectOpen(false)}
        />
      ) : null}
      {reject.isError ? (
        <SectionError
          testId={`${testIdPrefix}-reject-error`}
          message={mapToApiError(reject.error).message}
        />
      ) : null}
    </div>
  );
}

function ApplicantBlock({
  username,
  testIdPrefix,
}: {
  username: string | undefined;
  testIdPrefix: string;
}) {
  const t = useTranslations('orgReview');
  const profileQuery = useApplicantProfileQuery(username);

  if (!username) return null;
  return (
    <div data-testid={`${testIdPrefix}-applicant`}>
      <h4 className="text-sm font-medium text-ink">
        {t('applications.applicantLabel')}: {username}
      </h4>
      {profileQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
      {profileQuery.isError ? (
        <SectionError testId={`${testIdPrefix}-applicant-error`} message={t('shared.loadError')} />
      ) : null}
      {profileQuery.data ? (
        <div className="mt-2 flex flex-col gap-2">
          <div>
            <h5 className="text-sm text-ink-muted">{t('applications.applicantSkills')}</h5>
            {profileQuery.data.skills && profileQuery.data.skills.length > 0 ? (
              <ul className="mt-1 flex flex-col gap-1">
                {profileQuery.data.skills.slice(0, 10).map((skill, index) => (
                  <li
                    key={index}
                    data-testid={`${testIdPrefix}-applicant-skill`}
                    className="text-sm text-ink"
                  >
                    {skillName(skill)}
                  </li>
                ))}
              </ul>
            ) : (
              <p data-testid={`${testIdPrefix}-applicant-skills-empty`} className="text-sm text-ink-muted">
                {t('applications.applicantHidden')}
              </p>
            )}
          </div>
          <div>
            <h5 className="text-sm text-ink-muted">{t('applications.applicantExperiences')}</h5>
            {profileQuery.data.experiences && profileQuery.data.experiences.length > 0 ? (
              <p data-testid={`${testIdPrefix}-applicant-experiences`} className="text-sm text-ink">
                {t('applications.applicantExperiences')}: {profileQuery.data.experiences.length}
              </p>
            ) : (
              <p
                data-testid={`${testIdPrefix}-applicant-experiences-empty`}
                className="text-sm text-ink-muted"
              >
                {t('applications.applicantHidden')}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function skillName(skill: unknown): string {
  if (typeof skill === 'string') return skill;
  if (skill && typeof skill === 'object') {
    const record = skill as Record<string, unknown>;
    for (const key of ['nameFr', 'name', 'nameAr', 'title', 'slug']) {
      if (typeof record[key] === 'string' && (record[key] as string).length > 0) {
        return record[key] as string;
      }
    }
  }
  return '—';
}

export function ApplicationDetailCard({
  locale,
  applicationId,
  testIdPrefix,
}: {
  locale: string;
  applicationId: string;
  testIdPrefix: string;
}) {
  return (
    <Card>
      <ApplicationDetail locale={locale} applicationId={applicationId} testIdPrefix={testIdPrefix} />
    </Card>
  );
}
