'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Activity,
  ArrowRight,
  Award,
  BadgeCheck,
  Building2,
  CalendarDays,
  CircleCheck,
  FileCheck2,
  Flag,
  HeartHandshake,
  Hourglass,
  Megaphone,
  RefreshCw,
  ScrollText,
  Settings,
  Star,
  UserPlus,
  UserX,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from '@/i18n/navigation';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { ForbiddenScreen } from '@/components/system';
import { useSessionQuery, getLoginHref } from '@/hooks/useSession';
import { queryKeys } from '@/lib/query/keys';
import {
  auditRows,
  clampSeriesDays,
  formatDeltaPercent,
  seriesMax,
  seriesTotals,
  turnaroundValue,
  uptimeParts,
  type AnalyticsSeriesPoint,
  type SeriesField,
} from '@/lib/api/adminAnalytics';
import {
  reportIdOf,
  targetLabelOf,
  type AdminReport,
} from '@/lib/api/adminModeration';
import type { AdminVerificationRow } from '@/lib/api/adminLists';
import {
  useAdminAnalyticsGate,
  useAdminAnalyticsOverviewQuery,
  useAdminAnalyticsQueueQuery,
  useAdminAnalyticsSeriesQuery,
  useAdminAuditLogsQuery,
  useAdminHealthQuery,
  useAdminOpenReportsQuery,
  useAdminPendingVerificationsQuery,
  useAdminStatsOverviewQuery,
  useAdminSystemStatusQuery,
} from '@/hooks/useAdminAnalytics';

// Platform Administration dashboard rebuild from
// `design/Basmatak Tatatoua - Admin Dashboard/` (code.html + screen.png):
// header with time-range selector + refresh, six-stat row, activity chart,
// attention queue, recent activity feed, health card, shortcuts row. The
// workspace chrome (admin sidebar + top navbar + mobile tab bar) lives in
// Shell/Sidebar/BottomNav/Navbar — this file owns the dashboard content only.
//
// Standing rules applied:
// - No badge or pill labels anywhere on this screen: queue categories render
//   as a leading lucide icon plus plain text, never a colored pill.
// - Illustrative leading icons on every stat card, queue row, activity entry,
//   and shortcut button, even where code.html shows bare text or numbers.
// - Every figure comes from a response field. Queue counts come from
//   GET /admin/analytics/queue, stat totals from GET /admin/stats/overview,
//   per-status published counts and deltas from GET /admin/analytics/overview,
//   chart points from GET /admin/analytics/series, queue rows from the real
//   pending-verifications and open-reports list endpoints, activity entries
//   from GET /admin/audit-logs, health rows from GET /health and
//   GET /system/status. No invented peaks, captions, or outreach stories.
// - Removed, never rephrased: the compliance-law caption under Verified
//   Organizations, the whole compliance-quota health row, the national-registry
//   sync code, fabricated volunteer account codes (real registryId or username
//   instead), and every fabrication verb from the mock feed (backend audit
//   actions render verbatim, which are neutral).
// - The turnaround row renders only when the backend measured enough
//   decisions (medianDecisionHours non-null); otherwise the row is omitted,
//   never zero-filled.
// - "View full audit logs" and the audit-logs shortcut point at
//   /admin/audit-logs, which has no frontend route yet (pending build); every
//   other shortcut and Review link targets an existing manage screen.

const SERIES_WINDOW_OPTIONS = [7, 30, 90] as const;

const SERIES_FIELD_ORDER: SeriesField[] = ['signups', 'applications', 'verifications'];

const SERIES_LABEL_KEYS: Record<SeriesField, string> = {
  signups: 'series.signups',
  applications: 'series.applications',
  verifications: 'series.verifications',
};

const CHART_COLORS: Record<SeriesField, string> = {
  signups: '#6d28d9',
  applications: '#7b7486',
  verifications: '#8f4200',
};

function SectionError({ testId }: { testId: string }) {
  const t = useTranslations('adminOverview');
  return (
    <p data-testid={testId} role="alert" className="text-sm text-status-error">
      {t('shared.loadError')}
    </p>
  );
}

function formatShortDate(value: string | null | undefined, locale: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(parsed);
}

function formatShortDateTime(value: string | null | undefined, locale: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function verificationOrgName(row: AdminVerificationRow): string {
  const org = row.organization;
  if (!org) return '';
  return org.nameFr ?? org.nameAr ?? org.name ?? '';
}

function verificationRowId(row: AdminVerificationRow): string {
  const id = row.rowId ?? row.id ?? row._id;
  return typeof id === 'string' ? id : '';
}

function reportTargetType(row: AdminReport): string {
  return row.targetType ?? row.target?.type ?? row.target?.targetType ?? '';
}

function ReportTypeIcon({ targetType }: { targetType: string }) {
  const Icon =
    targetType === 'opportunity'
      ? Flag
      : targetType === 'user'
        ? UserX
        : targetType === 'organization'
          ? Building2
          : targetType === 'review'
            ? Star
            : targetType === 'submission'
              ? FileCheck2
              : Flag;
  return <Icon size={20} aria-hidden="true" className="shrink-0" />;
}

function reportLabelKey(targetType: string): string {
  if (targetType === 'opportunity') return 'queue.itemReportOpportunity';
  if (targetType === 'user') return 'queue.itemReportUser';
  if (targetType === 'organization') return 'queue.itemReportOrganization';
  if (targetType === 'review') return 'queue.itemReportReview';
  if (targetType === 'submission') return 'queue.itemReportSubmission';
  return 'queue.itemReportOpportunity';
}

function priorityLabelKey(priority: string | null | undefined): string | null {
  if (priority === 'high') return 'queue.priorityHigh';
  if (priority === 'normal') return 'queue.priorityNormal';
  if (priority === 'low') return 'queue.priorityLow';
  return null;
}

function auditIconFor(entry: { action: string | null; method: string | null; path: string | null }): LucideIcon {
  const haystack = `${entry.action ?? ''} ${entry.method ?? ''} ${entry.path ?? ''}`.toLowerCase();
  if (haystack.includes('signup') || haystack.includes('register')) return UserPlus;
  if (haystack.includes('verif') || haystack.includes('approv')) return BadgeCheck;
  if (haystack.includes('report') && (haystack.includes('resolv') || haystack.includes('dismiss')))
    return CircleCheck;
  if (haystack.includes('report')) return Flag;
  if (haystack.includes('suspend')) return UserX;
  if (haystack.includes('publish') || haystack.includes('opportunit')) return Megaphone;
  if (haystack.includes('submi')) return FileCheck2;
  if (haystack.includes('experience')) return Award;
  if (haystack.includes('maintenance') || haystack.includes('setting')) return Settings;
  return Activity;
}

function DashboardHeader({
  days,
  onDays,
  refreshing,
  onRefresh,
}: {
  days: number;
  onDays: (days: number) => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const t = useTranslations('adminOverview');
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t('header.title')}</h1>
        <p className="mt-0.5 text-sm text-ink-muted">{t('header.subtitle')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label={t('header.rangeLabel')}
          data-testid="dashboard-range-group"
          className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5"
        >
          <CalendarDays size={16} aria-hidden="true" className="ms-1.5 shrink-0 text-ink-muted" />
          {SERIES_WINDOW_OPTIONS.map((option) => {
            const active = days === option;
            return (
              <button
                key={option}
                type="button"
                data-testid={`dashboard-range-${option}`}
                aria-pressed={active}
                onClick={() => onDays(option)}
                className={`rounded-md px-2.5 py-1.5 text-label-sm transition-colors ${
                  active
                    ? 'bg-surface-muted font-semibold text-primary'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {t('header.rangeDays', { count: option })}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          data-testid="dashboard-refresh"
          disabled={refreshing}
          onClick={onRefresh}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-label-md text-ink transition-colors hover:bg-surface-muted disabled:opacity-50"
        >
          <RefreshCw
            size={18}
            aria-hidden="true"
            className={`shrink-0 text-ink-muted ${refreshing ? 'animate-spin' : ''}`}
          />
          <span>{refreshing ? t('header.refreshing') : t('header.refresh')}</span>
        </button>
      </div>
    </header>
  );
}

interface StatCard {
  key: string;
  testId: string;
  Icon: LucideIcon;
  label: string;
  value: string;
  caption: string;
  accent: boolean;
}

function StatsRow() {
  const t = useTranslations('adminOverview');
  const locale = useLocale();
  const stats = useAdminStatsOverviewQuery();
  const analytics = useAdminAnalyticsOverviewQuery();
  const queue = useAdminAnalyticsQueueQuery();
  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  if (stats.isPending || analytics.isPending || queue.isPending)
    return <Loader label={t('shared.loading')} />;
  if (stats.isError) return <SectionError testId="stats-error" />;
  if (analytics.isError) return <SectionError testId="overview-error" />;
  if (queue.isError) return <SectionError testId="queue-error" />;

  const published =
    analytics.data.perStatus.opportunities['published'] ??
    analytics.data.totals.opportunities.current;
  const publishedDelta = formatDeltaPercent(analytics.data.totals.opportunities.deltaPercent);

  const cards: StatCard[] = [
    {
      key: 'volunteers',
      testId: 'stat-total-volunteers',
      Icon: Users,
      label: t('stats.totalVolunteers'),
      value: numberFormat.format(stats.data.counts.volunteers),
      caption: t('stats.volunteersCaption'),
      accent: false,
    },
    {
      key: 'verified-organizations',
      testId: 'stat-verified-organizations',
      Icon: BadgeCheck,
      label: t('stats.verifiedOrganizations'),
      value: numberFormat.format(stats.data.counts.verifiedOrganizations),
      caption: t('stats.verifiedOrgsCaption'),
      accent: false,
    },
    {
      key: 'published-opportunities',
      testId: 'stat-published-opportunities',
      Icon: Megaphone,
      label: t('stats.publishedOpportunities'),
      value: numberFormat.format(published),
      caption:
        publishedDelta === null
          ? t('stats.publishedCaptionNeutral')
          : t('stats.publishedCaptionDelta', { value: publishedDelta }),
      accent: false,
    },
    {
      key: 'active-participants',
      testId: 'stat-active-participants',
      Icon: Activity,
      label: t('stats.activeParticipants'),
      value: numberFormat.format(analytics.data.activeParticipants),
      caption: t('stats.activeCaption'),
      accent: false,
    },
    {
      key: 'pending-verifications',
      testId: 'stat-pending-verifications',
      Icon: Hourglass,
      label: t('stats.pendingVerifications'),
      value: numberFormat.format(queue.data.pendingVerifications),
      caption: t('stats.pendingCaption'),
      accent: true,
    },
    {
      key: 'open-reports',
      testId: 'stat-open-reports',
      Icon: Flag,
      label: t('stats.openReports'),
      value: numberFormat.format(queue.data.openReports),
      caption: t('stats.reportsCaption'),
      accent: true,
    },
  ];

  return (
    <section
      aria-label={t('stats.label')}
      data-testid="stats-row"
      className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm"
    >
      <ul className="grid min-w-[760px] grid-cols-2 gap-px bg-border-muted md:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <li
            key={card.key}
            data-testid={card.testId}
            className={`flex flex-col gap-1 bg-surface p-4 ${card.accent ? 'bg-surface-muted/60' : ''}`}
          >
            <span className="flex items-center gap-1.5 text-label-sm text-ink-muted">
              <card.Icon size={16} aria-hidden="true" className="shrink-0" />
              <span>{card.label}</span>
            </span>
            <span data-testid={`${card.testId}-value`} className="text-2xl font-semibold tracking-tight text-ink">
              {card.value}
            </span>
            <span className="text-label-xs text-ink-muted">{card.caption}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function chartPath(points: AnalyticsSeriesPoint[], field: SeriesField, max: number): string {
  if (points.length === 0 || max === 0) return '';
  const left = 40;
  const right = 700;
  const top = 16;
  const bottom = 195;
  const step = points.length > 1 ? (right - left) / (points.length - 1) : 0;
  return points
    .map((point, index) => {
      const x = left + index * step;
      const y = top + (1 - point[field] / max) * (bottom - top);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function SeriesPanel({ days }: { days: number }) {
  const t = useTranslations('adminOverview');
  const locale = useLocale();
  const bounded = clampSeriesDays(days);
  const series = useAdminAnalyticsSeriesQuery(bounded);

  if (series.isPending) return <Loader label={t('shared.loading')} />;
  if (series.isError) return <SectionError testId="series-error" />;

  const points = series.data?.points ?? [];
  const max = seriesMax(points);
  const totals = seriesTotals(points);
  const numberFormat = new Intl.NumberFormat(locale);

  const signupsPeak = points.reduce<{ value: number; index: number }>(
    (best, point, index) => (point.signups > best.value ? { value: point.signups, index } : best),
    { value: 0, index: -1 },
  );
  const peakX =
    signupsPeak.index >= 0 && points.length > 1
      ? 40 + signupsPeak.index * (660 / (points.length - 1))
      : 40;
  const peakY = max > 0 ? 16 + (1 - signupsPeak.value / max) * (195 - 16) : 195;

  const gridFractions = [0.25, 0.5, 0.75, 1];
  const tickIndexes =
    points.length === 0
      ? []
      : [0, 1, 2, 3, 4]
          .map((slot) => Math.round((slot * (points.length - 1)) / 4))
          .filter((value, position, all) => all.indexOf(value) === position);
  const tickLabel = (date: string): string => {
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return date;
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(parsed);
  };

  return (
    <section
      aria-label={t('series.title')}
      data-testid="series-panel"
      className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-1 pb-3">
        <h2 className="text-title-lg text-ink">{t('series.title')}</h2>
        <p className="text-sm text-ink-muted">{t('series.subtitle')}</p>
      </div>
      {points.length === 0 || max === 0 ? (
        <Empty title={t('series.empty')} />
      ) : (
        <div data-testid="series-points">
          <svg
            role="img"
            aria-label={t('series.title')}
            viewBox="0 0 720 220"
            className="h-auto w-full overflow-visible text-ink"
          >
            <defs>
              <linearGradient id="admin-series-signups" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.signups} stopOpacity="0.12" />
                <stop offset="100%" stopColor={CHART_COLORS.signups} stopOpacity="0" />
              </linearGradient>
            </defs>
            {gridFractions.map((fraction) => {
              const y = 16 + (1 - fraction) * (195 - 16);
              return (
                <g key={fraction}>
                  <line x1="40" x2="700" y1={y} y2={y} strokeWidth="1" className="stroke-border-muted" />
                  <text x="32" y={y + 4} textAnchor="end" fontSize="11" className="fill-ink-muted">
                    {numberFormat.format(Math.round(max * fraction))}
                  </text>
                </g>
              );
            })}
            <line x1="40" x2="700" y1="195" y2="195" strokeWidth="1" className="stroke-border" />
            {SERIES_FIELD_ORDER.filter((field) => field !== 'signups').map((field) => (
              <path
                key={field}
                d={chartPath(points, field, max)}
                fill="none"
                stroke={CHART_COLORS[field]}
                strokeWidth={field === 'applications' ? 1.5 : 1.75}
                strokeDasharray={field === 'applications' ? '3 3' : undefined}
              />
            ))}
            <path
              d={`${chartPath(points, 'signups', max)} L 700 195 L 40 195 Z`}
              fill="url(#admin-series-signups)"
            />
            <path
              d={chartPath(points, 'signups', max)}
              fill="none"
              stroke={CHART_COLORS.signups}
              strokeWidth="2.5"
            />
            {signupsPeak.value > 0 ? (
              <g>
                <circle
                  cx={peakX}
                  cy={peakY}
                  r="4"
                  fill={CHART_COLORS.signups}
                  strokeWidth="2"
                  className="stroke-surface"
                />
                <line
                  x1={peakX}
                  x2={peakX}
                  y1={peakY + 4}
                  y2="195"
                  strokeWidth="1"
                  stroke={CHART_COLORS.signups}
                  strokeDasharray="2 2"
                  opacity="0.4"
                />
                <text
                  x={peakX}
                  y="10"
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill={CHART_COLORS.signups}
                >
                  {t('series.peakLabel', { value: numberFormat.format(signupsPeak.value) })}
                </text>
              </g>
            ) : null}
            {tickIndexes.map((pointIndex) => {
              const point = points[pointIndex];
              if (!point) return null;
              const x =
                points.length > 1 ? 40 + pointIndex * (660 / (points.length - 1)) : 40;
              return (
                <text key={point.date} x={x} y="214" fontSize="11" className="fill-ink-muted">
                  {tickLabel(point.date)}
                </text>
              );
            })}
          </svg>
          <ul className="sr-only">
            {points.map((point) => (
              <li key={point.date}>
                {t('series.pointLabel', {
                  date: point.date,
                  signups: point.signups,
                  applications: point.applications,
                  verifications: point.verifications,
                })}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border-muted pt-3 text-label-xs text-ink-muted">
        {SERIES_FIELD_ORDER.map((field) => (
          <span key={field} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: CHART_COLORS[field] }}
            />
            <span>{t(SERIES_LABEL_KEYS[field])}</span>
            <span data-testid={`series-total-${field}`} className="font-semibold text-ink">
              {numberFormat.format(totals[field])}
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}

function QueuePanel() {
  const t = useTranslations('adminOverview');
  const locale = useLocale();
  const queue = useAdminAnalyticsQueueQuery();
  const verifications = useAdminPendingVerificationsQuery(3);
  const reports = useAdminOpenReportsQuery(3);

  if (queue.isPending || verifications.isPending || reports.isPending)
    return <Loader label={t('shared.loading')} />;
  if (queue.isError) return <SectionError testId="queue-error" />;
  if (verifications.isError) return <SectionError testId="queue-verifications-error" />;
  if (reports.isError) return <SectionError testId="queue-reports-error" />;

  const verificationRows = (verifications.data?.items ?? []).slice(0, 3);
  const reportRows = (reports.data?.items ?? []).slice(0, 2);
  const total = queue.data.pendingVerifications + queue.data.openReports;
  const hasRows = verificationRows.length > 0 || reportRows.length > 0;

  return (
    <section
      aria-label={t('queue.title')}
      data-testid="queue-panel"
      className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-muted pb-3">
        <div>
          <h2 className="text-title-lg text-ink">{t('queue.title')}</h2>
          <p className="text-sm text-ink-muted">{t('queue.subtitle', { count: total })}</p>
        </div>
        <Link
          data-testid="queue-view-all"
          href="/admin/verifications"
          className="shrink-0 text-label-sm font-medium text-primary hover:underline"
        >
          {t('queue.viewQueue', { count: queue.data.pendingVerifications })}
        </Link>
      </div>
      {hasRows ? (
        <ul className="divide-y divide-border-muted">
          {verificationRows.map((row) => {
            const name = verificationOrgName(row);
            const submitted = formatShortDate(row.submittedAt, locale);
            const documentCount = row.documents?.length ?? 0;
            return (
              <li
                key={verificationRowId(row) === '' ? name : verificationRowId(row)}
                data-testid="queue-item-verification"
                className="flex items-center justify-between gap-3 rounded-lg px-1 py-3 transition-colors hover:bg-surface-muted/50"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-muted">
                    <Building2 size={20} aria-hidden="true" className="shrink-0" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-1.5 text-label-xs uppercase tracking-wider text-ink-muted">
                      <span>{t('queue.itemVerification')}</span>
                      <span aria-hidden="true">{'·'}</span>
                      <span>{submitted}</span>
                    </p>
                    <p className="truncate text-title-sm font-semibold text-ink">{name}</p>
                    <p className="truncate text-sm text-ink-muted">
                      {t('queue.submittedOn', { date: submitted })}
                      {documentCount > 0 ? (
                        <span>
                          <span aria-hidden="true">{' · '}</span>
                          {t('queue.documentsCount', { count: documentCount })}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <Link
                  href="/admin/verifications"
                  className="inline-flex shrink-0 items-center gap-1 ps-2 text-label-md font-medium text-primary transition-colors hover:underline"
                >
                  <span>{t('queue.review')}</span>
                  <ArrowRight size={16} aria-hidden="true" className="shrink-0 rtl:rotate-180" />
                </Link>
              </li>
            );
          })}
          {reportRows.map((row) => {
            const id = reportIdOf(row);
            const targetType = reportTargetType(row);
            const title = row.title ?? targetLabelOf(row.target ?? row.targetSummary ?? undefined);
            const detail = row.reason ?? row.description ?? '';
            const reported = formatShortDate(row.createdAt, locale);
            const priorityKey = priorityLabelKey(row.priority);
            return (
              <li
                key={id === '' ? title : id}
                data-testid="queue-item-report"
                className="flex items-center justify-between gap-3 rounded-lg px-1 py-3 transition-colors hover:bg-surface-muted/50"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-muted">
                    <ReportTypeIcon targetType={targetType} />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-1.5 text-label-xs uppercase tracking-wider text-ink-muted">
                      <span>{t(reportLabelKey(targetType))}</span>
                      <span aria-hidden="true">{'·'}</span>
                      <span>{reported}</span>
                      {priorityKey ? (
                        <span>
                          <span aria-hidden="true">{' · '}</span>
                          {t(priorityKey)}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-title-sm font-semibold text-ink">{title}</p>
                    {detail !== '' ? (
                      <p className="truncate text-sm text-ink-muted">{detail}</p>
                    ) : null}
                  </div>
                </div>
                <Link
                  href="/admin/reports"
                  className="inline-flex shrink-0 items-center gap-1 ps-2 text-label-md font-medium text-primary transition-colors hover:underline"
                >
                  <span>{t('queue.review')}</span>
                  <ArrowRight size={16} aria-hidden="true" className="shrink-0 rtl:rotate-180" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty title={t('queue.empty')} />
      )}
    </section>
  );
}

function ActivityFeed() {
  const t = useTranslations('adminOverview');
  const locale = useLocale();
  const audit = useAdminAuditLogsQuery();

  if (audit.isPending) return <Loader label={t('shared.loading')} />;
  if (audit.isError) return <SectionError testId="audit-error" />;

  const rows = auditRows(audit.data).slice(0, 7);

  return (
    <section
      aria-label={t('audit.title')}
      data-testid="audit-panel"
      className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-baseline justify-between gap-2 border-b border-border-muted pb-3">
        <div>
          <h2 className="text-title-md text-ink">{t('audit.title')}</h2>
          <p className="text-sm text-ink-muted">{t('audit.subtitle')}</p>
        </div>
        <span className="shrink-0 text-label-xs uppercase text-ink-muted">{t('audit.live')}</span>
      </div>
      {rows.length === 0 ? (
        <Empty title={t('audit.empty')} />
      ) : (
        <ul className="flex flex-col gap-4 py-3">
          {rows.map((row) => {
            const Icon = auditIconFor(row);
            const actor = row.actor ?? t('audit.nameUnavailable');
            const target = row.target ?? t('audit.nameUnavailable');
            const action = row.action ?? t('audit.valueUnavailable');
            const when = formatShortDateTime(row.createdAt, locale);
            return (
              <li key={row.key} data-testid="audit-row" className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
                  <Icon size={15} aria-hidden="true" className="shrink-0" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-1.5">
                    {when !== '' ? (
                      <span className="font-mono text-label-xs text-ink-muted">{when}</span>
                    ) : null}
                    <span data-testid="audit-action" className="text-label-sm font-medium text-ink">
                      {action}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    <span data-testid="audit-actor">{actor}</span>
                    <span aria-hidden="true">{' · '}</span>
                    <span data-testid="audit-target">{target}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="border-t border-border-muted pt-3">
        <Link
          data-testid="audit-view-all"
          href="/admin/audit-logs"
          className="flex items-center justify-between text-label-sm text-ink-muted transition-colors hover:text-ink"
        >
          <span>{t('audit.viewAll')}</span>
          <ArrowRight size={16} aria-hidden="true" className="shrink-0 rtl:rotate-180" />
        </Link>
      </div>
    </section>
  );
}

function HealthCard() {
  const t = useTranslations('adminOverview');
  const locale = useLocale();
  const health = useAdminHealthQuery();
  const system = useAdminSystemStatusQuery();
  const analytics = useAdminAnalyticsOverviewQuery();

  if (health.isPending || system.isPending || analytics.isPending)
    return <Loader label={t('shared.loading')} />;
  if (health.isError) return <SectionError testId="health-error" />;
  if (system.isError) return <SectionError testId="system-status-error" />;
  if (analytics.isError) return <SectionError testId="health-analytics-error" />;

  const status = system.data;
  const uptime = uptimeParts(status.uptimeSeconds);
  const turnaround = turnaroundValue(analytics.data.medianDecisionHours);
  const operational = health.data.status.toLowerCase() === 'ok';
  const numberFormat = new Intl.NumberFormat(locale);

  return (
    <section
      aria-label={t('system.title')}
      data-testid="system-status-panel"
      className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <h2 className="mb-3 text-title-md text-ink">{t('system.title')}</h2>
      <dl className="flex flex-col gap-3 divide-y divide-border-muted text-start">
        <div className="flex items-start justify-between gap-2">
          <div>
            <dt className="text-label-sm font-medium text-ink">{t('system.statusLabel')}</dt>
            <dd data-testid="system-status" className="text-sm text-ink-muted">
              {operational ? t('system.operational') : health.data.status}
            </dd>
          </div>
          <span
            aria-hidden="true"
            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${operational ? 'bg-emerald-600' : 'bg-amber-500'}`}
          />
        </div>
        {status.version ? (
          <div className="flex items-start justify-between gap-2 pt-3">
            <div>
              <dt className="text-label-sm font-medium text-ink">{t('system.versionLabel')}</dt>
              <dd data-testid="system-version" className="text-sm text-ink-muted">
                {status.version}
              </dd>
            </div>
          </div>
        ) : null}
        {uptime ? (
          <div className="flex items-start justify-between gap-2 pt-3">
            <div>
              <dt className="text-label-sm font-medium text-ink">{t('system.uptimeLabel')}</dt>
              <dd data-testid="system-uptime" className="text-sm text-ink-muted">
                {`${uptime.days}${t('system.daysUnit')} ${uptime.hours}${t('system.hoursUnit')} ${uptime.minutes}${t('system.minutesUnit')}`}
              </dd>
            </div>
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-2 pt-3">
          <div>
            <dt className="text-label-sm font-medium text-ink">{t('system.maintenanceLabel')}</dt>
            <dd data-testid="system-maintenance" className="text-sm text-ink-muted">
              {status.maintenance ? t('queue.maintenanceOn') : t('queue.maintenanceOff')}
            </dd>
          </div>
        </div>
        {turnaround !== null ? (
          <div className="flex items-start justify-between gap-2 pt-3">
            <div>
              <dt className="text-label-sm font-medium text-ink">{t('system.turnaroundLabel')}</dt>
              <dd className="text-sm text-ink-muted">{t('system.turnaroundHint')}</dd>
            </div>
            <dd
              data-testid="system-turnaround"
              className="shrink-0 text-label-md font-semibold text-ink"
            >
              {`${numberFormat.format(turnaround)} ${t('system.turnaroundUnit')}`}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

interface Shortcut {
  key: string;
  testId: string;
  href: string;
  Icon: LucideIcon;
  label: string;
  detail: string | null;
}

function ShortcutsRow() {
  const t = useTranslations('adminOverview');
  const locale = useLocale();
  const queue = useAdminAnalyticsQueueQuery();
  const numberFormat = new Intl.NumberFormat(locale);

  const shortcuts: Shortcut[] = [
    {
      key: 'review-orgs',
      testId: 'shortcut-review-orgs',
      href: '/admin/verifications',
      Icon: Building2,
      label: t('shortcuts.reviewOrgs'),
      detail: queue.data ? t('shortcuts.pendingCount', { count: numberFormat.format(queue.data.pendingVerifications) }) : null,
    },
    {
      key: 'review-reports',
      testId: 'shortcut-review-reports',
      href: '/admin/reports',
      Icon: Flag,
      label: t('shortcuts.reviewReports'),
      detail: queue.data ? t('shortcuts.openCount', { count: numberFormat.format(queue.data.openReports) }) : null,
    },
    {
      key: 'manage-volunteers',
      testId: 'shortcut-manage-volunteers',
      href: '/admin/volunteers',
      Icon: Users,
      label: t('shortcuts.manageVolunteers'),
      detail: null,
    },
    {
      key: 'manage-opportunities',
      testId: 'shortcut-manage-opportunities',
      href: '/admin/opportunities',
      Icon: HeartHandshake,
      label: t('shortcuts.manageOpportunities'),
      detail: null,
    },
    {
      key: 'audit-logs',
      testId: 'shortcut-audit-logs',
      href: '/admin/audit-logs',
      Icon: ScrollText,
      label: t('shortcuts.auditLogs'),
      detail: null,
    },
  ];

  return (
    <section
      aria-label={t('shortcuts.title')}
      data-testid="shortcuts-row"
      className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="mb-3">
        <h2 className="text-title-md text-ink">{t('shortcuts.title')}</h2>
        <p className="text-sm text-ink-muted">{t('shortcuts.subtitle')}</p>
      </div>
      {queue.isError ? (
        <SectionError testId="shortcuts-error" />
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {shortcuts.map((shortcut) => (
            <li key={shortcut.key}>
              <Link
                data-testid={shortcut.testId}
                href={shortcut.href}
                className="group flex h-12 items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 text-label-md text-ink transition-colors hover:bg-border-muted"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <shortcut.Icon size={20} aria-hidden="true" className="shrink-0 text-ink-muted" />
                  <span className="min-w-0 truncate">
                    <span className="block truncate">{shortcut.label}</span>
                    {shortcut.detail ? (
                      <span className="block truncate text-label-xs font-normal text-ink-muted">
                        {shortcut.detail}
                      </span>
                    ) : null}
                  </span>
                </span>
                <ArrowRight
                  size={18}
                  aria-hidden="true"
                  className="shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminDashboardPage({ locale }: { locale: string }) {
  const t = useTranslations('adminOverview');
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSessionQuery();
  const next = `/admin/dashboard`;
  const isAdmin = !session.isPending && !session.isError && session.data?.role === 'admin';
  const [days, setDays] = useState<number>(30);
  const [refreshing, setRefreshing] = useState(false);

  // These subscriptions exist only to watch for a 403 from ANY admin read.
  // They share query keys with the panels below, so TanStack Query dedupes them
  // into the same requests - the panels still own loading and error rendering.
  const analytics = useAdminAnalyticsOverviewQuery(isAdmin);
  const queue = useAdminAnalyticsQueueQuery(isAdmin);
  const stats = useAdminStatsOverviewQuery(isAdmin);
  const series = useAdminAnalyticsSeriesQuery(clampSeriesDays(days), isAdmin);
  const audit = useAdminAuditLogsQuery(isAdmin);
  const verifications = useAdminPendingVerificationsQuery(3, isAdmin);
  const reports = useAdminOpenReportsQuery(3, isAdmin);
  const gate = useAdminAnalyticsGate(
    session,
    analytics.error ??
      queue.error ??
      stats.error ??
      series.error ??
      audit.error ??
      verifications.error ??
      reports.error,
  );

  useEffect(() => {
    if (session.isError) router.replace(getLoginHref(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isError, router, locale]);

  async function handleRefresh(): Promise<void> {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: queryKeys.domain('admin-overview') });
      await queryClient.invalidateQueries({ queryKey: queryKeys.domain('admin-overview-system') });
    } finally {
      setRefreshing(false);
    }
  }

  if (session.isPending) {
    return (
      <div data-testid="admin-dashboard" className="flex min-w-0 flex-col gap-6">
        <Loader label={t('shared.loading')} />
      </div>
    );
  }

  if (session.isError) return null;

  if (!isAdmin || gate.isForbidden) {
    return (
      <div data-testid="admin-dashboard-forbidden" className="min-w-0">
        <ForbiddenScreen />
      </div>
    );
  }

  return (
    <div data-testid="admin-dashboard" className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <DashboardHeader days={clampSeriesDays(days)} onDays={setDays} refreshing={refreshing} onRefresh={handleRefresh} />
      <StatsRow />
      <div className="grid grid-cols-1 items-start gap-4 sm:gap-5 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5 lg:col-span-8">
          <SeriesPanel days={clampSeriesDays(days)} />
          <QueuePanel />
        </div>
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5 lg:col-span-4">
          <ActivityFeed />
          <HealthCard />
        </div>
      </div>
      <ShortcutsRow />
    </div>
  );
}
