'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Ban, CheckCircle2, Circle, Clock } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { Button } from '@/components/ui/Button';
import {
  applicationTimeline,
  canWithdrawApplication,
  rowId,
  shortApplicationId,
} from '@/lib/api/tasks';
import { useApplicationQuery, useWithdrawApplicationMutation } from '@/hooks/useTasks';
import { ConfirmDialog, SectionError, StatusTimeline, joinName } from './components';

// Status indicator without any pill/badge box: icon + plain typography in
// the status tone. Shared by the inline card expansion and the
// deep-linkable detail page so both stay consistent.
function DetailStatusLine({ status, label }: { status: string; label: string }) {
  const tone =
    status === 'accepted'
      ? 'text-status-success'
      : status === 'pending' || status === 'under_review'
        ? 'text-status-pending'
        : 'text-ink-muted';
  const Icon =
    status === 'accepted'
      ? CheckCircle2
      : status === 'pending' || status === 'under_review'
        ? Clock
        : status === 'rejected'
          ? Circle
          : Ban;
  return (
    <p className={`inline-flex items-center gap-1.5 text-label-md font-semibold ${tone}`}>
      <Icon size={16} aria-hidden="true" className="shrink-0" />
      <span>{label}</span>
    </p>
  );
}

// F6-owned application detail: joins, neutral timeline, short-form ID,
// withdraw-with-confirm. Rendered inline (list expansion) and on the
// deep-linkable [applicationId] page. No messaging UI, no submission UI.
export function ApplicationDetail({
  applicationId,
  locale,
  onWithdrawn,
}: {
  applicationId: string;
  locale: string;
  onWithdrawn?: () => void;
}) {
  const t = useTranslations('volunteerTasks');
  const detailQuery = useApplicationQuery(applicationId);
  const withdraw = useWithdrawApplicationMutation();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  if (detailQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (detailQuery.isError || !detailQuery.data)
    return (
      <SectionError testId="application-detail-error" message={t('applications.detailError')} />
    );

  const row = detailQuery.data;
  const timeline = applicationTimeline(row.status);
  const statusLabels: Record<string, string> = {
    pending: t('tabs.pending'),
    under_review: t('tabs.under_review'),
    accepted: t('tabs.accepted'),
    rejected: t('tabs.rejected'),
    withdrawn: t('tabs.withdrawn'),
  };
  const terminalNote =
    timeline.terminal === 'rejected'
      ? t('timeline.rejectedNote')
      : timeline.terminal === 'withdrawn'
        ? t('timeline.withdrawnNote')
        : null;

  const onWithdraw = () => {
    withdraw.mutate(applicationId, {
      onSuccess: () => {
        setConfirming(false);
        setDone(true);
        onWithdrawn?.();
      },
    });
  };

  return (
    <Card>
      <div data-testid="application-detail" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-muted">
            {t('applications.idLabel')}:{' '}
            <span data-testid="application-short-id" className="font-semibold text-ink">
              {shortApplicationId(rowId(row))}
            </span>
          </p>
          <DetailStatusLine status={row.status} label={statusLabels[row.status] ?? row.status} />
        </div>

        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-muted">{t('applications.organizationLabel')}</dt>
            <dd className="font-medium text-ink">{joinName(row.organization, locale)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">{t('applications.opportunityLabel')}</dt>
            <dd className="font-medium text-ink">{joinName(row.opportunity, locale)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">{t('applications.positionLabel')}</dt>
            <dd className="font-medium text-ink">{joinName(row.position, locale)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">{t('applications.appliedOnLabel')}</dt>
            <dd className="font-medium text-ink">
              {row.createdAt ? new Date(row.createdAt).toLocaleDateString(locale) : '—'}
            </dd>
          </div>
        </dl>

        {row.message ? (
          <div>
            <p className="text-sm text-ink-muted">{t('applications.messageLabel')}</p>
            <p className="text-sm text-ink">{row.message}</p>
          </div>
        ) : null}

        {row.decisionActor ? (
          <p className="text-sm text-ink-muted">
            {t('applications.decisionByLabel')}:{' '}
            <span className="text-ink">{joinName(row.decisionActor, locale)}</span>
          </p>
        ) : null}

        <StatusTimeline
          steps={timeline.steps}
          labels={[t('timeline.submitted'), t('timeline.underReview'), t('timeline.accepted')]}
          terminalNote={terminalNote}
          testId="application-timeline"
        />

        {row.reason ? (
          <p data-testid="application-reason" className="text-sm text-ink-muted">
            {row.reason}
          </p>
        ) : null}

        {row.status === 'accepted' ? (
          <Link
            data-testid="view-task-link"
            href="/volunteer/tasks"
            className="text-sm font-medium text-gold-strong"
          >
            {t('applications.viewTask')}
          </Link>
        ) : null}

        {withdraw.isError ? (
          <SectionError testId="withdraw-error" message={t('applications.withdrawError')} />
        ) : null}
        {done ? (
          <p data-testid="withdraw-success" role="status" className="text-sm text-status-success">
            {t('applications.withdrawn')}
          </p>
        ) : null}

        {canWithdrawApplication(row.status) && !done ? (
          confirming ? (
            <ConfirmDialog
              testId="withdraw-confirm"
              title={t('applications.withdrawTitle')}
              body={t('applications.withdrawBody')}
              confirmLabel={t('applications.withdrawCta')}
              cancelLabel={t('shared.cancel')}
              pendingLabel={t('applications.withdrawing')}
              pending={withdraw.isPending}
              onConfirm={onWithdraw}
              onCancel={() => setConfirming(false)}
            />
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="withdraw-button"
              onClick={() => setConfirming(true)}
            >
              {t('applications.withdrawCta')}
            </Button>
          )
        ) : null}
      </div>
    </Card>
  );
}
