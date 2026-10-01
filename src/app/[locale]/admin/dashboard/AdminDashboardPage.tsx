'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { Pill } from '@/components/ui/Pill';
import { ForbiddenScreen } from '@/components/system';
import { useSessionQuery, getLoginHref } from '@/hooks/useSession';
import {
  attentionItems,
  auditRows,
  clampSeriesDays,
  deltaCards,
  seriesMax,
  seriesTotals,
  statusCounts,
  turnaroundValue,
  uptimeParts,
  type AnalyticsSeriesPoint,
  type AttentionKey,
  type SeriesField,
  type TotalKey,
} from '@/lib/api/adminAnalytics';
import {
  useAdminAnalyticsGate,
  useAdminAnalyticsOverviewQuery,
  useAdminAnalyticsQueueQuery,
  useAdminAnalyticsSeriesQuery,
  useAdminAuditLogsQuery,
  useAdminHealthQuery,
  useAdminStatsOverviewQuery,
  useAdminSystemStatusQuery,
} from '@/hooks/useAdminAnalytics';

// F14 admin dashboard (this session's route dir). Read-only read-model over the
// admin analytics endpoints via useAdminAnalytics.ts. Every figure comes from a
// response field — no hardcoded numbers, no invented peaks. The attention queue
// is navigation-only and links onward to the F15 manage screens; the audit
// strip renders enriched display names; the system status card is neutral (no
// compliance or civic-sync copy). Moderation actions are F16, manage tables F15.

const SERIES_WINDOW_OPTIONS = [7, 14, 30, 60, 90] as const;

const TOTAL_LABEL_KEYS: Record<TotalKey, string> = {
  users: 'totals.users',
  organizations: 'totals.organizations',
  opportunities: 'totals.opportunities',
  applications: 'totals.applications',
  submissions: 'totals.submissions',
};

const ATTENTION_LABEL_KEYS: Record<AttentionKey, string> = {
  pendingVerifications: 'queue.pendingVerifications',
  openReports: 'queue.openReports',
  underReviewSubmissions: 'queue.underReviewSubmissions',
  suspendedUsers: 'queue.suspendedUsers',
  suspendedOrganizations: 'queue.suspendedOrganizations',
};

const SERIES_LABEL_KEYS: Record<SeriesField, string> = {
  signups: 'series.signups',
  applications: 'series.applications',
  verifications: 'series.verifications',
};

const SERIES_FIELD_ORDER: SeriesField[] = ['signups', 'applications', 'verifications'];

function SectionError({ testId }: { testId: string }) {
  const t = useTranslations('adminOverview');
  return (
    <p data-testid={testId} role="alert" className="text-sm text-status-error">
      {t('shared.loadError')}
    </p>
  );
}

function MetricTile({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p data-testid={testId} className="text-xl font-semibold text-ink">
        {value}
      </p>
    </div>
  );
}

function OverviewPanel() {
  const t = useTranslations('adminOverview');
  const analytics = useAdminAnalyticsOverviewQuery();
  const stats = useAdminStatsOverviewQuery();

  if (analytics.isPending || stats.isPending) return <Loader label={t('shared.loading')} />;
  if (analytics.isError) return <SectionError testId="overview-error" />;
  if (stats.isError) return <SectionError testId="stats-error" />;

  const overview = analytics.data;
  const statsOverview = stats.data;
  const cards = deltaCards(overview.totals);
  const turnaround = turnaroundValue(overview.medianDecisionHours);

  return (
    <Card title={t('overview.title')}>
      <div data-testid="overview-panel" className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">{t('overview.subtitle')}</p>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <li
              key={card.key}
              data-testid={`overview-total-${card.key}`}
              className="rounded-md border border-border bg-surface p-3"
            >
              <p className="text-xs text-ink-muted">{t(TOTAL_LABEL_KEYS[card.key])}</p>
              <p data-testid={`overview-total-${card.key}-value`} className="text-2xl font-semibold text-ink">
                {card.current}
              </p>
              {card.deltaPercent === null ? (
                <p
                  data-testid={`overview-total-${card.key}-delta`}
                  className="text-xs text-ink-muted"
                >
                  {t('overview.noComparison')}
                </p>
              ) : (
                <p
                  data-testid={`overview-total-${card.key}-delta`}
                  className="text-xs text-ink-muted"
                >
                  {t('overview.currentLabel')} · {t('overview.previousLabel')} · {card.deltaPercent}
                </p>
              )}
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetricTile
            label={t('metrics.activeParticipants')}
            value={String(overview.activeParticipants)}
            testId="metric-active-participants"
          />
          <MetricTile
            label={t('metrics.verificationReady')}
            value={String(overview.verificationReady.total)}
            testId="metric-verification-ready"
          />
          <MetricTile
            label={t('metrics.gateFreezes')}
            value={String(overview.gateFreezes)}
            testId="metric-gate-freezes-analytics"
          />
          <MetricTile
            label={t('metrics.gateFreezes')}
            value={String(statsOverview.gateFreezes)}
            testId="metric-gate-freezes-stats"
          />
          <MetricTile
            label={t('metrics.turnaround')}
            value={
              turnaround === null
                ? t('metrics.turnaroundUnavailable')
                : `${turnaround} ${t('metrics.turnaroundUnit')}`
            }
            testId="metric-turnaround"
          />
          <MetricTile
            label={`${t('queue.pendingVerifications')} · ${t('metrics.fromStats')}`}
            value={String(statsOverview.counts.pendingVerifications)}
            testId="metric-pending-verifications-stats"
          />
        </div>
        <p className="text-xs text-ink-muted">{t('metrics.fromAnalytics')}</p>
      </div>
    </Card>
  );
}

function PerStatusPanel() {
  const t = useTranslations('adminOverview');
  const analytics = useAdminAnalyticsOverviewQuery();

  if (analytics.isPending) return <Loader label={t('shared.loading')} />;
  if (analytics.isError) return <SectionError testId="per-status-error" />;

  const perStatus = analytics.data.perStatus;
  const groups: { label: string; testId: string; counts: Record<string, number> }[] = [
    { label: t('perStatus.users'), testId: 'status-users', counts: perStatus.users },
    { label: t('perStatus.organizations'), testId: 'status-organizations', counts: perStatus.organizations.byStatus },
    {
      label: t('perStatus.organizationsVerification'),
      testId: 'status-organizations-verification',
      counts: perStatus.organizations.byVerificationStatus,
    },
    { label: t('perStatus.opportunities'), testId: 'status-opportunities', counts: perStatus.opportunities },
    { label: t('perStatus.applications'), testId: 'status-applications', counts: perStatus.applications },
    { label: t('perStatus.submissions'), testId: 'status-submissions', counts: perStatus.submissions },
  ];

  return (
    <Card title={t('perStatus.title')}>
      <div data-testid="per-status-panel" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <div key={group.testId}>
            <h3 className="mb-2 text-sm font-medium text-ink">{group.label}</h3>
            <ul data-testid={group.testId} className="flex flex-col gap-1">
              {statusCounts(group.counts).map((entry) => (
                <li key={entry.status} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-ink-muted">{entry.status}</span>
                  <span data-testid={`${group.testId}-${entry.status}`} className="font-medium text-ink">
                    {entry.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SeriesPanel() {
  const t = useTranslations('adminOverview');
  const [days, setDays] = useState<number>(30);
  const bounded = clampSeriesDays(days);
  const series = useAdminAnalyticsSeriesQuery(bounded);
  const points: AnalyticsSeriesPoint[] = series.data?.points ?? [];
  const max = seriesMax(points);
  const totals = seriesTotals(points);

  return (
    <Card title={t('series.title')}>
      <div data-testid="series-panel" className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{t('series.subtitle')}</p>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="series-window" className="text-sm text-ink-muted">
            {t('series.windowLabel')}
          </label>
          <select
            id="series-window"
            data-testid="series-window"
            value={bounded}
            onChange={(event) => setDays(Number(event.target.value))}
            className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink"
          >
            {SERIES_WINDOW_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} {t('series.daysUnit')}
              </option>
            ))}
          </select>
          <span data-testid="series-days" className="text-sm text-ink-muted">
            {bounded}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SERIES_FIELD_ORDER.map((field) => (
            <MetricTile
              key={field}
              label={t(SERIES_LABEL_KEYS[field])}
              value={String(totals[field])}
              testId={`series-total-${field}`}
            />
          ))}
        </div>

        {series.isPending ? (
          <Loader label={t('shared.loading')} />
        ) : series.isError ? (
          <SectionError testId="series-error" />
        ) : points.length === 0 || max === 0 ? (
          <Empty title={t('series.empty')} />
        ) : (
          <ul data-testid="series-points" className="flex flex-col gap-1">
            {points.map((point) => (
              <li
                key={point.date}
                data-testid={`series-point-${point.date}`}
                aria-label={t('series.pointLabel', {
                  date: point.date,
                  signups: point.signups,
                  applications: point.applications,
                  verifications: point.verifications,
                })}
                className="flex flex-col gap-1 text-sm"
              >
                <span className="text-ink-muted">{point.date}</span>
                <span className="flex flex-wrap items-center gap-3">
                  {SERIES_FIELD_ORDER.map((field) => (
                    <span key={field} className="flex items-center gap-1">
                      <span className="text-xs text-ink-muted">{t(SERIES_LABEL_KEYS[field])}</span>
                      <span
                        data-testid={`series-point-${point.date}-${field}`}
                        className="font-medium text-ink"
                      >
                        {point[field]}
                      </span>
                      <span
                        aria-hidden="true"
                        className="inline-block h-1.5 rounded-full bg-ink-muted"
                        style={{ width: `${Math.round((point[field] / max) * 100)}%` }}
                      />
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function QueuePanel() {
  const t = useTranslations('adminOverview');
  const queue = useAdminAnalyticsQueueQuery();

  if (queue.isPending) return <Loader label={t('shared.loading')} />;
  if (queue.isError) return <SectionError testId="queue-error" />;

  const items = attentionItems(queue.data);

  return (
    <Card title={t('queue.title')}>
      <div data-testid="queue-panel" className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{t('queue.subtitle')}</p>
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.key}
              data-testid={`queue-item-${item.key}`}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span className="text-ink">{t(ATTENTION_LABEL_KEYS[item.key])}</span>
              <span className="flex items-center gap-3">
                <span data-testid={`queue-count-${item.key}`} className="font-semibold text-ink">
                  {item.count}
                </span>
                <Link
                  data-testid={`queue-link-${item.key}`}
                  href={item.href}
                  className="text-sm text-ink-muted underline"
                >
                  {t('queue.viewManage')}
                </Link>
              </span>
            </li>
          ))}
        </ul>
        <div data-testid="queue-maintenance" className="flex items-center gap-2">
          <Pill tone={queue.data.maintenanceMode ? 'pending' : 'neutral'}>
            {queue.data.maintenanceMode ? t('queue.maintenanceOn') : t('queue.maintenanceOff')}
          </Pill>
        </div>
      </div>
    </Card>
  );
}

function AuditPanel() {
  const t = useTranslations('adminOverview');
  const audit = useAdminAuditLogsQuery();

  if (audit.isPending) return <Loader label={t('shared.loading')} />;
  if (audit.isError) return <SectionError testId="audit-error" />;

  const rows = auditRows(audit.data);

  return (
    <Card title={t('audit.title')}>
      <div data-testid="audit-panel" className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{t('audit.subtitle')}</p>
        {rows.length === 0 ? (
          <Empty title={t('audit.empty')} />
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li
                key={row.key}
                data-testid="audit-row"
                className="flex flex-col gap-1 border-b border-border pb-2 text-sm last:border-b-0"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-ink-muted">{t('audit.actorLabel')}</span>
                  <span data-testid="audit-actor" className="font-medium text-ink">
                    {row.actor ?? t('audit.nameUnavailable')}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-ink-muted">{t('audit.targetLabel')}</span>
                  <span data-testid="audit-target" className="text-ink">
                    {row.target ?? t('audit.nameUnavailable')}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <span>{t('audit.actionLabel')}</span>
                  <span data-testid="audit-action" className="text-ink">
                    {row.action ?? t('audit.valueUnavailable')}
                  </span>
                  {row.method ? (
                    <span data-testid="audit-method">
                      {t('audit.methodLabel')}: {row.method}
                    </span>
                  ) : null}
                  {row.path ? (
                    <span data-testid="audit-path" className="break-all">
                      {row.path}
                    </span>
                  ) : null}
                  {row.createdAt ? (
                    <span data-testid="audit-time">
                      {t('audit.timeLabel')}: {row.createdAt}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function SystemStatusPanel() {
  const t = useTranslations('adminOverview');
  const health = useAdminHealthQuery();
  const system = useAdminSystemStatusQuery();

  if (health.isPending || system.isPending) return <Loader label={t('shared.loading')} />;
  if (health.isError) return <SectionError testId="health-error" />;
  if (system.isError) return <SectionError testId="system-status-error" />;

  const status = system.data;
  const uptime = uptimeParts(status.uptimeSeconds);

  return (
    <Card title={t('system.title')}>
      <dl data-testid="system-status-panel" className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-ink-muted">{t('system.statusLabel')}</dt>
          <dd data-testid="system-status" className="font-medium text-ink">
            {health.data.status}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-ink-muted">{t('system.versionLabel')}</dt>
          <dd data-testid="system-version" className="text-ink">
            {status.version ?? t('system.unavailable')}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-ink-muted">{t('system.uptimeLabel')}</dt>
          <dd data-testid="system-uptime" className="text-ink">
            {uptime === null
              ? t('system.unavailable')
              : `${uptime.days}${t('system.daysUnit')} ${uptime.hours}${t('system.hoursUnit')} ${uptime.minutes}${t('system.minutesUnit')}`}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-ink-muted">{t('system.maintenanceLabel')}</dt>
          <dd data-testid="system-maintenance" className="text-ink">
            {status.maintenance ? t('queue.maintenanceOn') : t('queue.maintenanceOff')}
          </dd>
        </div>
        {status.maintenance && status.message ? (
          <div className="flex flex-col gap-1">
            <dt className="text-ink-muted">{t('queue.title')}</dt>
            <dd data-testid="system-maintenance-message" className="text-ink">
              {status.message}
            </dd>
          </div>
        ) : null}
      </dl>
    </Card>
  );
}

export function AdminDashboardPage({ locale }: { locale: string }) {
  const t = useTranslations('adminOverview');
  const router = useRouter();
  const session = useSessionQuery();
  const next = `/admin/dashboard`;
  const isAdmin = !session.isPending && !session.isError && session.data?.role === 'admin';

  // These five subscriptions exist only to watch for a 403 from ANY admin read.
  // They share query keys with the panels below, so TanStack Query dedupes them
  // into the same requests - the panels still own loading and error rendering.
  const analytics = useAdminAnalyticsOverviewQuery(isAdmin);
  const queue = useAdminAnalyticsQueueQuery(isAdmin);
  const stats = useAdminStatsOverviewQuery(isAdmin);
  const series = useAdminAnalyticsSeriesQuery(30, isAdmin);
  const audit = useAdminAuditLogsQuery(isAdmin);
  const gate = useAdminAnalyticsGate(
    session,
    analytics.error ?? queue.error ?? stats.error ?? series.error ?? audit.error,
  );

  useEffect(() => {
    if (session.isError) router.replace(getLoginHref(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isError, router, locale]);

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
    <div data-testid="admin-dashboard" className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">{t('header.title')}</h1>
        <p className="text-sm text-ink-muted">{t('header.subtitle')}</p>
      </header>
      <OverviewPanel />
      <SeriesPanel />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <QueuePanel />
        <SystemStatusPanel />
      </div>
      <PerStatusPanel />
      <AuditPanel />
    </div>
  );
}
