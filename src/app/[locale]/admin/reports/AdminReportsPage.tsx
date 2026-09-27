'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Select } from '@/components/ui/Select';
import {
  buildResolveActionPayload,
  canResolveWithPayload,
  isCompatibleActionTarget,
  isNoticeValid,
  isResolutionValid,
  reportIdOf,
  reportTargetIdOf,
  reporterNameOf,
  targetLabelOf,
  type AdminReport,
  type ModerationActionType,
  type ReportResolveStatus,
} from '@/lib/api/adminModeration';
import { ApiError, backendMessageOf } from '@/lib/api/errors';
import { useSessionQuery } from '@/hooks/useSession';
import {
  confirmReportResolution,
  useAdminReportsCsvExportMutation,
  useAdminReportsQuery,
  useAssignAdminReportMutation,
  useHideAdminReviewMutation,
  useResolveAdminReportMutation,
  useSendAdminNoticeMutation,
  useStatusHistoriesQuery,
  type ResolutionConfirmation,
} from '@/hooks/useAdminModeration';
import { RequireAdminModeration } from '../AdminModerationGuard';

function SectionError({ message, testId }: { message: string; testId: string }) {
  return (
    <p data-testid={testId} role="alert" className="text-sm text-status-error">
      {message}
    </p>
  );
}

function errorMessageOf(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const backend = backendMessageOf(error);
    return backend === null ? fallback : `${error.code}: ${backend}`;
  }
  return fallback;
}

function ReportHistory({ reportId }: { reportId: string }) {
  const t = useTranslations('adminModeration');
  const historiesQuery = useStatusHistoriesQuery({ entityType: 'reports', entityId: reportId });
  if (historiesQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (historiesQuery.isError) return <SectionError testId="admin-report-history-error" message={t('shared.loadError')} />;
  const rows = historiesQuery.data ?? [];
  if (rows.length === 0) return <p className="text-sm text-ink-muted">{t('reports.historyEmpty')}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row, index) => (
        <li
          key={`${row.from ?? 'na'}-${row.to ?? 'na'}-${index}`}
          data-testid="admin-report-history-row"
          className="rounded-md border border-border p-2 text-sm"
        >
          <span className="font-medium text-ink">
            {row.from ?? '—'} → {row.to ?? '—'}
          </span>
          {typeof row.reason === 'string' && row.reason !== '' ? (
            <span className="block text-ink-muted">{row.reason}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ReportDetail({ report }: { report: AdminReport }) {
  const t = useTranslations('adminModeration');
  const reportId = reportIdOf(report);
  const targetId = reportTargetIdOf(report);
  const targetType = typeof report.targetType === 'string' ? report.targetType : '';
  const reporter = reporterNameOf(report.reporter ?? undefined);
  const targetLabel = targetLabelOf(report.target ?? report.targetSummary ?? undefined);

  const [assignee, setAssignee] = useState('');
  const [assignError, setAssignError] = useState(false);
  const [assignDone, setAssignDone] = useState(false);
  const [resolveStatus, setResolveStatus] = useState<ReportResolveStatus>('resolved');
  const [resolution, setResolution] = useState('');
  const [actionType, setActionType] = useState<ModerationActionType | ''>('');
  const [noticeUserId, setNoticeUserId] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolveConflict, setResolveConflict] = useState(false);
  const [confirmation, setConfirmation] = useState<ResolutionConfirmation | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [standaloneUserId, setStandaloneUserId] = useState('');
  const [standaloneMessage, setStandaloneMessage] = useState('');
  const [noticeState, setNoticeState] = useState<'idle' | 'sent' | 'suppressed' | 'error'>('idle');
  const [hideState, setHideState] = useState<'idle' | 'done' | 'conflict' | 'error'>('idle');

  const assignMutation = useAssignAdminReportMutation();
  const resolveMutation = useResolveAdminReportMutation();
  const noticeMutation = useSendAdminNoticeMutation();
  const hideMutation = useHideAdminReviewMutation();

  const action = buildResolveActionPayload(
    { actionType, noticeUserId, noticeMessage },
    targetType,
  );
  const actionRequested = actionType !== '';
  const incompatible = actionRequested && !isCompatibleActionTarget(actionType, targetType);
  const noticeIncomplete =
    actionType === 'notice' && (noticeUserId.trim() === '' || !isNoticeValid(noticeMessage));
  const resolutionMissing = action !== null && !isResolutionValid(resolution);
  const canApply =
    !resolveMutation.isPending &&
    !confirming &&
    !incompatible &&
    !noticeIncomplete &&
    !resolutionMissing &&
    canResolveWithPayload(resolveStatus, resolution, action);

  const onAssign = () => {
    const trimmed = assignee.trim();
    if (trimmed === '') return;
    setAssignError(false);
    setAssignDone(false);
    assignMutation.mutate(
      { reportId, assignedAdminId: trimmed },
      { onError: () => setAssignError(true), onSuccess: () => setAssignDone(true) },
    );
  };

  const onResolve = () => {
    if (!canApply) return;
    setResolveError(null);
    setResolveConflict(false);
    setConfirmation(null);
    resolveMutation.mutate(
      {
        reportId,
        input: {
          status: resolveStatus,
          resolution: resolution === '' ? undefined : resolution,
          action,
        },
      },
      {
        onError: (error) => {
          if (error instanceof ApiError && (error.statusCode === 409 || error.statusCode === 400)) {
            setResolveConflict(true);
          } else {
            setResolveError(errorMessageOf(error, t('reports.resolveError')));
          }
        },
        onSuccess: async () => {
          // Atomicity proof: assert the consequence via re-read (report row
          // + histories carrying the resolution), never the mutation echo.
          setConfirming(true);
          try {
            const result = await confirmReportResolution({
              reportId,
              targetType,
              targetId: targetId === '' ? undefined : targetId,
              resolution,
            });
            setConfirmation(result);
          } catch {
            setResolveError(t('reports.resolveError'));
          } finally {
            setConfirming(false);
          }
        },
      },
    );
  };

  const onSendNotice = () => {
    const userId = standaloneUserId.trim();
    if (userId === '' || !isNoticeValid(standaloneMessage)) return;
    setNoticeState('idle');
    noticeMutation.mutate(
      { userId, message: standaloneMessage.trim() },
      {
        onError: () => setNoticeState('error'),
        onSuccess: (result) => setNoticeState(result.delivered ? 'sent' : 'suppressed'),
      },
    );
  };

  const onHideReview = () => {
    if (targetType !== 'review' || targetId === '') return;
    setHideState('idle');
    hideMutation.mutate(targetId, {
      onError: (error) => {
        if (error instanceof ApiError && error.statusCode === 409) setHideState('conflict');
        else setHideState('error');
      },
      onSuccess: () => setHideState('done'),
    });
  };

  return (
    <div data-testid={`admin-report-detail-${reportId}`} className="flex flex-col gap-4">
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium text-ink">{t('reports.reporterLabel')}</dt>
          <dd className="text-ink-muted">{reporter === '' ? '—' : reporter}</dd>
        </div>
        <div>
          <dt className="font-medium text-ink">{t('reports.targetLabel')}</dt>
          <dd className="text-ink-muted">
            {targetType === '' ? '—' : `${targetType}: ${targetLabel === '' ? targetId : targetLabel}`}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-ink">{t('reports.reasonLabel')}</dt>
          <dd className="text-ink-muted">
            {typeof report.reason === 'string' && report.reason !== '' ? report.reason : '—'}
          </dd>
        </div>
        {typeof report.description === 'string' && report.description !== '' ? (
          <div className="sm:col-span-2">
            <dt className="font-medium text-ink">{t('reports.descriptionLabel')}</dt>
            <dd className="text-ink-muted">{report.description}</dd>
          </div>
        ) : null}
      </dl>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">{t('reports.historyTitle')}</h3>
        <ReportHistory reportId={reportId} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">{t('reports.assignTitle')}</h3>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <Input
              id={`admin-assign-${reportId}`}
              label={t('reports.assigneeLabel')}
              placeholder={t('reports.assigneePlaceholder')}
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid={`admin-assign-apply-${reportId}`}
            disabled={assignMutation.isPending || assignee.trim() === ''}
            onClick={onAssign}
          >
            {t('reports.assignCta')}
          </Button>
        </div>
        {assignError ? (
          <p data-testid={`admin-assign-error-${reportId}`} role="alert" className="mt-1 text-sm text-status-error">
            {t('reports.assignError')}
          </p>
        ) : null}
        {assignDone ? (
          <p data-testid={`admin-assign-done-${reportId}`} className="mt-1 text-sm text-ink-muted">
            {t('reports.assignCta')}
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">{t('reports.resolveTitle')}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            id={`admin-resolve-status-${reportId}`}
            label={t('reports.resolveStatusLabel')}
            value={resolveStatus}
            onChange={(event) => setResolveStatus(event.target.value as ReportResolveStatus)}
            options={[
              { value: 'in_review', label: t('reports.statusInReview') },
              { value: 'resolved', label: t('reports.statusResolved') },
              { value: 'dismissed', label: t('reports.statusDismissed') },
            ]}
          />
          <Select
            id={`admin-resolve-action-${reportId}`}
            label={t('reports.actionLabel')}
            value={actionType}
            onChange={(event) => setActionType(event.target.value as ModerationActionType | '')}
            options={[
              { value: '', label: t('reports.noAction') },
              { value: 'unpublish_opportunity', label: t('reports.actionUnpublish') },
              { value: 'close_opportunity', label: t('reports.actionClose') },
              { value: 'suspend_target', label: t('reports.actionSuspend') },
              { value: 'notice', label: t('reports.actionNotice') },
            ]}
          />
        </div>
        <div className="mt-3">
          <label htmlFor={`admin-resolve-resolution-${reportId}`} className="mb-1 block text-sm font-medium text-ink">
            {t('reports.resolutionLabel')}
          </label>
          <textarea
            id={`admin-resolve-resolution-${reportId}`}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
            rows={3}
            placeholder={t('reports.resolutionPlaceholder')}
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
          />
          {resolutionMissing ? (
            <p className="mt-1 text-sm text-status-error">{t('reports.resolutionRequired')}</p>
          ) : null}
        </div>
        {actionType === 'notice' ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              id={`admin-resolve-notice-user-${reportId}`}
              label={t('reports.noticeUserLabel')}
              value={noticeUserId}
              onChange={(event) => setNoticeUserId(event.target.value)}
            />
            <Input
              id={`admin-resolve-notice-message-${reportId}`}
              label={t('reports.noticeMessageLabel')}
              value={noticeMessage}
              onChange={(event) => setNoticeMessage(event.target.value)}
            />
          </div>
        ) : null}
        {incompatible ? (
          <p data-testid={`admin-resolve-incompatible-${reportId}`} role="alert" className="mt-2 text-sm text-status-error">
            {t('reports.actionIncompatible')}
          </p>
        ) : null}
        <div className="mt-3">
          <Button
            type="button"
            variant="primary"
            size="sm"
            data-testid={`admin-resolve-apply-${reportId}`}
            disabled={!canApply}
            onClick={onResolve}
          >
            {t('reports.resolveCta')}
          </Button>
        </div>
        {resolveConflict ? (
          <p data-testid={`admin-resolve-conflict-${reportId}`} role="alert" className="mt-2 text-sm text-status-error">
            {t('reports.resolveConflict')}
          </p>
        ) : null}
        {resolveError ? (
          <p data-testid={`admin-resolve-error-${reportId}`} role="alert" className="mt-2 text-sm text-status-error">
            {resolveError}
          </p>
        ) : null}
        {confirmation?.confirmed ? (
          <p data-testid={`admin-resolve-confirmed-${reportId}`} className="mt-2 text-sm font-medium text-ink">
            {t('reports.confirmedTitle')}: {t('reports.confirmedDescription')}
          </p>
        ) : null}
        {confirmation && !confirmation.confirmed ? (
          <p data-testid={`admin-resolve-unconfirmed-${reportId}`} role="alert" className="mt-2 text-sm text-status-error">
            {t('reports.unconfirmedTitle')}: {t('reports.unconfirmedDescription')}
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">{t('reports.noticeTitle')}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            id={`admin-notice-user-${reportId}`}
            label={t('reports.noticeUserLabel')}
            value={standaloneUserId}
            onChange={(event) => setStandaloneUserId(event.target.value)}
          />
          <Input
            id={`admin-notice-message-${reportId}`}
            label={t('reports.noticeMessageLabel')}
            value={standaloneMessage}
            onChange={(event) => setStandaloneMessage(event.target.value)}
          />
        </div>
        <div className="mt-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid={`admin-notice-send-${reportId}`}
            disabled={
              noticeMutation.isPending ||
              standaloneUserId.trim() === '' ||
              !isNoticeValid(standaloneMessage)
            }
            onClick={onSendNotice}
          >
            {t('reports.noticeCta')}
          </Button>
        </div>
        {noticeState === 'sent' ? (
          <p data-testid={`admin-notice-done-${reportId}`} className="mt-1 text-sm text-ink-muted">
            {t('reports.noticeSent')}
          </p>
        ) : null}
        {noticeState === 'suppressed' ? (
          <p data-testid={`admin-notice-done-${reportId}`} className="mt-1 text-sm text-ink-muted">
            {t('reports.noticeSuppressed')}
          </p>
        ) : null}
        {noticeState === 'error' ? (
          <p data-testid={`admin-notice-error-${reportId}`} role="alert" className="mt-1 text-sm text-status-error">
            {t('reports.noticeError')}
          </p>
        ) : null}
      </div>

      {targetType === 'review' && targetId !== '' ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">{t('reports.hideTitle')}</h3>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid={`admin-hide-${reportId}`}
            disabled={hideMutation.isPending}
            onClick={onHideReview}
          >
            {t('reports.hideCta')}
          </Button>
          {hideState === 'done' ? (
            <p data-testid={`admin-hide-done-${reportId}`} className="mt-1 text-sm text-ink-muted">
              {t('reports.hideDone')}
            </p>
          ) : null}
          {hideState === 'conflict' ? (
            <p data-testid={`admin-hide-conflict-${reportId}`} role="alert" className="mt-1 text-sm text-status-error">
              {t('reports.hideConflict')}
            </p>
          ) : null}
          {hideState === 'error' ? (
            <p data-testid={`admin-hide-error-${reportId}`} role="alert" className="mt-1 text-sm text-status-error">
              {t('reports.hideError')}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ReportCard({
  report,
  expanded,
  onToggle,
}: {
  report: AdminReport;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('adminModeration');
  const reportId = reportIdOf(report);
  const targetType = typeof report.targetType === 'string' ? report.targetType : '';
  const reporter = reporterNameOf(report.reporter ?? undefined);
  const targetLabel = targetLabelOf(report.target ?? report.targetSummary ?? undefined);
  return (
    <article data-testid="admin-report-card" className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-ink">
          {typeof report.title === 'string' && report.title !== '' ? report.title : t('reports.detailTitle')}
        </h2>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-ink-muted">
          {report.status}
        </span>
        {typeof report.priority === 'string' && report.priority !== '' ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-ink-muted">
            {report.priority}
          </span>
        ) : null}
        {targetType !== '' ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-ink-muted">
            {targetType}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        {t('reports.reporterLabel')}: {reporter === '' ? '—' : reporter} — {t('reports.targetLabel')}:{' '}
        {targetType === '' ? '—' : `${targetType}${targetLabel === '' ? '' : ` ${targetLabel}`}`}
      </p>
      <p className="mt-1 text-sm text-ink-muted">
        {typeof report.reason === 'string' ? report.reason : ''}
      </p>
      <div className="mt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid={`admin-report-toggle-${reportId}`}
          onClick={onToggle}
          aria-expanded={expanded}
        >
          {t('reports.detailTitle')}
        </Button>
      </div>
      {expanded ? (
        <div className="mt-3 border-t border-border pt-3">
          <ReportDetail report={report} />
        </div>
      ) : null}
    </article>
  );
}

// F16-owned Reports & Moderation route: enriched triage list with filters,
// totals, CSV export, per-report detail with assign + atomic
// resolve-with-action (consequence asserted via re-read) + standalone
// notice + review-hide. Guest visits redirect to Login (decision 10);
// non-admin roles see the shared 403 state. Neutral action vocabulary
// only — no sanction vocabulary anywhere.
export function AdminReportsPage({ locale }: { locale: string }) {
  const t = useTranslations('adminModeration');
  const [status, setStatus] = useState('');
  const [targetType, setTargetType] = useState('');
  const [priority, setPriority] = useState('');
  const [assignedAdminId, setAssignedAdminId] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [csvError, setCsvError] = useState(false);

  // Defense in depth behind the route guard: non-admin sessions never fire
  // admin reads (the guard already blocks the UI).
  const session = useSessionQuery();
  const isAdmin = session.data?.role === 'admin';
  const listQuery = useAdminReportsQuery(
    {
      status: status === '' ? undefined : status,
      targetType: targetType === '' ? undefined : targetType,
      priority: priority === '' ? undefined : priority,
      assignedAdminId: assignedAdminId === '' ? undefined : assignedAdminId,
      q: q === '' ? undefined : q,
      from: from === '' ? undefined : from,
      to: to === '' ? undefined : to,
      sort: sort === '' ? undefined : sort,
    },
    { enabled: isAdmin },
  );
  const csvMutation = useAdminReportsCsvExportMutation();

  const clearFilters = () => {
    setStatus('');
    setTargetType('');
    setPriority('');
    setAssignedAdminId('');
    setQ('');
    setFrom('');
    setTo('');
    setSort('');
  };

  const onExportCsv = () => {
    setCsvError(false);
    csvMutation.mutate(
      {
        status: status === '' ? undefined : status,
        targetType: targetType === '' ? undefined : targetType,
        priority: priority === '' ? undefined : priority,
        assignedAdminId: assignedAdminId === '' ? undefined : assignedAdminId,
        q: q === '' ? undefined : q,
        from: from === '' ? undefined : from,
        to: to === '' ? undefined : to,
        sort: sort === '' ? undefined : sort,
      },
      { onError: () => setCsvError(true) },
    );
  };

  return (
    <RequireAdminModeration locale={locale} next={`/admin/reports`}>
      <div data-testid="admin-reports" className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('reports.title')}</h1>
          <p className="text-sm text-ink-muted">{t('reports.subtitle')}</p>
        </div>
        <Card title={t('reports.filtersTitle')}>
          <div data-testid="admin-reports-filters" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id="admin-reports-status"
              label={t('reports.statusLabel')}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              options={[
                { value: '', label: t('reports.allStatuses') },
                { value: 'open', label: t('reports.statusOpen') },
                { value: 'in_review', label: t('reports.statusInReview') },
                { value: 'resolved', label: t('reports.statusResolved') },
                { value: 'dismissed', label: t('reports.statusDismissed') },
              ]}
            />
            <Select
              id="admin-reports-target"
              label={t('reports.targetTypeLabel')}
              value={targetType}
              onChange={(event) => setTargetType(event.target.value)}
              options={[
                { value: '', label: t('reports.allTargetTypes') },
                { value: 'opportunity', label: t('reports.targetOpportunity') },
                { value: 'user', label: t('reports.targetUser') },
                { value: 'organization', label: t('reports.targetOrganization') },
                { value: 'review', label: t('reports.targetReview') },
                { value: 'submission', label: t('reports.targetSubmission') },
              ]}
            />
            <Select
              id="admin-reports-priority"
              label={t('reports.priorityLabel')}
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              options={[
                { value: '', label: t('reports.allPriorities') },
                { value: 'low', label: t('reports.priorityLow') },
                { value: 'normal', label: t('reports.priorityNormal') },
                { value: 'high', label: t('reports.priorityHigh') },
              ]}
            />
            <Select
              id="admin-reports-sort"
              label={t('reports.sortLabel')}
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              options={[
                { value: '', label: t('reports.sortNewest') },
                { value: 'newest', label: t('reports.sortNewest') },
                { value: 'oldest', label: t('reports.sortOldest') },
                { value: 'priority', label: t('reports.sortPriority') },
              ]}
            />
            <Input
              id="admin-reports-q"
              label={t('shared.searchLabel')}
              placeholder={t('shared.searchPlaceholder')}
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
            <Input
              id="admin-reports-assignee"
              label={t('reports.assigneeLabel')}
              placeholder={t('reports.assigneePlaceholder')}
              value={assignedAdminId}
              onChange={(event) => setAssignedAdminId(event.target.value)}
            />
            <Input
              id="admin-reports-from"
              label={t('reports.fromLabel')}
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
            <Input
              id="admin-reports-to"
              label={t('reports.toLabel')}
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              {t('shared.clearFilters')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="admin-reports-csv"
              disabled={csvMutation.isPending}
              onClick={onExportCsv}
            >
              {t('reports.csvCta')}
            </Button>
          </div>
          {csvError ? (
            <p data-testid="admin-reports-csv-error" role="alert" className="mt-2 text-sm text-status-error">
              {t('reports.csvError')}
            </p>
          ) : null}
        </Card>
        {listQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {listQuery.isError ? (
          <SectionError testId="admin-reports-error" message={t('shared.loadError')} />
        ) : null}
        {listQuery.data ? (
          <p data-testid="admin-reports-count" className="text-sm text-ink-muted">
            {t('reports.count', { total: listQuery.data.total })}
          </p>
        ) : null}
        {listQuery.data && listQuery.data.items.length === 0 ? (
          <Empty title={t('shared.empty')} />
        ) : null}
        {(listQuery.data?.items ?? []).map((report) => {
          const id = reportIdOf(report);
          return (
            <ReportCard
              key={id}
              report={report}
              expanded={expandedId === id}
              onToggle={() => setExpandedId((current) => (current === id ? null : id))}
            />
          );
        })}
      </div>
    </RequireAdminModeration>
  );
}

