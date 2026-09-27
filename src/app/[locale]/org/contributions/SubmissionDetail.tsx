'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { mapToApiError } from '@/lib/api/errors';
import {
  SUBMISSION_INBOX_STATUSES,
  canDecideSubmission,
  canStartReviewSubmission,
  evidenceIdsOf,
  evidenceUrlOf,
  type InboxSubmission,
} from '@/lib/api/orgInbox';
import {
  useEvidenceMediaQuery,
  useOrgSubmissionQuery,
  useRejectSubmissionMutation,
  useStartReviewSubmissionMutation,
  useVerifySubmissionMutation,
} from '@/hooks/useOrgInbox';
import { ReasonDialog, SectionError, StatusPill, joinName } from '../applications/components';

// F11-owned submission detail: joins + owning-org evidence render
// (images/PDF/link only, never audio) + start-review / single
// approve-and-mint / reject-with-required-reason. Reviewer notes surface as
// neutral `review`. Shared by the inline expansion and the [submissionId]
// deep-link page. No Verified archive tab (F12), no council/compliance copy.
export function SubmissionDetail({
  locale,
  submissionId,
  testIdPrefix,
}: {
  locale: string;
  submissionId: string;
  testIdPrefix: string;
}) {
  const t = useTranslations('orgReview');
  const detailQuery = useOrgSubmissionQuery(submissionId);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const startReview = useStartReviewSubmissionMutation();
  const verify = useVerifySubmissionMutation();
  const reject = useRejectSubmissionMutation();

  if (detailQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (detailQuery.isError) {
    return <SectionError testId={`${testIdPrefix}-error`} message={t('shared.loadError')} />;
  }

  const detail = detailQuery.data as InboxSubmission;
  const status = detail.status;
  // Exact-enum labels only; unknown backend values render raw (never crash).
  const statusLabel = (SUBMISSION_INBOX_STATUSES as readonly string[]).includes(status)
    ? t(`tabs.${status as (typeof SUBMISSION_INBOX_STATUSES)[number]}`)
    : status;
  const evidenceIds = evidenceIdsOf(detail);
  const reviewText = reviewTextOf(detail.review);

  return (
    <div data-testid={testIdPrefix} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={status} label={statusLabel} />
        <span className="text-sm text-ink-muted">{joinName(detail.opportunity, locale)}</span>
      </div>
      {detail.title ? (
        <p data-testid={`${testIdPrefix}-title`} className="font-medium text-ink">
          {detail.title}
        </p>
      ) : null}
      {reviewText ? (
        <div>
          <h4 className="text-sm font-medium text-ink">{t('contributions.reviewLabel')}</h4>
          <p data-testid={`${testIdPrefix}-review`} className="mt-1 text-sm text-ink-muted">
            {reviewText}
          </p>
        </div>
      ) : null}
      <div>
        <h4 className="text-sm font-medium text-ink">{t('contributions.evidenceTitle')}</h4>
        {evidenceIds.length === 0 ? (
          <p data-testid={`${testIdPrefix}-evidence-empty`} className="mt-1 text-sm text-ink-muted">
            {t('contributions.evidenceEmpty')}
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {evidenceIds.map((mediaId) => (
              <EvidenceItem
                key={mediaId}
                mediaId={mediaId}
                testIdPrefix={testIdPrefix}
              />
            ))}
          </ul>
        )}
      </div>
      {status === 'verified' ? (
        <p data-testid={`${testIdPrefix}-verified`} role="status" className="text-sm font-medium text-status-success">
          {t('contributions.verifiedState')}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canStartReviewSubmission(status) ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={startReview.isPending}
            onClick={() => startReview.mutate({ submissionId })}
            data-testid={`${testIdPrefix}-start-review`}
          >
            {t('contributions.startReview')}
          </Button>
        ) : null}
        {canDecideSubmission(status) ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={verify.isPending}
            onClick={() => verify.mutate({ submissionId })}
            data-testid={`${testIdPrefix}-approve`}
          >
            {t('contributions.approve')}
          </Button>
        ) : null}
        {canDecideSubmission(status) && !rejectOpen ? (
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
            {t('contributions.reject')}
          </Button>
        ) : null}
      </div>
      {canDecideSubmission(status) ? (
        <p data-testid={`${testIdPrefix}-mint-note`} className="text-sm text-ink-muted">
          {t('contributions.mintNote')}
        </p>
      ) : null}
      {startReview.isError || verify.isError ? (
        <SectionError
          testId={`${testIdPrefix}-action-error`}
          message={mapToApiError(startReview.error ?? verify.error).message}
        />
      ) : null}
      {rejectOpen ? (
        <ReasonDialog
          testId={`${testIdPrefix}-reject-dialog`}
          title={t('contributions.rejectTitle')}
          reasonLabel={t('contributions.reasonLabel')}
          reasonPlaceholder={t('contributions.reasonPlaceholder')}
          requiredMessage={t('contributions.reasonRequired')}
          reason={reason}
          onReason={setReason}
          confirmLabel={t('contributions.confirm')}
          cancelLabel={t('contributions.cancel')}
          pending={reject.isPending}
          onConfirm={() =>
            reject.mutate(
              { submissionId, reason: reason.trim() },
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

// Owning-org evidence row (backend-v2-media-org-read): 200 + signed URL for
// the owning org. Images render inline; PDF/link render as links; audio never
// renders (no <audio> element anywhere in this session).
function EvidenceItem({
  mediaId,
  testIdPrefix,
}: {
  mediaId: string;
  testIdPrefix: string;
}) {
  const t = useTranslations('orgReview');
  const mediaQuery = useEvidenceMediaQuery(mediaId);

  if (mediaQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (mediaQuery.isError || !evidenceUrlOf(mediaQuery.data)) {
    return (
      <li data-testid={`${testIdPrefix}-evidence-unavailable`} className="text-sm text-ink-muted">
        {t('contributions.evidenceEmpty')}
      </li>
    );
  }

  const url = evidenceUrlOf(mediaQuery.data) as string;
  const image = isImageUrl(url);
  return (
    <li data-testid={`${testIdPrefix}-evidence-item`} className="text-sm">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-32 w-auto rounded-md border border-border-muted object-cover" />
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline"
        >
          {url}
        </a>
      )}
    </li>
  );
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(url);
}

// Neutral `review` notes: plain strings and { comment } shapes only — never
// "Compliance" vocabulary (deleted per V2 §B#14).
function reviewTextOf(review: unknown): string | null {
  if (typeof review === 'string' && review.trim().length > 0) return review;
  if (review && typeof review === 'object') {
    const comment = (review as Record<string, unknown>).comment;
    if (typeof comment === 'string' && comment.trim().length > 0) return comment;
  }
  return null;
}

export function SubmissionDetailCard({
  locale,
  submissionId,
  testIdPrefix,
}: {
  locale: string;
  submissionId: string;
  testIdPrefix: string;
}) {
  return (
    <Card>
      <SubmissionDetail locale={locale} submissionId={submissionId} testIdPrefix={testIdPrefix} />
    </Card>
  );
}

export function ContributionsEmpty() {
  const t = useTranslations('orgReview');
  return <Empty title={t('shared.empty')} />;
}
