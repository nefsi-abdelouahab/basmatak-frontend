'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowUpDown,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  Download,
  Eye,
  FileText,
  Flag,
  History,
  Hourglass,
  Info,
  ListChecks,
  RotateCw,
  Search,
  ShieldCheck,
  Tag,
  UserPlus,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { ScrollFade } from '@/components/ui/ScrollFade';
import {
  MODERATION_ACTION_TYPES,
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

function formatDate(value: string | null | undefined, locale: string): string {
  if (typeof value !== 'string' || value === '') return '—';
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '—';
  return new Date(value).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ObjectIds are the only real report identifier (the mockup's synthetic
// report codes are fabricated). Render a short `#<tail>` form with the full
// id available via title — never a synthetic report code.
function shortReportId(reportId: string): string {
  if (reportId === '') return '—';
  const tail = reportId.length > 8 ? reportId.slice(-6).toUpperCase() : reportId;
  return `#${tail}`;
}

function statusDot(status: string): string {
  if (status === 'open') return 'bg-status-pending';
  if (status === 'in_review') return 'bg-status-pending';
  if (status === 'resolved') return 'bg-status-success';
  if (status === 'dismissed') return 'bg-ink-muted';
  return 'bg-ink-muted';
}

function statusLabelOf(
  t: (key: string) => string,
  status: string,
): string {
  if (status === 'open') return t('reports.statusOpen');
  if (status === 'in_review') return t('reports.statusInReview');
  if (status === 'resolved') return t('reports.statusResolved');
  if (status === 'dismissed') return t('reports.statusDismissed');
  return status === '' ? '—' : status;
}

function priorityLabelOf(
  t: (key: string) => string,
  priority: string,
): string {
  if (priority === 'low') return t('reports.priorityLow');
  if (priority === 'normal') return t('reports.priorityNormal');
  if (priority === 'high') return t('reports.priorityHigh');
  return priority === '' ? '—' : priority;
}

function targetTypeLabelOf(
  t: (key: string) => string,
  targetType: string,
): string {
  if (targetType === 'opportunity') return t('reports.targetOpportunity');
  if (targetType === 'user') return t('reports.targetUser');
  if (targetType === 'organization') return t('reports.targetOrganization');
  if (targetType === 'review') return t('reports.targetReview');
  if (targetType === 'submission') return t('reports.targetSubmission');
  return targetType === '' ? '—' : targetType;
}

function actionLabelOf(
  t: (key: string) => string,
  actionType: ModerationActionType,
): string {
  if (actionType === 'unpublish_opportunity') return t('reports.actionUnpublish');
  if (actionType === 'close_opportunity') return t('reports.actionClose');
  if (actionType === 'suspend_target') return t('reports.actionSuspend');
  return t('reports.actionNotice');
}

// Compact filter control with a leading icon (mockup control-bar style).
// Logical properties only so RTL mirrors automatically.
function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  Icon,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  Icon: LucideIcon;
}) {
  return (
    <div className="relative min-w-[10rem] flex-1">
      <Icon
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
      <select
        id={id}
        aria-label={label}
        title={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-border bg-surface ps-9 pe-8 text-sm text-ink focus:border-gold-strong focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronRight
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 rotate-90 text-ink-muted"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  Icon,
  testId,
}: {
  label: string;
  value: string;
  sub: string;
  Icon: LucideIcon;
  testId: string;
}) {
  return (
    <div data-testid={testId} className="flex min-w-0 flex-col gap-1 p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
        <Icon size={14} aria-hidden="true" className="shrink-0" />
        <span className="truncate">{label}</span>
      </p>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-xl font-semibold text-ink">{value}</span>
        <span className="text-xs text-ink-muted">{sub}</span>
      </p>
    </div>
  );
}

function errorMessageOf(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const backend = backendMessageOf(error);
    return backend === null ? fallback : `${error.code}: ${backend}`;
  }
  return fallback;
}

// Moderation history reads the report's own status-histories trail
// (`entityType=report`, singular — the value the backend writes). Rows are
// rendered as stored; every entry carries a leading icon.
function ReportHistory({ reportId }: { reportId: string }) {
  const t = useTranslations('adminModeration');
  const locale = useLocale();
  const historiesQuery = useStatusHistoriesQuery({ entityType: 'report', entityId: reportId });
  if (historiesQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (historiesQuery.isError)
    return <SectionError testId="admin-report-history-error" message={t('shared.loadError')} />;
  const rows = historiesQuery.data ?? [];
  if (rows.length === 0)
    return <p className="text-sm text-ink-muted">{t('reports.historyEmpty')}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <li
          key={`${row.from ?? 'na'}-${row.to ?? 'na'}-${index}`}
          data-testid="admin-report-history-row"
          className="flex items-start gap-2.5 text-sm"
        >
          <History size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium text-ink">
              {row.from ?? '—'} → {row.to ?? '—'}
            </span>
            {typeof row.reason === 'string' && row.reason !== '' ? (
              <span className="break-words text-ink-muted">{row.reason}</span>
            ) : null}
            {typeof row.notes === 'string' && row.notes !== '' ? (
              <span className="break-words text-ink-muted">{row.notes}</span>
            ) : null}
            <span className="text-xs text-ink-muted">
              {formatDate(
                typeof row.createdAt === 'string' ? row.createdAt : undefined,
                locale,
              )}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ReportDetail({
  report,
  onChanged,
  onClose,
}: {
  report: AdminReport;
  onChanged: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('adminModeration');
  const locale = useLocale();
  const reportId = reportIdOf(report);
  const targetId = reportTargetIdOf(report);
  const targetType = typeof report.targetType === 'string' ? report.targetType : '';
  const reporter = reporterNameOf(report.reporter ?? undefined);
  const targetLabel = targetLabelOf(report.target ?? report.targetSummary ?? undefined);
  const priority = typeof report.priority === 'string' ? report.priority : '';
  const status = typeof report.status === 'string' ? report.status : '';
  // Row-only detail (locked scope): the report row carries no reporter
  // verified flag, no organization/location facts, and no assignee name —
  // those would need follow-up reads. Every field below traces to the row
  // or to the status-histories read.
  const assignedAdminId =
    typeof report.assignedAdminId === 'string' ? report.assignedAdminId : '';
  const title = typeof report.title === 'string' ? report.title : '';
  const reason = typeof report.reason === 'string' ? report.reason : '';
  const description = typeof report.description === 'string' ? report.description : '';

  const [assignee, setAssignee] = useState('');
  const [assignError, setAssignError] = useState(false);
  const [assignDone, setAssignDone] = useState(false);
  const [resolution, setResolution] = useState('');
  const [actionType, setActionType] = useState<ModerationActionType | ''>('');
  const [noticeUserId, setNoticeUserId] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolveConflict, setResolveConflict] = useState(false);
  const [resolveDone, setResolveDone] = useState<ReportResolveStatus | null>(null);
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

  // The action dropdown is rebuilt from the real moderation-action registry,
  // filtered by the compatibility matrix for this report's target — unknown
  // actions and mismatched targets never reach the backend (400 otherwise).
  const compatibleActions = MODERATION_ACTION_TYPES.filter((candidate) =>
    isCompatibleActionTarget(candidate, targetType),
  );
  const action = buildResolveActionPayload(
    { actionType, noticeUserId, noticeMessage },
    targetType,
  );
  const actionRequested = actionType !== '';
  const incompatible = actionRequested && !isCompatibleActionTarget(actionType, targetType);
  const noticeIncomplete =
    actionType === 'notice' && (noticeUserId.trim() === '' || !isNoticeValid(noticeMessage));
  const resolutionMissing = action !== null && !isResolutionValid(resolution);
  const canResolve =
    !resolveMutation.isPending &&
    !confirming &&
    !incompatible &&
    !noticeIncomplete &&
    !resolutionMissing &&
    confirmed &&
    canResolveWithPayload('resolved', resolution, action);

  const onAssign = () => {
    const trimmed = assignee.trim();
    if (trimmed === '') return;
    setAssignError(false);
    setAssignDone(false);
    assignMutation.mutate(
      { reportId, assignedAdminId: trimmed },
      {
        onError: () => setAssignError(true),
        onSuccess: () => {
          setAssignDone(true);
          onChanged();
        },
      },
    );
  };

  const runResolve = (nextStatus: ReportResolveStatus, withAction: boolean) => {
    setResolveError(null);
    setResolveConflict(false);
    setResolveDone(null);
    setConfirmation(null);
    resolveMutation.mutate(
      {
        reportId,
        input: {
          status: nextStatus,
          resolution: resolution === '' ? undefined : resolution,
          action: withAction ? action : null,
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
          onChanged();
          if (nextStatus === 'resolved' && withAction) {
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
          } else {
            setResolveDone(nextStatus);
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
      onSuccess: () => {
        setHideState('done');
        onChanged();
      },
    });
  };

  return (
    <div data-testid={`admin-report-detail-${reportId}`} className="flex min-w-0 flex-col gap-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className="truncate font-mono text-sm font-semibold text-ink"
            title={reportId}
          >
            {shortReportId(reportId)}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink">
            <Flag size={14} aria-hidden="true" className="shrink-0 text-ink-muted" />
            {priorityLabelOf(t, priority)}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${statusDot(status)}`}
            />
            {statusLabelOf(t, status)}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t('shared.close')}
          title={t('reports.detailClose')}
          onClick={onClose}
          className="xl:hidden"
        >
          <X size={16} aria-hidden="true" />
        </Button>
      </div>

      {title !== '' ? (
        <h3 className="break-words text-lg font-semibold text-ink">{title}</h3>
      ) : (
        <h3 className="text-lg font-semibold text-ink">{t('reports.detailTitle')}</h3>
      )}
      <p className="text-sm text-ink-muted">
        {t('reports.submittedOn', {
          date: formatDate(
            typeof report.createdAt === 'string' ? report.createdAt : undefined,
            locale,
          ),
        })}{' '}
        · {t('reports.reportedByLine', { name: reporter === '' ? '—' : reporter })}
      </p>

      {description !== '' ? (
        <section aria-label={t('reports.statementTitle')} className="rounded-lg border border-border bg-surface-muted/60 p-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-muted">
            {t('reports.statementTitle')}
          </p>
          <p className="break-words text-sm leading-relaxed text-ink">{description}</p>
        </section>
      ) : null}

      <section aria-label={t('reports.targetLabel')}>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
          {t('reports.targetLabel')}
        </p>
        <dl className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
          <div className="flex items-center gap-2">
            <Tag size={16} aria-hidden="true" className="shrink-0 text-ink-muted" />
            <dt className="shrink-0 text-ink-muted">{t('reports.entityCategory')}</dt>
            <dd className="ms-auto text-end font-medium text-ink">
              {targetTypeLabelOf(t, targetType)}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <FileText size={16} aria-hidden="true" className="shrink-0 text-ink-muted" />
            <dt className="shrink-0 text-ink-muted">{t('reports.entityName')}</dt>
            <dd className="ms-auto min-w-0 truncate text-end font-medium text-ink" title={targetLabel}>
              {targetLabel === '' ? '—' : targetLabel}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <Info size={16} aria-hidden="true" className="shrink-0 text-ink-muted" />
            <dt className="shrink-0 text-ink-muted">{t('reports.entityTargetId')}</dt>
            <dd
              className="ms-auto min-w-0 truncate text-end font-mono text-xs text-ink"
              title={targetId}
            >
              {targetId === '' ? '—' : targetId}
            </dd>
          </div>
          {reason !== '' ? (
            <div className="flex items-start gap-2 border-t border-border-muted pt-2">
              <dt className="shrink-0 text-ink-muted">{t('reports.reasonLabel')}</dt>
              <dd className="ms-auto break-words text-end text-ink">{reason}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section aria-label={t('reports.historyTitle')} id={`admin-report-history-${reportId}`}>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
          {t('reports.historyTitle')}
        </p>
        <ReportHistory reportId={reportId} />
      </section>

      <section aria-label={t('reports.resolveTitle')} className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
          {t('reports.resolveTitle')}
        </p>
        <div>
          <label
            htmlFor={`admin-resolve-action-${reportId}`}
            className="mb-1 block text-sm font-medium text-ink"
          >
            {t('reports.actionLabel')}
          </label>
          <select
            id={`admin-resolve-action-${reportId}`}
            value={actionType}
            onChange={(event) => setActionType(event.target.value as ModerationActionType | '')}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:border-gold-strong focus:outline-none"
          >
            <option value="">{t('reports.noAction')}</option>
            {compatibleActions.map((candidate) => (
              <option key={candidate} value={candidate}>
                {actionLabelOf(t, candidate)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={`admin-resolve-resolution-${reportId}`}
            className="mb-1 block text-sm font-medium text-ink"
          >
            {t('reports.resolutionLabel')}
          </label>
          <textarea
            id={`admin-resolve-resolution-${reportId}`}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-gold-strong focus:outline-none"
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
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label
                htmlFor={`admin-resolve-notice-user-${reportId}`}
                className="mb-1 block text-sm font-medium text-ink"
              >
                {t('reports.noticeUserLabel')}
              </label>
              <input
                id={`admin-resolve-notice-user-${reportId}`}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:border-gold-strong focus:outline-none"
                value={noticeUserId}
                onChange={(event) => setNoticeUserId(event.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor={`admin-resolve-notice-message-${reportId}`}
                className="mb-1 block text-sm font-medium text-ink"
              >
                {t('reports.noticeMessageLabel')}
              </label>
              <input
                id={`admin-resolve-notice-message-${reportId}`}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:border-gold-strong focus:outline-none"
                value={noticeMessage}
                onChange={(event) => setNoticeMessage(event.target.value)}
              />
            </div>
          </div>
        ) : null}
        {incompatible ? (
          <p
            data-testid={`admin-resolve-incompatible-${reportId}`}
            role="alert"
            className="text-sm text-status-error"
          >
            {t('reports.actionIncompatible')}
          </p>
        ) : null}
        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-muted/60 p-3">
          <input
            id={`admin-resolve-confirm-${reportId}`}
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border"
          />
          <label
            htmlFor={`admin-resolve-confirm-${reportId}`}
            className="cursor-pointer select-none text-sm text-ink"
          >
            {t('reports.confirmCopy')}
          </label>
        </div>
        {!confirmed ? (
          <p className="text-xs text-ink-muted">{t('reports.confirmRequired')}</p>
        ) : null}
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            data-testid={`admin-resolve-apply-${reportId}`}
            disabled={!canResolve}
            onClick={() => runResolve('resolved', true)}
            className="h-10"
          >
            <ShieldCheck size={16} aria-hidden="true" />
            {resolveMutation.isPending || confirming
              ? t('shared.saving')
              : t('reports.resolveTakeAction')}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid={`admin-dismiss-${reportId}`}
              disabled={resolveMutation.isPending || confirming}
              onClick={() => runResolve('dismissed', false)}
            >
              {t('reports.dismissCta')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid={`admin-mark-review-${reportId}`}
              disabled={resolveMutation.isPending || confirming}
              onClick={() => runResolve('in_review', false)}
            >
              {t('reports.markInReviewCta')}
            </Button>
          </div>
        </div>
        {resolveConflict ? (
          <p
            data-testid={`admin-resolve-conflict-${reportId}`}
            role="alert"
            className="text-sm text-status-error"
          >
            {t('reports.resolveConflict')}
          </p>
        ) : null}
        {resolveError ? (
          <p
            data-testid={`admin-resolve-error-${reportId}`}
            role="alert"
            className="text-sm text-status-error"
          >
            {resolveError}
          </p>
        ) : null}
        {resolveDone ? (
          <p data-testid={`admin-resolve-done-${reportId}`} className="text-sm font-medium text-ink">
            {t('reports.confirmedTitle')}: {t('reports.confirmedDescription')}
          </p>
        ) : null}
        {confirmation?.confirmed ? (
          <p
            data-testid={`admin-resolve-confirmed-${reportId}`}
            className="text-sm font-medium text-ink"
          >
            {t('reports.confirmedTitle')}: {t('reports.confirmedDescription')}
          </p>
        ) : null}
        {confirmation && !confirmation.confirmed ? (
          <p
            data-testid={`admin-resolve-unconfirmed-${reportId}`}
            role="alert"
            className="text-sm text-status-error"
          >
            {t('reports.unconfirmedTitle')}: {t('reports.unconfirmedDescription')}
          </p>
        ) : null}
      </section>

      <section aria-label={t('reports.assignTitle')} className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
          {t('reports.assignTitle')}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-ink">
          <UserPlus size={16} aria-hidden="true" className="shrink-0 text-ink-muted" />
          {assignedAdminId === '' ? (
            <span className="text-ink-muted">{t('reports.unassignedLabel')}</span>
          ) : (
            <span className="min-w-0 truncate font-mono text-xs" title={assignedAdminId}>
              {t('reports.assignedIdLabel')}: {shortReportId(assignedAdminId)}
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1">
            <label
              htmlFor={`admin-assign-${reportId}`}
              className="mb-1 block text-sm font-medium text-ink"
            >
              {t('reports.assigneeLabel')}
            </label>
            <input
              id={`admin-assign-${reportId}`}
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-gold-strong focus:outline-none"
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
            className="h-10"
          >
            {t('reports.assignCta')}
          </Button>
        </div>
        {assignError ? (
          <p
            data-testid={`admin-assign-error-${reportId}`}
            role="alert"
            className="text-sm text-status-error"
          >
            {t('reports.assignError')}
          </p>
        ) : null}
        {assignDone ? (
          <p data-testid={`admin-assign-done-${reportId}`} className="text-sm text-ink-muted">
            {t('reports.assignCta')}
          </p>
        ) : null}
      </section>

      <section aria-label={t('reports.noticeTitle')} className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
          {t('reports.noticeTitle')}
        </p>
        <div>
          <label
            htmlFor={`admin-notice-user-${reportId}`}
            className="mb-1 block text-sm font-medium text-ink"
          >
            {t('reports.noticeUserLabel')}
          </label>
          <input
            id={`admin-notice-user-${reportId}`}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:border-gold-strong focus:outline-none"
            value={standaloneUserId}
            onChange={(event) => setStandaloneUserId(event.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor={`admin-notice-message-${reportId}`}
            className="mb-1 block text-sm font-medium text-ink"
          >
            {t('reports.noticeMessageLabel')}
          </label>
          <input
            id={`admin-notice-message-${reportId}`}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:border-gold-strong focus:outline-none"
            value={standaloneMessage}
            onChange={(event) => setStandaloneMessage(event.target.value)}
          />
        </div>
        <div>
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
          <p data-testid={`admin-notice-done-${reportId}`} className="text-sm text-ink-muted">
            {t('reports.noticeSent')}
          </p>
        ) : null}
        {noticeState === 'suppressed' ? (
          <p data-testid={`admin-notice-done-${reportId}`} className="text-sm text-ink-muted">
            {t('reports.noticeSuppressed')}
          </p>
        ) : null}
        {noticeState === 'error' ? (
          <p
            data-testid={`admin-notice-error-${reportId}`}
            role="alert"
            className="text-sm text-status-error"
          >
            {t('reports.noticeError')}
          </p>
        ) : null}
      </section>

      {targetType === 'review' && targetId !== '' ? (
        <section aria-label={t('reports.hideTitle')} className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
            {t('reports.hideTitle')}
          </p>
          <div>
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
          </div>
          {hideState === 'done' ? (
            <p data-testid={`admin-hide-done-${reportId}`} className="text-sm text-ink-muted">
              {t('reports.hideDone')}
            </p>
          ) : null}
          {hideState === 'conflict' ? (
            <p
              data-testid={`admin-hide-conflict-${reportId}`}
              role="alert"
              className="text-sm text-status-error"
            >
              {t('reports.hideConflict')}
            </p>
          ) : null}
          {hideState === 'error' ? (
            <p
              data-testid={`admin-hide-error-${reportId}`}
              role="alert"
              className="text-sm text-status-error"
            >
              {t('reports.hideError')}
            </p>
          ) : null}
        </section>
      ) : null}

      <footer className="flex items-center justify-between gap-2 border-t border-border-muted pt-3 text-xs text-ink-muted">
        <span className="min-w-0 truncate">
          {assignedAdminId === ''
            ? t('reports.unassignedLabel')
            : `${t('reports.assignedIdLabel')}: ${shortReportId(assignedAdminId)}`}
        </span>
        <a
          href={`#admin-report-history-${reportId}`}
          className="shrink-0 underline-offset-2 hover:underline"
        >
          {t('reports.auditCta')}
        </a>
      </footer>
    </div>
  );
}

// Reports & Moderation rebuild from
// `design/Basmatak Tatatoua - Reports & Moderation/` (code.html + screen.png):
// breadcrumb + header with search/export/refresh, five real count cards
// (total + one per report status — the mockup's sixth "compliance" card has
// no backend concept and is deleted), real-enum filters, and a master table
// with a right-side inspection panel (fixed drawer below xl, sticky panel on
// xl). The workspace chrome (admin sidebar + top navbar + mobile tab bar)
// lives in Shell/Sidebar/BottomNav/Navbar — this file owns the reports
// content. Guest visits redirect to Login (decision 10); non-admin roles see
// the shared 403 state. Neutral vocabulary only — no sanction wording, no
// fabricated identifiers, no invented actions.
export function AdminReportsPage({ locale }: { locale: string }) {
  const t = useTranslations('adminModeration');
  const currentLocale = useLocale();
  const activeLocale = currentLocale || locale;
  const numberFormat = useMemo(() => new Intl.NumberFormat(activeLocale), [activeLocale]);
  const [status, setStatus] = useState('');
  const [targetType, setTargetType] = useState('');
  const [priority, setPriority] = useState('');
  const [assignedAdminId, setAssignedAdminId] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('');
  const [limit, setLimit] = useState(20);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [csvError, setCsvError] = useState(false);

  // Defense in depth behind the route guard: non-admin sessions never fire
  // admin reads (the guard already blocks the UI).
  const session = useSessionQuery();
  const isAdmin = session.data?.role === 'admin';

  // Stat counts: no per-status totals endpoint exists, so each card reads
  // `.total` from a light `limit: 1` list query (locked review decision).
  const totalQuery = useAdminReportsQuery({ limit: 1 }, { enabled: isAdmin });
  const openQuery = useAdminReportsQuery({ status: 'open', limit: 1 }, { enabled: isAdmin });
  const inReviewQuery = useAdminReportsQuery(
    { status: 'in_review', limit: 1 },
    { enabled: isAdmin },
  );
  const resolvedQuery = useAdminReportsQuery(
    { status: 'resolved', limit: 1 },
    { enabled: isAdmin },
  );
  const dismissedQuery = useAdminReportsQuery(
    { status: 'dismissed', limit: 1 },
    { enabled: isAdmin },
  );

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
      limit,
      cursor,
    },
    { enabled: isAdmin },
  );
  const csvMutation = useAdminReportsCsvExportMutation();

  const resetPage = () => {
    setCursor(undefined);
    setCursorHistory([]);
  };

  // Close the drawer on Escape.
  useEffect(() => {
    if (selectedId === undefined) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const clearFilters = () => {
    setStatus('');
    setTargetType('');
    setPriority('');
    setAssignedAdminId('');
    setQ('');
    setFrom('');
    setTo('');
    setSort('');
    resetPage();
  };

  const goNext = () => {
    const next = listQuery.data?.nextCursor;
    if (!next) return;
    setCursorHistory((history) => (cursor ? [...history, cursor] : history));
    setCursor(next);
  };

  const goBack = () => {
    setCursorHistory((history) => {
      const previous = history[history.length - 1];
      setCursor(previous);
      return history.slice(0, -1);
    });
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

  const onRefresh = () => {
    void totalQuery.refetch();
    void openQuery.refetch();
    void inReviewQuery.refetch();
    void resolvedQuery.refetch();
    void dismissedQuery.refetch();
    void listQuery.refetch();
  };

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const selected = items.find((row) => reportIdOf(row) === selectedId);

  const statsPending =
    totalQuery.isPending ||
    openQuery.isPending ||
    inReviewQuery.isPending ||
    resolvedQuery.isPending ||
    dismissedQuery.isPending;
  const statsError =
    totalQuery.isError ||
    openQuery.isError ||
    inReviewQuery.isError ||
    resolvedQuery.isError ||
    dismissedQuery.isError;

  return (
    <RequireAdminModeration locale={locale} next={`/admin/reports`}>
      <Container testId="admin-reports" className="flex min-w-0 flex-col gap-6 py-6">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1 text-sm text-ink-muted"
        >
          <span>{t('reports.crumbsAdministration')}</span>
          <ChevronRight size={14} aria-hidden="true" className="shrink-0" />
          <span>{t('reports.crumbsModeration')}</span>
          <ChevronRight size={14} aria-hidden="true" className="shrink-0" />
          <span aria-current="page" className="font-medium text-ink">
            {t('reports.crumbsCurrent')}
          </span>
        </nav>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-ink">{t('reports.title')}</h1>
            <p className="mt-1 text-sm text-ink-muted">{t('reports.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                id="admin-reports-q"
                type="search"
                value={q}
                placeholder={t('reports.headerSearchPlaceholder')}
                aria-label={t('shared.searchLabel')}
                onChange={(event) => {
                  setQ(event.target.value);
                  resetPage();
                }}
                className="h-10 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-muted focus:border-gold-strong focus:outline-none"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="admin-reports-csv"
              disabled={csvMutation.isPending}
              onClick={onExportCsv}
              className="h-10"
            >
              <Download size={14} aria-hidden="true" />
              {csvMutation.isPending ? t('shared.downloading') : t('reports.exportReports')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label={t('reports.refreshReports')}
              title={t('reports.refreshReports')}
              disabled={listQuery.isFetching}
              onClick={onRefresh}
              className="h-10 w-10"
            >
              <RotateCw size={14} aria-hidden="true" />
            </Button>
          </div>
        </div>
        {csvError ? (
          <p data-testid="admin-reports-csv-error" role="alert" className="text-sm text-status-error">
            {t('reports.csvError')}
          </p>
        ) : null}

        <section
          aria-label={t('reports.statsLabel')}
          className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3 xl:grid-cols-5"
        >
          <div className="bg-surface">
            <StatCard
              testId="admin-reports-stat-total"
              Icon={Flag}
              label={t('reports.statTotal')}
              value={totalQuery.data ? numberFormat.format(totalQuery.data.total) : '…'}
              sub={t('reports.statTotalSub')}
            />
          </div>
          <div className="bg-surface">
            <StatCard
              testId="admin-reports-stat-open"
              Icon={Hourglass}
              label={t('reports.statOpen')}
              value={openQuery.data ? numberFormat.format(openQuery.data.total) : '…'}
              sub={t('reports.statOpenSub')}
            />
          </div>
          <div className="bg-surface">
            <StatCard
              testId="admin-reports-stat-in-review"
              Icon={Eye}
              label={t('reports.statInReview')}
              value={inReviewQuery.data ? numberFormat.format(inReviewQuery.data.total) : '…'}
              sub={t('reports.statInReviewSub')}
            />
          </div>
          <div className="bg-surface">
            <StatCard
              testId="admin-reports-stat-resolved"
              Icon={CircleCheck}
              label={t('reports.statResolved')}
              value={resolvedQuery.data ? numberFormat.format(resolvedQuery.data.total) : '…'}
              sub={t('reports.statResolvedSub')}
            />
          </div>
          <div className="bg-surface">
            <StatCard
              testId="admin-reports-stat-dismissed"
              Icon={XCircle}
              label={t('reports.statDismissed')}
              value={dismissedQuery.data ? numberFormat.format(dismissedQuery.data.total) : '…'}
              sub={t('reports.statDismissedSub')}
            />
          </div>
        </section>
        {statsPending ? <Loader label={t('shared.loading')} /> : null}
        {statsError ? (
          <SectionError testId="admin-reports-stats-error" message={t('shared.loadError')} />
        ) : null}

        <Card title={t('reports.filtersTitle')}>
          <div
            data-testid="admin-reports-filters"
            className="flex flex-wrap items-end gap-2"
          >
            <FilterSelect
              id="admin-reports-status"
              label={t('reports.statusLabel')}
              value={status}
              onChange={(value) => {
                setStatus(value);
                resetPage();
              }}
              Icon={ListChecks}
              options={[
                { value: '', label: t('reports.allStatuses') },
                { value: 'open', label: t('reports.statusOpen') },
                { value: 'in_review', label: t('reports.statusInReview') },
                { value: 'resolved', label: t('reports.statusResolved') },
                { value: 'dismissed', label: t('reports.statusDismissed') },
              ]}
            />
            <FilterSelect
              id="admin-reports-target"
              label={t('reports.targetTypeLabel')}
              value={targetType}
              onChange={(value) => {
                setTargetType(value);
                resetPage();
              }}
              Icon={Tag}
              options={[
                { value: '', label: t('reports.allTargetTypes') },
                { value: 'opportunity', label: t('reports.targetOpportunity') },
                { value: 'user', label: t('reports.targetUser') },
                { value: 'organization', label: t('reports.targetOrganization') },
                { value: 'review', label: t('reports.targetReview') },
                { value: 'submission', label: t('reports.targetSubmission') },
              ]}
            />
            <FilterSelect
              id="admin-reports-priority"
              label={t('reports.priorityLabel')}
              value={priority}
              onChange={(value) => {
                setPriority(value);
                resetPage();
              }}
              Icon={Flag}
              options={[
                { value: '', label: t('reports.allPriorities') },
                { value: 'low', label: t('reports.priorityLow') },
                { value: 'normal', label: t('reports.priorityNormal') },
                { value: 'high', label: t('reports.priorityHigh') },
              ]}
            />
            <FilterSelect
              id="admin-reports-sort"
              label={t('reports.sortLabel')}
              value={sort}
              onChange={(value) => {
                setSort(value);
                resetPage();
              }}
              Icon={ArrowUpDown}
              options={[
                { value: '', label: t('reports.sortNewest') },
                { value: 'newest', label: t('reports.sortNewest') },
                { value: 'oldest', label: t('reports.sortOldest') },
                { value: 'priority', label: t('reports.sortPriority') },
              ]}
            />
            <div className="relative min-w-[10rem] flex-1">
              <CalendarDays
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                id="admin-reports-from"
                type="date"
                aria-label={t('reports.fromLabel')}
                title={t('reports.fromLabel')}
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  resetPage();
                }}
                className="h-10 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-sm text-ink focus:border-gold-strong focus:outline-none"
              />
            </div>
            <div className="relative min-w-[10rem] flex-1">
              <CalendarDays
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                id="admin-reports-to"
                type="date"
                aria-label={t('reports.toLabel')}
                title={t('reports.toLabel')}
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  resetPage();
                }}
                className="h-10 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-sm text-ink focus:border-gold-strong focus:outline-none"
              />
            </div>
            <div className="relative min-w-[10rem] flex-1">
              <UserPlus
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                id="admin-reports-assignee"
                aria-label={t('reports.assigneeLabel')}
                title={t('reports.assigneeLabel')}
                placeholder={t('reports.assigneePlaceholder')}
                value={assignedAdminId}
                onChange={(event) => {
                  setAssignedAdminId(event.target.value);
                  resetPage();
                }}
                className="h-10 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-muted focus:border-gold-strong focus:outline-none"
              />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-10">
              <X size={14} aria-hidden="true" />
              {t('shared.clearFilters')}
            </Button>
          </div>
        </Card>

        {listQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {listQuery.isError ? (
          <SectionError testId="admin-reports-error" message={t('shared.loadError')} />
        ) : null}

        <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-3">
          <Card className="min-w-0 p-0 xl:col-span-2">
            <div className="overflow-x-auto" tabIndex={0}>
              <table className="w-full text-start">
                <thead>
                  <tr className="border-b border-border text-start text-xs uppercase tracking-wider text-ink-muted">
                    <th scope="col" className="px-4 py-3 text-start font-medium">
                      {t('reports.colReport')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-medium">
                      {t('reports.colType')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-medium">
                      {t('reports.colReporter')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-medium">
                      {t('reports.colReason')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-medium">
                      {t('reports.colSubmitted')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-medium">
                      {t('reports.colStatus')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-medium">
                      {t('reports.colPriority')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-end font-medium">
                      <span className="sr-only">{t('shared.details')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-muted text-sm">
                  {items.map((row) => {
                    const id = reportIdOf(row);
                    const rowSelected = id === selectedId;
                    const rowStatus = typeof row.status === 'string' ? row.status : '';
                    const rowPriority = typeof row.priority === 'string' ? row.priority : '';
                    const rowTargetType =
                      typeof row.targetType === 'string' ? row.targetType : '';
                    const rowReporter = reporterNameOf(row.reporter ?? undefined);
                    const rowTitle = typeof row.title === 'string' ? row.title : '';
                    const rowReason = typeof row.reason === 'string' ? row.reason : '';
                    return (
                      <tr
                        key={id}
                        onClick={() => setSelectedId(id)}
                        aria-selected={rowSelected}
                        className={`cursor-pointer transition-colors hover:bg-surface-muted ${
                          rowSelected ? 'bg-gold-soft/40' : ''
                        }`}
                      >
                        <td className="max-w-[14rem] px-4 py-3">
                          <p className="font-mono text-xs font-semibold text-ink" title={id}>
                            {shortReportId(id)}
                          </p>
                          <p className="truncate text-ink" title={rowTitle}>
                            {rowTitle === '' ? '—' : rowTitle}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                          {targetTypeLabelOf(t, rowTargetType)}
                        </td>
                        <td className="max-w-[10rem] truncate px-4 py-3 text-ink-muted" title={rowReporter}>
                          {rowReporter === '' ? '—' : rowReporter}
                        </td>
                        <td
                          className="max-w-[12rem] truncate px-4 py-3 text-ink-muted"
                          title={rowReason}
                        >
                          {rowReason === '' ? '—' : rowReason}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                          {formatDate(
                            typeof row.createdAt === 'string' ? row.createdAt : undefined,
                            activeLocale,
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs text-ink">
                            <span
                              aria-hidden="true"
                              className={`h-1.5 w-1.5 rounded-full ${statusDot(rowStatus)}`}
                            />
                            {statusLabelOf(t, rowStatus)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs text-ink">
                            <Flag size={14} aria-hidden="true" className="shrink-0 text-ink-muted" />
                            {priorityLabelOf(t, rowPriority)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            data-testid={`admin-report-open-${id}`}
                            aria-label={t('reports.inspect')}
                            title={t('reports.inspect')}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedId(id);
                            }}
                          >
                            <Eye size={16} aria-hidden="true" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {listQuery.data && items.length === 0 ? (
              <div className="p-4">
                <Empty title={t('shared.empty')} />
              </div>
            ) : null}
            {listQuery.data ? (
              <div className="flex flex-col gap-3 border-t border-border-muted px-4 py-3 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
                <p data-testid="admin-reports-count">
                  {t('reports.showing', { shown: items.length, total })}
                  {typeof listQuery.data.page === 'number' &&
                  typeof listQuery.data.pages === 'number' &&
                  listQuery.data.pages > 0
                    ? ` · ${t('reports.pageOf', {
                        page: listQuery.data.page,
                        pages: listQuery.data.pages,
                      })}`
                    : null}
                </p>
                <div className="flex items-center gap-2">
                  {cursorHistory.length > 0 || cursor ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      data-testid="admin-reports-back"
                      onClick={goBack}
                    >
                      {t('shared.prevPage')}
                    </Button>
                  ) : null}
                  {listQuery.data.nextCursor ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      data-testid="admin-reports-next"
                      onClick={goNext}
                    >
                      {t('shared.nextPage')}
                    </Button>
                  ) : null}
                  <label
                    htmlFor="admin-reports-limit"
                    className="flex items-center gap-1.5 border-s border-border ps-3"
                  >
                    {t('reports.perPage')}
                    <select
                      id="admin-reports-limit"
                      value={String(limit)}
                      onChange={(event) => {
                        setLimit(Number(event.target.value) || 20);
                        resetPage();
                      }}
                      className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink focus:border-gold-strong focus:outline-none"
                    >
                      <option value="20">20</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                    </select>
                  </label>
                </div>
              </div>
            ) : null}
          </Card>

          {selected ? (
            <>
              <div
                aria-hidden="true"
                onClick={() => setSelectedId(undefined)}
                className="fixed inset-0 z-30 bg-ink/40 xl:hidden"
              />
              <ScrollFade
                as="aside"
                role="region"
                aria-label={t('reports.detailTitle')}
                className="fixed inset-y-0 end-0 z-40 w-[min(94vw,30rem)] border-s border-border bg-surface p-4 shadow-modal xl:sticky xl:top-20 xl:z-auto xl:col-span-1 xl:w-auto xl:self-start xl:rounded-xl xl:border xl:p-4 xl:shadow-sm"
                viewportClassName="overflow-y-auto xl:overflow-visible"
              >
                <ReportDetail
                  key={reportIdOf(selected)}
                  report={selected}
                  onChanged={() => {
                    void listQuery.refetch();
                    void totalQuery.refetch();
                    void openQuery.refetch();
                    void inReviewQuery.refetch();
                    void resolvedQuery.refetch();
                    void dismissedQuery.refetch();
                  }}
                  onClose={() => setSelectedId(undefined)}
                />
              </ScrollFade>
            </>
          ) : null}
        </div>
      </Container>
    </RequireAdminModeration>
  );
}
