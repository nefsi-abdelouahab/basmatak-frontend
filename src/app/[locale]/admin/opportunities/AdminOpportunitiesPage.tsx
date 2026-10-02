'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Activity,
  ArrowUpDown,
  BadgeCheck,
  Ban,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  Flag,
  Hash,
  History,
  Inbox,
  ListChecks,
  Lock,
  MapPin,
  Megaphone,
  RotateCw,
  Search,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import {
  isAdminOppCloseStatus,
  type AdminOpportunityRow,
  type AdminOpportunityVerificationRow,
} from '@/lib/api/adminLists';
import {
  useAdminOpportunitiesCsvMutation,
  useAdminOpportunitiesQuery,
  useAdminOpportunityStatusMutation,
  useAdminOpportunityVerificationStatusQuery,
  useAdminStatusHistoriesQuery,
} from '@/hooks/useAdminLists';
import { useAdminAnalyticsOverviewQuery } from '@/hooks/useAdminAnalytics';
import { useAdminReportsQuery } from '@/hooks/useAdminModeration';
import {
  useFeedSkillCategoriesQuery,
  useFeedSkillsQuery,
} from '@/hooks/useFeed';
import { AdminDialog } from '../AdminDialog';

function rowId(row: AdminOpportunityRow): string {
  if (typeof row.id === 'string' && row.id !== '') return row.id;
  if (typeof row._id === 'string') return row._id;
  return '';
}

function displayTitle(row: AdminOpportunityRow): string {
  if (typeof row.title === 'string' && row.title !== '') return row.title;
  if (typeof row.slug === 'string' && row.slug !== '') return row.slug;
  return rowId(row);
}

function orgNameOf(row: AdminOpportunityRow): string {
  if (typeof row.organizationName === 'string' && row.organizationName !== '')
    return row.organizationName;
  return '—';
}

function statusDot(status: string): string {
  if (status === 'published') return 'bg-emerald-600';
  if (status === 'in_progress') return 'bg-sky-600';
  if (status === 'completed') return 'bg-teal-600';
  if (status === 'closed' || status === 'cancelled') return 'bg-rose-600';
  return 'bg-zinc-400';
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

function expRegistryOf(registryId: string | null | undefined): string {
  if (typeof registryId !== 'string' || registryId === '') return '—';
  return registryId.startsWith('EXP-') ? registryId : `EXP-${registryId}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

interface DetailPosition {
  key: string;
  title: string;
  requiredCount: number;
  filledCount: number;
  requiredSkills: string[];
  deliverables: string[];
}

// Positions arrive as the embedded opportunity sub-documents (title,
// requiredCount, filledCount, requiredSkills ObjectIds, deliverables
// verbatim strings). Parse defensively; unknown shapes render as Untitled
// with zero seats rather than crashing the panel.
function positionOf(value: unknown, index: number): DetailPosition {
  const rec = asRecord(value);
  const title =
    rec !== null && typeof rec.title === 'string' && rec.title !== ''
      ? rec.title
      : `—`;
  const requiredCount =
    rec !== null && typeof rec.requiredCount === 'number' ? rec.requiredCount : 0;
  const filledCount =
    rec !== null && typeof rec.filledCount === 'number' ? rec.filledCount : 0;
  const rawSkills = rec !== null ? rec.requiredSkills : undefined;
  const requiredSkills = Array.isArray(rawSkills)
    ? rawSkills
        .map((skill) => {
          if (typeof skill === 'string') return skill;
          const skillRec = asRecord(skill);
          const id = skillRec !== null ? skillRec._id ?? skillRec.id : undefined;
          return typeof id === 'string' ? id : String(skill);
        })
        .filter((skill) => skill !== '')
    : [];
  const rawDeliverables = rec !== null ? rec.deliverables : undefined;
  const deliverables = Array.isArray(rawDeliverables)
    ? rawDeliverables.filter(
        (entry): entry is string => typeof entry === 'string' && entry !== '',
      )
    : [];
  const rawId = rec !== null ? (rec._id ?? rec.id) : undefined;
  return {
    key: typeof rawId === 'string' && rawId !== '' ? rawId : `pos-${index}`,
    title,
    requiredCount,
    filledCount,
    requiredSkills,
    deliverables,
  };
}

function SectionError({ message, testId }: { message: string; testId: string }) {
  return (
    <p data-testid={testId} role="alert" className="text-sm text-status-error">
      {message}
    </p>
  );
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
  Icon: typeof MapPin;
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
        className="h-10 w-full appearance-none rounded-lg border border-border bg-surface ps-9 pe-8 text-sm text-ink focus:border-primary focus:outline-none"
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
  Icon: typeof Users;
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

function submissionLabel(
  status: string | null,
  t: (key: string) => string,
): string {
  if (status === 'draft') return t('opportunities.subDraft');
  if (status === 'submitted') return t('opportunities.subSubmitted');
  if (status === 'under_review') return t('opportunities.subUnderReview');
  if (status === 'approved') return t('opportunities.subApproved');
  if (status === 'rejected') return t('opportunities.subRejected');
  return t('opportunities.verificationNoSubmission');
}

function VerificationRow({
  row,
  locale,
  t,
}: {
  row: AdminOpportunityVerificationRow;
  locale: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const name =
    typeof row.volunteerName === 'string' && row.volunteerName !== ''
      ? row.volunteerName
      : (row.username ?? '—');
  const approved = row.submissionStatus === 'approved';
  return (
    <div className="flex items-start gap-3 py-3">
      <img
        src="/user.jpg"
        alt={name}
        width={32}
        height={32}
        loading="lazy"
        onError={(event) => {
          if (!event.currentTarget.src.endsWith('/user.jpg')) {
            event.currentTarget.src = '/user.jpg';
          }
        }}
        className="shrink-0 rounded-full object-cover"
        style={{ width: 32, height: 32 }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-medium text-ink">
            {name}
            {typeof row.volunteerRegistryId === 'string' &&
            row.volunteerRegistryId !== '' ? (
              <span className="ms-2 text-xs font-normal text-ink-muted">
                {row.volunteerRegistryId}
              </span>
            ) : null}
          </p>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-ink">
            {approved ? (
              <CheckCircle2
                size={14}
                aria-hidden="true"
                className="text-emerald-600"
              />
            ) : (
              <Clock3 size={14} aria-hidden="true" className="text-ink-muted" />
            )}
            {submissionLabel(row.submissionStatus, t)}
          </span>
        </div>
        <p className="text-xs text-ink-muted">
          {row.positionTitle ?? '—'} · {row.participationStatus}
        </p>
        {typeof row.submissionTitle === 'string' && row.submissionTitle !== '' ? (
          <p className="truncate text-xs text-ink-muted">{row.submissionTitle}</p>
        ) : null}
        {approved ? (
          <p className="text-xs text-ink-muted">
            <span className="font-medium text-ink">{row.verificationCode}</span>
            {typeof row.experienceRegistryId === 'string' &&
            row.experienceRegistryId !== '' ? (
              <span> · {expRegistryOf(row.experienceRegistryId)}</span>
            ) : null}
            {typeof row.verifiedAt === 'string' && row.verifiedAt !== '' ? (
              <span>
                {' '}
                · {t('opportunities.verifiedOn', { date: formatDate(row.verifiedAt, locale) })}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function OpportunityDetail({
  row,
  categoryName,
  skillNameOf,
  onChanged,
  onClose,
}: {
  row: AdminOpportunityRow;
  categoryName: string;
  skillNameOf: (skillId: string) => string | null;
  onChanged: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('adminManage');
  const locale = useLocale();
  const id = rowId(row);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [closeFeedback, setCloseFeedback] = useState<string | null>(null);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendNotes, setSuspendNotes] = useState('');
  const [suspendFeedback, setSuspendFeedback] = useState<string | null>(null);

  const verificationQuery = useAdminOpportunityVerificationStatusQuery(
    id === '' ? undefined : id,
  );
  const historiesQuery = useAdminStatusHistoriesQuery(
    historyOpen ? 'opportunity' : undefined,
    historyOpen ? id : undefined,
  );
  const statusMutation = useAdminOpportunityStatusMutation();

  const currentStatus = typeof row.status === 'string' ? row.status : '';
  // The live status machine only allows published|in_progress → closed|cancelled.
  const canForceClose =
    currentStatus === 'published' || currentStatus === 'in_progress';
  const positions = (Array.isArray(row.positions) ? row.positions : []).map(
    (position, index) => positionOf(position, index),
  );
  const capacity =
    typeof row.capacity === 'number'
      ? row.capacity
      : positions.reduce((sum, position) => sum + position.requiredCount, 0);
  const filled =
    typeof row.filled === 'number'
      ? row.filled
      : positions.reduce((sum, position) => sum + position.filledCount, 0);
  const assigned = Array.isArray(row.assignedNames)
    ? row.assignedNames.filter((name) => name !== '')
    : [];
  const applicationCount =
    typeof row.applicationCount === 'number' ? row.applicationCount : 0;
  const approvedCount = (verificationQuery.data ?? []).filter(
    (entry) => entry.submissionStatus === 'approved',
  ).length;
  const locationRec = asRecord(row.location);
  const locationText =
    typeof row.locationName === 'string' && row.locationName !== ''
      ? row.locationName
      : [
          typeof locationRec?.wilayaId === 'string' ? locationRec.wilayaId : '',
          typeof locationRec?.municipalityId === 'string'
            ? locationRec.municipalityId
            : '',
        ]
          .filter((part) => part !== '')
          .join(' / ');
  const startText = formatDate(
    typeof row.startDate === 'string' ? row.startDate : undefined,
    locale,
  );
  const endText = formatDate(
    typeof row.endDate === 'string' ? row.endDate : undefined,
    locale,
  );
  const hasRange = startText !== '—' && endText !== '—';
  const durationDays = (() => {
    if (typeof row.startDate !== 'string' || typeof row.endDate !== 'string')
      return null;
    const start = new Date(row.startDate).getTime();
    const end = new Date(row.endDate).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
    return Math.round((end - start) / 86_400_000) + 1;
  })();

  const confirmStatus = (
    target: 'closed' | 'cancelled',
    reason: string,
    notes: string,
    onDone: (ok: boolean) => void,
  ) => {
    if (!isAdminOppCloseStatus(target)) return;
    statusMutation.mutate(
      { opportunityId: id, change: { status: target, reason, notes } },
      {
        onSuccess: () => {
          onDone(true);
          onChanged();
        },
        onError: () => onDone(false),
      },
    );
  };

  const confirmClose = () => {
    setCloseFeedback(null);
    confirmStatus('closed', closeReason, closeNotes, (ok) => {
      if (ok) {
        setCloseOpen(false);
        setCloseReason('');
        setCloseNotes('');
        setCloseFeedback(t('shared.actionSuccess'));
      } else {
        setCloseFeedback(t('shared.actionError'));
      }
    });
  };

  const confirmSuspend = () => {
    if (suspendReason.trim() === '') {
      setSuspendFeedback(t('opportunities.suspendReasonRequired'));
      return;
    }
    setSuspendFeedback(null);
    confirmStatus('cancelled', suspendReason, suspendNotes, (ok) => {
      if (ok) {
        setSuspendOpen(false);
        setSuspendReason('');
        setSuspendNotes('');
        setSuspendFeedback(t('shared.actionSuccess'));
      } else {
        setSuspendFeedback(t('shared.actionError'));
      }
    });
  };

  return (
    <div data-testid="admin-opportunity-detail" className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-2 border-b border-border-muted pb-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
            <Hash size={14} aria-hidden="true" className="shrink-0" />
            <span className="truncate">
              {typeof row.registryId === 'string' && row.registryId !== ''
                ? row.registryId
                : '—'}
            </span>
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-ink">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${statusDot(currentStatus)}`}
            />
            {currentStatus !== '' ? currentStatus : '—'}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t('opportunities.closeDetail')}
          title={t('opportunities.closeDetail')}
          onClick={onClose}
        >
          <X size={16} aria-hidden="true" />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold leading-snug text-ink">
          {displayTitle(row)}
        </h2>
        <p className="flex items-center gap-1.5 text-sm text-ink">
          <Building2 size={16} aria-hidden="true" className="shrink-0 text-ink-muted" />
          <span className="min-w-0 truncate font-medium">{orgNameOf(row)}</span>
        </p>
        {locationText !== '' ? (
          <p className="flex items-center gap-1.5 text-sm text-ink-muted">
            <MapPin size={16} aria-hidden="true" className="shrink-0" />
            <span className="min-w-0 truncate">{locationText}</span>
          </p>
        ) : null}
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <CalendarDays size={16} aria-hidden="true" className="shrink-0" />
          <span>
            {hasRange ? `${startText} – ${endText}` : '—'}
            {durationDays !== null
              ? ` (${t('opportunities.durationDays', { count: durationDays })})`
              : null}
          </span>
        </p>
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Tag size={16} aria-hidden="true" className="shrink-0" />
          <span>{categoryName}</span>
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-border-muted pt-4">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
          <ListChecks size={14} aria-hidden="true" className="shrink-0" />
          {t('opportunities.positionsTitle')} ·{' '}
          {t('opportunities.positionsFilled', { filled, capacity })}
        </p>
        {positions.length === 0 ? (
          <p className="text-sm text-ink-muted">—</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-muted">
            {positions.map((position) => {
              const open = Math.max(0, position.requiredCount - position.filledCount);
              const skillNames = position.requiredSkills.map((skillId) =>
                skillNameOf(skillId),
              );
              const knownSkills = skillNames.filter(
                (name): name is string => name !== null,
              );
              return (
                <li key={position.key} className="flex flex-col gap-1 py-3">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    <Briefcase
                      size={14}
                      aria-hidden="true"
                      className="shrink-0 text-ink-muted"
                    />
                    <span className="min-w-0 flex-1 truncate">{position.title}</span>
                    <span className="shrink-0 text-xs font-normal text-ink-muted">
                      {t('opportunities.positionSeats', {
                        filled: position.filledCount,
                        required: position.requiredCount,
                      })}
                    </span>
                  </p>
                  {open > 0 ? (
                    <p className="text-xs text-ink-muted">
                      {t('opportunities.positionOpenSeats', { count: open })}
                    </p>
                  ) : null}
                  <p className="text-xs text-ink-muted">
                    {t('opportunities.positionSkills')}:{' '}
                    {knownSkills.length > 0
                      ? knownSkills.join(', ')
                      : position.requiredSkills.length > 0
                        ? `— (${position.requiredSkills.length})`
                        : '—'}
                  </p>
                  {position.deliverables.length > 0 ? (
                    <p className="text-xs text-ink">
                      {t('opportunities.positionDeliverables')}:{' '}
                      {position.deliverables.join(' · ')}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {assigned.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-border-muted pt-4">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
            <Users size={14} aria-hidden="true" className="shrink-0" />
            {t('opportunities.assignedTitle')}
          </p>
          <ul className="flex flex-col gap-2">
            {assigned.map((name) => (
              <li key={name} className="flex items-center gap-2 text-sm text-ink">
                <img
                  src="/user.jpg"
                  alt={name}
                  width={24}
                  height={24}
                  loading="lazy"
                  onError={(event) => {
                    if (!event.currentTarget.src.endsWith('/user.jpg')) {
                      event.currentTarget.src = '/user.jpg';
                    }
                  }}
                  className="shrink-0 rounded-full object-cover"
                  style={{ width: 24, height: 24 }}
                />
                <span className="min-w-0 truncate">{name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-border-muted pt-4">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
          <Inbox size={14} aria-hidden="true" className="shrink-0" />
          {t('opportunities.applicationsTitle')}
        </p>
        <p className="text-sm text-ink">
          {t('opportunities.applicationsReceived', { count: applicationCount })}
        </p>
      </div>

      <div className="flex flex-col gap-1 border-t border-border-muted pt-4">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
          <BadgeCheck size={14} aria-hidden="true" className="shrink-0" />
          {t('opportunities.verificationTitle')}
          {verificationQuery.data
            ? ` · ${t('opportunities.verificationApproved', { count: approvedCount })}`
            : null}
        </p>
        {verificationQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {verificationQuery.isError ? (
          <SectionError
            testId="admin-opportunity-verification-error"
            message={t('shared.loadError')}
          />
        ) : null}
        {verificationQuery.data && verificationQuery.data.length === 0 ? (
          <p className="text-sm text-ink-muted">
            {t('opportunities.verificationEmpty')}
          </p>
        ) : null}
        <div className="flex flex-col divide-y divide-border-muted">
          {(verificationQuery.data ?? []).map((entry) => (
            <VerificationRow
              key={entry.participantId}
              row={entry}
              locale={locale}
              t={t}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border-muted pt-4">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
          <Lock size={14} aria-hidden="true" className="shrink-0" />
          {t('opportunities.actionsTitle')}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="admin-opportunity-history-toggle"
          onClick={() => setHistoryOpen((open) => !open)}
        >
          <History size={14} aria-hidden="true" />
          {t('opportunities.auditCta')}
        </Button>
        {historiesQuery.isPending && historyOpen ? (
          <Loader label={t('shared.loading')} />
        ) : null}
        {historiesQuery.isError && historyOpen ? (
          <SectionError
            testId="admin-opportunity-history-error"
            message={t('shared.loadError')}
          />
        ) : null}
        {historyOpen && historiesQuery.data && historiesQuery.data.length === 0 ? (
          <p className="text-sm text-ink-muted">{t('shared.historyEmpty')}</p>
        ) : null}
        {historyOpen ? (
          <ul className="flex flex-col gap-2">
            {(historiesQuery.data ?? []).map((entry, index) => (
              <li
                key={`${entry.from ?? ''}-${entry.to ?? ''}-${index}`}
                data-testid="admin-opportunity-history-row"
                className="rounded-md border border-border p-3 text-sm text-ink-muted"
              >
                {entry.from} → {entry.to}
                {typeof entry.reason === 'string' && entry.reason !== ''
                  ? ` · ${entry.reason}`
                  : null}
                {typeof entry.notes === 'string' && entry.notes !== ''
                  ? ` · ${entry.notes}`
                  : null}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid grid-cols-1 gap-2">
          {canForceClose ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="admin-opportunity-force-close-open"
              onClick={() => setCloseOpen(true)}
            >
              <Lock size={14} aria-hidden="true" />
              {t('opportunities.closeCta')}
            </Button>
          ) : null}
          {canForceClose ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="admin-opportunity-suspend-open"
              onClick={() => setSuspendOpen(true)}
              className="text-status-error"
            >
              <Ban size={14} aria-hidden="true" />
              {t('opportunities.suspendCta')}
            </Button>
          ) : null}
        </div>
        {closeFeedback ? (
          <p data-testid="admin-opportunity-feedback" className="text-sm text-ink-muted">
            {closeFeedback}
          </p>
        ) : null}
        {suspendFeedback ? (
          <p
            data-testid="admin-opportunity-suspend-feedback"
            className="text-sm text-ink-muted"
          >
            {suspendFeedback}
          </p>
        ) : null}
      </div>

      {closeOpen ? (
        <AdminDialog
          testId="admin-opportunity-force-close-dialog"
          title={t('opportunities.closeTitle')}
          onClose={() => setCloseOpen(false)}
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-muted">{t('opportunities.closeBody')}</p>
            <Input
              id="admin-opportunity-reason"
              label={t('shared.reasonLabel')}
              placeholder={t('shared.reasonPlaceholder')}
              value={closeReason}
              maxLength={500}
              onChange={(event) => setCloseReason(event.target.value)}
            />
            <Input
              id="admin-opportunity-notes"
              label={t('shared.notesLabel')}
              placeholder={t('shared.notesPlaceholder')}
              value={closeNotes}
              maxLength={2000}
              onChange={(event) => setCloseNotes(event.target.value)}
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              data-testid="admin-opportunity-force-close-confirm"
              disabled={statusMutation.isPending}
              onClick={confirmClose}
            >
              {t('shared.confirm')}
            </Button>
          </div>
        </AdminDialog>
      ) : null}

      {suspendOpen ? (
        <AdminDialog
          testId="admin-opportunity-suspend-dialog"
          title={t('opportunities.suspendTitle')}
          onClose={() => setSuspendOpen(false)}
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-muted">{t('opportunities.suspendBody')}</p>
            <Input
              id="admin-opportunity-suspend-reason"
              label={t('shared.reasonLabel')}
              placeholder={t('shared.reasonPlaceholder')}
              value={suspendReason}
              maxLength={500}
              onChange={(event) => setSuspendReason(event.target.value)}
            />
            <Input
              id="admin-opportunity-suspend-notes"
              label={t('shared.notesLabel')}
              placeholder={t('shared.notesPlaceholder')}
              value={suspendNotes}
              maxLength={2000}
              onChange={(event) => setSuspendNotes(event.target.value)}
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              data-testid="admin-opportunity-suspend-confirm"
              disabled={statusMutation.isPending || suspendReason.trim() === ''}
              onClick={confirmSuspend}
            >
              {t('shared.confirm')}
            </Button>
          </div>
        </AdminDialog>
      ) : null}
    </div>
  );
}

// F15-owned Manage Opportunities route: enriched rows (positions/capacity,
// app counts, location labels, assigned names), totals banners, CSV parity,
// force-close via status-PATCH (§A#16 — never a close POST), histories.
// Detail is a side drawer (master-detail, no separate route), matching the
// mockup's right inspection column and the Volunteers screen pattern.
export function AdminOpportunitiesPage() {
  const t = useTranslations('adminManage');
  const locale = useLocale();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [sort, setSort] = useState('newest');
  const [limit, setLimit] = useState(25);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [csvError, setCsvError] = useState(false);

  const listQuery = useAdminOpportunitiesQuery({
    q: q === '' ? undefined : q,
    status: status === '' ? undefined : status,
    organizationId: organizationId === '' ? undefined : organizationId,
    sort: sort === '' ? undefined : sort,
    limit,
    cursor,
  });
  const csvMutation = useAdminOpportunitiesCsvMutation();
  const overviewQuery = useAdminAnalyticsOverviewQuery();
  const flaggedQuery = useAdminReportsQuery(
    { status: 'open', targetType: 'opportunity', limit: 1 },
    { enabled: true },
  );
  const categoriesQuery = useFeedSkillCategoriesQuery();
  const skillsQuery = useFeedSkillsQuery();

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
    setQ('');
    setStatus('');
    setOrganizationId('');
    setSort('newest');
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
        q: q === '' ? undefined : q,
        status: status === '' ? undefined : status,
        organizationId: organizationId === '' ? undefined : organizationId,
        sort: sort === '' ? undefined : sort,
      },
      { onError: () => setCsvError(true) },
    );
  };

  const onRefresh = () => {
    void listQuery.refetch();
    void overviewQuery.refetch();
    void flaggedQuery.refetch();
  };

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const selected = items.find((row) => rowId(row) === selectedId);

  const opportunityCounts = overviewQuery.data?.perStatus.opportunities ?? {};
  const applicationCounts = overviewQuery.data?.perStatus.applications ?? {};
  const submissionCounts = overviewQuery.data?.perStatus.submissions ?? {};
  const num = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;
  const published = num(opportunityCounts.published);
  const active = num(opportunityCounts.in_progress);
  const completed = num(opportunityCounts.completed);
  const pendingApps =
    (num(applicationCounts.pending) ?? 0) + (num(applicationCounts.under_review) ?? 0);
  const appsKnown =
    num(applicationCounts.pending) !== null ||
    num(applicationCounts.under_review) !== null;
  const approved = num(submissionCounts.approved);
  const allOpportunities = Object.values(opportunityCounts).reduce(
    (sum, value) => sum + (typeof value === 'number' ? value : 0),
    0,
  );
  const statsReady = overviewQuery.data !== undefined;
  const flagged = flaggedQuery.data?.total;
  const statValue = (value: number | null | undefined): string => {
    if (typeof value !== 'number') return '—';
    return String(value);
  };

  const categoryNameOf = (categoryId: string | null | undefined): string => {
    if (typeof categoryId !== 'string' || categoryId === '') return '—';
    const match = (categoriesQuery.data ?? []).find(
      (category) => category.id === categoryId || category._id === categoryId,
    );
    if (!match) return '—';
    if (locale === 'ar')
      return match.nameAr ?? match.nameFr ?? match.name ?? '—';
    return match.nameFr ?? match.nameAr ?? match.name ?? '—';
  };

  const skillMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const skill of skillsQuery.data ?? []) {
      const name =
        locale === 'ar'
          ? (skill.nameAr ?? skill.nameFr ?? skill.name)
          : (skill.nameFr ?? skill.nameAr ?? skill.name);
      if (typeof name !== 'string' || name === '') continue;
      if (typeof skill.id === 'string' && skill.id !== '') map.set(skill.id, name);
      if (typeof skill._id === 'string' && skill._id !== '')
        map.set(skill._id, name);
    }
    return map;
  }, [skillsQuery.data, locale]);

  const skillNameOf = (skillId: string): string | null =>
    skillMap.get(skillId) ?? null;

  const statusOptions = [
    { value: '', label: t('opportunities.statusAll') },
    { value: 'draft', label: t('opportunities.statusDraft') },
    { value: 'published', label: t('opportunities.statusPublished') },
    { value: 'in_progress', label: t('opportunities.statusInProgress') },
    { value: 'completed', label: t('opportunities.statusCompleted') },
    { value: 'closed', label: t('opportunities.statusClosed') },
    { value: 'cancelled', label: t('opportunities.statusCancelled') },
  ];

  return (
    <Container testId="admin-opportunities" className="flex min-w-0 flex-col gap-6 py-6">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1 text-sm text-ink-muted"
      >
        <span>{t('opportunities.crumbsAdministration')}</span>
        <ChevronRight size={14} aria-hidden="true" className="shrink-0" />
        <span>{t('opportunities.crumbsManagement')}</span>
        <ChevronRight size={14} aria-hidden="true" className="shrink-0" />
        <span aria-current="page" className="font-medium text-ink">
          {t('opportunities.crumbsCurrent')}
        </span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">{t('opportunities.title')}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t('opportunities.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              id="admin-opportunities-q"
              type="search"
              value={q}
              placeholder={t('opportunities.headerSearchPlaceholder')}
              aria-label={t('shared.searchLabel')}
              onChange={(event) => {
                setQ(event.target.value);
                resetPage();
              }}
              className="h-10 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="admin-opportunities-csv"
            disabled={csvMutation.isPending}
            onClick={onExportCsv}
            className="h-10"
          >
            <Download size={14} aria-hidden="true" />
            {csvMutation.isPending ? t('shared.downloading') : t('opportunities.exportRegistry')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-label={t('opportunities.refreshRegistry')}
            title={t('opportunities.refreshRegistry')}
            disabled={listQuery.isFetching}
            onClick={onRefresh}
            className="h-10 w-10"
          >
            <RotateCw size={14} aria-hidden="true" />
          </Button>
        </div>
      </div>
      {csvError ? (
        <p data-testid="admin-opportunities-csv-error" role="alert" className="mt-2 text-sm text-status-error">
          {t('shared.csvError')}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3 xl:grid-cols-6">
        <div className="bg-surface">
          <StatCard
            testId="admin-opportunities-stat-published"
            Icon={Megaphone}
            label={t('opportunities.statsPublished')}
            value={statsReady ? statValue(published) : '—'}
            sub={t('opportunities.statsOfTotal', { total: allOpportunities })}
          />
        </div>
        <div className="bg-surface">
          <StatCard
            testId="admin-opportunities-stat-active"
            Icon={Activity}
            label={t('opportunities.statsActive')}
            value={statsReady ? statValue(active) : '—'}
            sub={t('opportunities.statsInProgress')}
          />
        </div>
        <div className="bg-surface">
          <StatCard
            testId="admin-opportunities-stat-pending"
            Icon={Inbox}
            label={t('opportunities.statsPendingApps')}
            value={appsKnown ? String(pendingApps) : '—'}
            sub={t('opportunities.statsAwaitingReview')}
          />
        </div>
        <div className="bg-surface">
          <StatCard
            testId="admin-opportunities-stat-approved"
            Icon={BadgeCheck}
            label={t('opportunities.statsApproved')}
            value={statsReady ? statValue(approved) : '—'}
            sub={t('opportunities.statsVerifiedWork')}
          />
        </div>
        <div className="bg-surface">
          <StatCard
            testId="admin-opportunities-stat-completed"
            Icon={CheckCircle2}
            label={t('opportunities.statsCompleted')}
            value={statsReady ? statValue(completed) : '—'}
            sub={t('opportunities.statsAllTime')}
          />
        </div>
        <div className="bg-surface">
          <StatCard
            testId="admin-opportunities-stat-flagged"
            Icon={Flag}
            label={t('opportunities.statsFlagged')}
            value={statValue(flagged)}
            sub={t('opportunities.statsOpenReports')}
          />
        </div>
      </div>

      <Card title={t('opportunities.filtersTitle')}>
        <div
          data-testid="admin-opportunities-filters"
          className="flex flex-wrap items-end gap-2"
        >
          <FilterSelect
            id="admin-opportunities-status"
            label={t('opportunities.statusLabel')}
            value={status}
            onChange={(value) => {
              setStatus(value);
              resetPage();
            }}
            Icon={ArrowUpDown}
            options={statusOptions}
          />
          <div className="relative min-w-[10rem] flex-1">
            <Building2
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              id="admin-opportunities-organization"
              value={organizationId}
              placeholder={t('opportunities.organizationPlaceholder')}
              aria-label={t('opportunities.organizationLabel')}
              title={t('opportunities.organizationLabel')}
              onChange={(event) => {
                setOrganizationId(event.target.value);
                resetPage();
              }}
              className="h-10 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
            />
          </div>
          <FilterSelect
            id="admin-opportunities-sort"
            label={t('opportunities.sortLabel')}
            value={sort}
            onChange={(value) => {
              setSort(value);
              resetPage();
            }}
            Icon={ArrowUpDown}
            options={[
              { value: 'newest', label: t('opportunities.sortNewest') },
              { value: 'oldest', label: t('opportunities.sortOldest') },
              { value: 'title', label: t('opportunities.sortTitle') },
            ]}
          />
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-10">
            {t('shared.clearFilters')}
          </Button>
        </div>
      </Card>

      {listQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
      {listQuery.isError ? (
        <SectionError testId="admin-opportunities-error" message={t('shared.loadError')} />
      ) : null}

      <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <Card className="min-w-0 p-0 xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-start">
              <thead>
                <tr className="border-b border-border text-start text-xs uppercase tracking-wider text-ink-muted">
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t('opportunities.colOpportunity')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t('opportunities.colCategory')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t('opportunities.colCapacity')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t('opportunities.colApps')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t('opportunities.colSchedule')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t('opportunities.colStatus')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-medium">
                    <span className="sr-only">{t('shared.details')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted text-sm">
                {items.map((row) => {
                  const selectedRow = rowId(row) === selectedId;
                  const itemStatus = typeof row.status === 'string' ? row.status : '';
                  const filledCount =
                    typeof row.filled === 'number' ? row.filled : null;
                  const capacityCount =
                    typeof row.capacity === 'number' ? row.capacity : null;
                  const apps =
                    typeof row.applicationCount === 'number'
                      ? row.applicationCount
                      : null;
                  return (
                    <tr
                      key={rowId(row)}
                      onClick={() => setSelectedId(rowId(row))}
                      aria-selected={selectedRow}
                      className={`cursor-pointer transition-colors hover:bg-surface-muted ${
                        selectedRow ? 'bg-primary-tint/40' : ''
                      }`}
                    >
                      <td className="max-w-[14rem] px-4 py-3">
                        <p className="truncate font-medium text-ink">
                          {displayTitle(row)}
                        </p>
                        <p className="truncate text-xs text-ink-muted">
                          {orgNameOf(row)}
                          {typeof row.locationName === 'string' &&
                          row.locationName !== ''
                            ? ` · ${row.locationName}`
                            : null}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                        {categoryNameOf(
                          typeof row.categoryId === 'string' ? row.categoryId : undefined,
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink">
                        {filledCount !== null && capacityCount !== null
                          ? `${filledCount} / ${capacityCount}`
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                        {apps !== null ? apps : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                        {(() => {
                          const start = formatDate(
                            typeof row.startDate === 'string' ? row.startDate : undefined,
                            locale,
                          );
                          const end = formatDate(
                            typeof row.endDate === 'string' ? row.endDate : undefined,
                            locale,
                          );
                          if (start === '—' || end === '—') return '—';
                          return `${start} – ${end}`;
                        })()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-ink">
                          <span
                            aria-hidden="true"
                            className={`h-1.5 w-1.5 rounded-full ${statusDot(itemStatus)}`}
                          />
                          {itemStatus !== '' ? itemStatus : '—'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          data-testid={`admin-opportunity-open-${rowId(row)}`}
                          aria-label={t('opportunities.inspect')}
                          title={t('opportunities.inspect')}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(rowId(row));
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
              <Empty title={t('opportunities.empty')} />
            </div>
          ) : null}
          {listQuery.data ? (
            <div className="flex flex-col gap-3 border-t border-border-muted px-4 py-3 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
              <p data-testid="admin-opportunities-count">
                {t('opportunities.showing', { shown: items.length, total })}
                {typeof listQuery.data.page === 'number' &&
                typeof listQuery.data.pages === 'number' &&
                listQuery.data.pages > 0
                  ? ` · ${t('opportunities.pageOf', {
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
                    data-testid="admin-opportunities-back"
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
                    data-testid="admin-opportunities-next"
                    onClick={goNext}
                  >
                    {t('shared.nextPage')}
                  </Button>
                ) : null}
                <label
                  htmlFor="admin-opportunities-limit"
                  className="flex items-center gap-1.5 border-s border-border ps-3"
                >
                  {t('opportunities.showLabel')}
                  <select
                    id="admin-opportunities-limit"
                    value={String(limit)}
                    onChange={(event) => {
                      setLimit(Number(event.target.value) || 25);
                      resetPage();
                    }}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink focus:border-primary focus:outline-none"
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
            <aside
              aria-label={t('opportunities.detailTitle')}
              className="fixed inset-y-0 end-0 z-40 w-[min(92vw,26rem)] overflow-y-auto border-s border-border bg-surface p-4 shadow-modal xl:sticky xl:top-20 xl:z-auto xl:col-span-1 xl:w-auto xl:self-start xl:overflow-visible xl:rounded-xl xl:border xl:p-4 xl:shadow-sm"
            >
              <OpportunityDetail
                row={selected}
                categoryName={categoryNameOf(
                  typeof selected.categoryId === 'string'
                    ? selected.categoryId
                    : undefined,
                )}
                skillNameOf={skillNameOf}
                onChanged={() => void listQuery.refetch()}
                onClose={() => setSelectedId(undefined)}
              />
            </aside>
          </>
        ) : null}
      </div>
    </Container>
  );
}
