'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { useSessionQuery, getLoginHref } from '@/hooks/useSession';
import {
  orgCoverUrlOf,
  orgDisplayCode,
  rowId,
  statCards,
  type ApplicationSummaryRow,
  type NotificationRow,
  type OrgActivityItem,
  type OrgStats,
  type ParticipantSummaryRow,
  type SubmissionSummaryRow,
} from '@/lib/api/orgStats';
import {
  useApplicationsSummaryQuery,
  useMyOrganizationQuery,
  useNotificationsStripQuery,
  useOrgActivityQuery,
  useOrgCoverMediaQuery,
  useOrgStatsQuery,
  useParticipantsSummaryQuery,
  usePublishGateQuery,
  useSubmissionsSummaryQuery,
} from '@/hooks/useOrgStats';

// F9 org dashboard (this session's route dir). Read-model over 8 endpoints via
// useOrgStats.ts; summary panels link onward to the F11 queues (no mutations,
// no CRUD, no review actions here). Guest visits redirect to Login (decision
// 10); cover renders from the real coverMediaId only, else a neutral empty
// state (never a placeholder).

function SectionError({ message, testId }: { message: string; testId: string }) {
  return (
    <p data-testid={testId} role="alert" className="text-sm text-status-error">
      {message}
    </p>
  );
}

function joinedName(row: { nameFr?: string | null; nameAr?: string | null; name?: string | null; title?: string | null }): string {
  return row.nameFr ?? row.nameAr ?? row.name ?? row.title ?? '';
}

function FactHeader() {
  const t = useTranslations('orgWorkspace');
  const orgQuery = useMyOrganizationQuery();
  const coverMediaId = orgQuery.data?.coverMediaId ?? null;
  const coverQuery = useOrgCoverMediaQuery(coverMediaId);

  if (orgQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (orgQuery.isError) return <SectionError testId="dashboard-header-error" message={t('shared.loadError')} />;

  const org = orgQuery.data;
  const code = orgDisplayCode(org.registryId);
  const name = org.nameFr ?? org.nameAr ?? '';
  const location = [org.location?.address, org.location?.municipalityId, org.location?.wilayaId]
    .filter((part) => part && part.length > 0)
    .join(', ');
  const coverUrl = orgCoverUrlOf(coverQuery.data);

  return (
    <Card>
      <div data-testid="dashboard-header" className="flex flex-col gap-3">
        {coverMediaId ? (
          coverQuery.isPending ? (
            <Loader label={t('shared.loading')} />
          ) : coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img data-testid="org-cover" src={coverUrl} alt="" className="h-40 w-full rounded-md object-cover" />
          ) : (
            <Empty title={t('header.coverEmptyTitle')} description={t('header.coverEmptyBody')} />
          )
        ) : (
          <div data-testid="org-cover-empty">
            <Empty title={t('header.coverEmptyTitle')} description={t('header.coverEmptyBody')} />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('header.title')}</h1>
          <p className="text-sm text-ink-muted">{t('header.subtitle')}</p>
        </div>
        {name ? <p data-testid="org-name" className="text-lg font-semibold text-ink">{name}</p> : null}
        {code ? (
          <p data-testid="org-code" className="text-sm text-ink-muted">{code}</p>
        ) : null}
        <dl className="flex flex-col gap-1 text-sm text-ink-muted sm:flex-row sm:gap-6">
          {location ? (
            <div className="flex gap-2">
              <dt>{t('header.locationLabel')}</dt>
              <dd data-testid="org-location">{location}</dd>
            </div>
          ) : null}
          {org.foundedYear !== undefined ? (
            <div className="flex gap-2">
              <dt>{t('header.foundedLabel')}</dt>
              <dd data-testid="org-founded">{org.foundedYear}</dd>
            </div>
          ) : null}
          {org.verificationStatus ? (
            <div className="flex gap-2">
              <dt>{t('header.statusLabel')}</dt>
              <dd data-testid="org-status">{org.verificationStatus}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </Card>
  );
}

function StatsPanel() {
  const t = useTranslations('orgWorkspace');
  const statsQuery = useOrgStatsQuery();

  if (statsQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (statsQuery.isError) return <SectionError testId="dashboard-stats-error" message={t('shared.loadError')} />;

  const cards = statCards(statsQuery.data as OrgStats);
  return (
    <Card title={t('stats.title')}>
      <dl data-testid="dashboard-stats" className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <div key={card.key} className="rounded-md border border-border-muted bg-surface-muted p-3">
            <dt className="text-xs text-ink-muted">{t(`stats.${card.key}`)}</dt>
            <dd data-testid={`dashboard-stat-${card.key}`} className="text-xl font-semibold text-ink">
              {card.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function PublishGateBanner() {
  const t = useTranslations('orgWorkspace');
  const gateQuery = usePublishGateQuery();

  if (gateQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (gateQuery.isError) return <SectionError testId="publish-gate-error" message={t('shared.loadError')} />;
  if (!gateQuery.data.locked) return null;

  return (
    <div data-testid="publish-gate-locked" role="status" className="rounded-md border border-status-pending bg-surface-muted p-4">
      <p className="text-sm font-semibold text-ink">{t('gate.lockedTitle')}</p>
      <p className="text-sm text-ink-muted">{t('gate.lockedBody', { count: gateQuery.data.pendingCount ?? 0 })}</p>
    </div>
  );
}

function SubmissionsSummary() {
  const t = useTranslations('orgWorkspace');
  const summaryQuery = useSubmissionsSummaryQuery();

  return (
    <Card title={t('submissions.title')}>
      <div data-testid="submissions-summary" className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{t('submissions.subtitle')}</p>
        {summaryQuery.isPending ? (
          <Loader label={t('shared.loading')} />
        ) : summaryQuery.isError ? (
          <SectionError testId="submissions-error" message={t('shared.loadError')} />
        ) : summaryQuery.data.items.length === 0 ? (
          <Empty title={t('submissions.empty')} />
        ) : (
          <>
            <p data-testid="submissions-count" className="text-sm font-medium text-ink">
              {t('submissions.count', { total: summaryQuery.data.total })}
            </p>
            <ul className="flex flex-col gap-2">
              {(summaryQuery.data.items as SubmissionSummaryRow[]).map((row) => (
                <li
                  key={rowId(row)}
                  data-testid="submission-row"
                  className="rounded-md border border-border-muted bg-surface-muted p-3 text-sm"
                >
                  <span className="font-medium text-ink">{row.title ?? joinedName(row.volunteer ?? {})}</span>
                  <span className="block text-ink-muted">{joinedName(row.opportunity ?? {})} · {row.status}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <Link href="/org/contributions" data-testid="submissions-view-all" className="text-sm font-medium text-primary">
          {t('submissions.viewAll')}
        </Link>
      </div>
    </Card>
  );
}

function ApplicationsSummary() {
  const t = useTranslations('orgWorkspace');
  const summaryQuery = useApplicationsSummaryQuery();

  return (
    <Card title={t('applications.title')}>
      <div data-testid="applications-summary" className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{t('applications.subtitle')}</p>
        {summaryQuery.isPending ? (
          <Loader label={t('shared.loading')} />
        ) : summaryQuery.isError ? (
          <SectionError testId="applications-error" message={t('shared.loadError')} />
        ) : summaryQuery.data.items.length === 0 ? (
          <Empty title={t('applications.empty')} />
        ) : (
          <>
            <p data-testid="applications-count" className="text-sm font-medium text-ink">
              {t('applications.count', { total: summaryQuery.data.total })}
            </p>
            <ul className="flex flex-col gap-2">
              {(summaryQuery.data.items as ApplicationSummaryRow[]).map((row) => (
                <li
                  key={rowId(row)}
                  data-testid="application-row"
                  className="rounded-md border border-border-muted bg-surface-muted p-3 text-sm"
                >
                  <span className="font-medium text-ink">{joinedName(row.applicant ?? row.volunteer ?? {})}</span>
                  <span className="block text-ink-muted">{joinedName(row.opportunity ?? {})} · {row.status}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <Link href="/org/applications" data-testid="applications-view-all" className="text-sm font-medium text-primary">
          {t('applications.viewAll')}
        </Link>
      </div>
    </Card>
  );
}

function ParticipantsSnapshot() {
  const t = useTranslations('orgWorkspace');
  const summaryQuery = useParticipantsSummaryQuery();

  return (
    <Card title={t('participants.title')}>
      <div data-testid="participants-snapshot" className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{t('participants.subtitle')}</p>
        {summaryQuery.isPending ? (
          <Loader label={t('shared.loading')} />
        ) : summaryQuery.isError ? (
          <SectionError testId="participants-error" message={t('shared.loadError')} />
        ) : summaryQuery.data.items.length === 0 ? (
          <Empty title={t('participants.empty')} />
        ) : (
          <>
            <p data-testid="participants-count" className="text-sm font-medium text-ink">
              {t('participants.count', { total: summaryQuery.data.total })}
            </p>
            <ul className="flex flex-col gap-2">
              {(summaryQuery.data.items as ParticipantSummaryRow[]).map((row) => (
                <li
                  key={rowId(row)}
                  data-testid="participant-row"
                  className="rounded-md border border-border-muted bg-surface-muted p-3 text-sm"
                >
                  <span className="font-medium text-ink">{joinedName(row.volunteer ?? {})}</span>
                  <span className="block text-ink-muted">{joinedName(row.opportunity ?? {})} · {row.status}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <Link href="/org/participants" data-testid="participants-view-all" className="text-sm font-medium text-primary">
          {t('participants.viewAll')}
        </Link>
      </div>
    </Card>
  );
}

function ActivityStrip() {
  const t = useTranslations('orgWorkspace');
  const activityQuery = useOrgActivityQuery();

  return (
    <Card title={t('activity.title')}>
      <div data-testid="activity-strip" className="flex flex-col gap-2">
        {activityQuery.isPending ? (
          <Loader label={t('shared.loading')} />
        ) : activityQuery.isError ? (
          <SectionError testId="activity-error" message={t('activity.error')} />
        ) : activityQuery.data.items.length === 0 ? (
          <Empty title={t('activity.empty')} />
        ) : (
          <ul className="flex flex-col gap-2">
            {(activityQuery.data.items as OrgActivityItem[]).map((item) => (
              <li key={rowId(item)} data-testid="activity-item" className="text-sm text-ink-muted">
                {item.title ?? item.type ?? item.kind ?? ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function NotificationsStrip() {
  const t = useTranslations('orgWorkspace');
  const notificationsQuery = useNotificationsStripQuery();

  return (
    <Card title={t('notifications.title')}>
      <div data-testid="notifications-strip" className="flex flex-col gap-2">
        {notificationsQuery.isPending ? (
          <Loader label={t('shared.loading')} />
        ) : notificationsQuery.isError ? (
          <SectionError testId="notifications-error" message={t('shared.loadError')} />
        ) : notificationsQuery.data.items.length === 0 ? (
          <Empty title={t('notifications.empty')} />
        ) : (
          <ul className="flex flex-col gap-2">
            {(notificationsQuery.data.items as NotificationRow[]).map((item) => (
              <li key={rowId(item)} data-testid="notification-item" className="flex items-start justify-between gap-3 text-sm">
                <span className="text-ink">{item.title ?? item.body ?? item.type ?? ''}</span>
                <span data-testid="notification-read-state" className="shrink-0 text-xs text-ink-muted">
                  {item.isRead ? t('notifications.read') : t('notifications.unread')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export function OrgDashboardPage({ locale }: { locale: string }) {
  const t = useTranslations('orgWorkspace');
  const router = useRouter();
  const session = useSessionQuery();
  const next = `/${locale}/org/dashboard`;

  useEffect(() => {
    if (session.isError) router.replace(getLoginHref(locale, next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isError, router, locale]);

  if (session.isPending) {
    return (
      <div data-testid="org-dashboard" className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
        <Loader label={t('shared.loading')} />
      </div>
    );
  }
  if (session.isError) return null;

  return (
    <div data-testid="org-dashboard" className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
      <FactHeader />
      <StatsPanel />
      <PublishGateBanner />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SubmissionsSummary />
        <ApplicationsSummary />
      </div>
      <ParticipantsSnapshot />
      <ActivityStrip />
      <NotificationsStrip />
    </div>
  );
}
