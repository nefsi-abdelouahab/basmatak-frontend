'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardList,
  Clock,
  Hourglass,
  Info,
  LayoutGrid,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { ScrollFade } from '@/components/ui/ScrollFade';
import {
  canWithdrawApplication,
  rowId,
  shortApplicationId,
  type ApplicationRow,
  type ApplicationStatus,
} from '@/lib/api/tasks';
import { useMyApplicationsQuery } from '@/hooks/useTasks';
import { ActivityStrip, RequireTasks, SectionError, joinName } from './components';
import { ApplicationDetail } from './ApplicationDetail';

// F6-owned My Applications route: real under_review tab, ISO date filter,
// short-form IDs, inline expansion + deep links, withdraw in detail,
// activity strip. Visual structure follows the
// `Basmatak Tatatoua - My Applications` design (header card, search +
// date + refresh row, status tabs with counts, rich application cards,
// overview rail); all data stays on the real applications API.
type TabValue = ApplicationStatus | 'all';

function formatDate(iso: string | undefined, locale: string): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString(locale);
}

function opportunityHref(row: ApplicationRow): string | null {
  const join = row.opportunity as { id?: string; _id?: string; slug?: string } | null | undefined;
  const raw = row.opportunityId ?? join?.slug ?? join?.id ?? join?._id ?? '';
  const target = raw.trim();
  return target === '' ? null : `/volunteer/opportunities/${encodeURIComponent(target)}`;
}

function isOrganizationVerified(row: ApplicationRow): boolean {
  const organization = row.organization as { verificationStatus?: string } | null | undefined;
  return organization?.verificationStatus === 'verified';
}

function StatusBanner({ row }: { row: ApplicationRow }) {
  const t = useTranslations('volunteerTasks');
  if (row.status === 'accepted') {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-status-success/10 p-3">
        <CheckCircle2
          size={18}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-status-success"
        />
        <p className="text-sm font-medium text-ink">{t('applications.bannerAccepted')}</p>
      </div>
    );
  }
  if (row.status === 'pending' || row.status === 'under_review') {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-status-pending/10 p-3">
        <Clock size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-status-pending" />
        <p className="text-sm font-medium text-ink">{t('applications.bannerPending')}</p>
      </div>
    );
  }
  if (row.status === 'rejected') {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface-muted p-3">
        <Info size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
        <p className="text-sm text-ink-muted">
          {row.reason ?? t('applications.bannerRejectedFallback')}
        </p>
      </div>
    );
  }
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface-muted p-3">
      <XCircle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
      <p className="text-sm text-ink-muted">{t('applications.bannerWithdrawn')}</p>
    </div>
  );
}

// Card status indicator: icon + plain typography, no pill or badge box.
// The i18n status label is visible text here (part of the card's metadata
// hierarchy) and also feeds the audit-trail line below.
function ApplicationStatusLine({ status, label }: { status: string; label: string }) {
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
    <p
      className={`mt-3 flex items-center gap-2 border-t border-border-muted pt-3 text-label-md font-medium ${tone}`}
    >
      <Icon size={16} aria-hidden="true" className="shrink-0" />
      <span>{label}</span>
    </p>
  );
}

// Design-faithful status filter tabs for the `Basmatak Tatatoua - My
// Applications` header: square boxes (rounded-md, h-8) with a per-status
// icon and a count badge, horizontally scrollable on narrow screens. Local
// to this page on purpose — the shared TabBar stays untouched so the tasks
// and org pages keep their current appearance. Same contract as TabBar:
// `application-tabs` / `tab-{value}` testIDs, tablist/tab roles and
// aria-selected are preserved for the existing e2e suite.
function ApplicationFilterTabs({
  tabs,
  active,
  counts,
  onTab,
}: {
  tabs: { value: TabValue; label: string; Icon: LucideIcon }[];
  active: TabValue;
  counts?: Record<string, number | undefined>;
  onTab: (value: TabValue) => void;
}) {
  return (
    <div
      data-testid="application-tabs"
      role="tablist"
      aria-label="application-tabs"
      className="flex items-center gap-2 overflow-x-auto pb-1"
    >
      {tabs.map((tab) => {
        const selected = active === tab.value;
        const count = counts?.[tab.value];
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            data-testid={`tab-${tab.value}`}
            onClick={() => onTab(tab.value)}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-label-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-strong ${
              selected
                ? 'bg-primary text-on-primary'
                : 'bg-surface-muted text-ink-muted hover:bg-border-muted hover:text-ink'
            }`}
          >
            <tab.Icon size={16} aria-hidden="true" className="shrink-0" />
            <span>{tab.label}</span>
            {typeof count === 'number' ? (
              <span
                className={`rounded px-1.5 py-0.5 text-label-xs font-medium ${
                  selected ? 'bg-on-primary/20 text-on-primary' : 'bg-border-muted text-ink-muted'
                }`}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// Organization logo slot for the application cards. The applications API
// join currently returns only id/slug/nameFr/nameAr (verified in
// backend application-inbox.joiner.ts: `.select('slug nameFr nameAr')`),
// so this renders a real logo ONLY when the API provides a URL string and
// otherwise falls back to the real organization initial — never a mocked
// or hardcoded image.
function organizationLogoUrl(row: ApplicationRow): string | null {
  const organization = row.organization as
    { logoUrl?: unknown; logo?: unknown; avatarUrl?: unknown; image?: unknown } | null | undefined;
  const candidates = [
    organization?.logoUrl,
    organization?.logo,
    organization?.avatarUrl,
    organization?.image,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const url = candidate.trim();
      if (url !== '' && (/^https?:\/\//.test(url) || url.startsWith('/'))) return url;
    }
  }
  return null;
}

function ApplicationCard({
  row,
  locale,
  statusLabel,
  expanded,
  onToggle,
  onWithdrawn,
}: {
  row: ApplicationRow;
  locale: string;
  statusLabel: string;
  expanded: boolean;
  onToggle: () => void;
  onWithdrawn: () => void;
}) {
  const t = useTranslations('volunteerTasks');
  const id = rowId(row);
  const organizationName = joinName(row.organization, locale);
  const opportunityName = joinName(row.opportunity, locale);
  const positionName = joinName(row.position, locale);
  const decisionActorName = joinName(row.decisionActor, locale);
  const href = opportunityHref(row);
  const verified = isOrganizationVerified(row);
  const logoUrl = organizationLogoUrl(row);
  // Avatar chain: real organization image → bundled `/org.png` default →
  // organization initial (never an empty or broken avatar).
  const [avatarSrc, setAvatarSrc] = useState<string | null>(logoUrl ?? '/org.png');
  const initial = (organizationName !== '—' ? organizationName : opportunityName).trim().charAt(0);

  return (
    <li
      data-testid="application-row"
      className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="flex min-w-0 items-start gap-3">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt=""
            onError={() => setAvatarSrc((current) => (current === '/org.png' ? null : '/org.png'))}
            className="h-12 w-12 shrink-0 rounded-lg bg-surface-muted object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gold-soft text-lg font-semibold text-gold-strong"
          >
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="break-words text-title-md font-semibold text-ink">
              {organizationName}
            </span>
            {verified ? (
              <span
                role="img"
                aria-label={t('applications.verifiedBadge')}
                title={t('applications.verifiedBadge')}
                className="inline-flex shrink-0 items-center text-status-success"
              >
                <BadgeCheck size={14} aria-hidden="true" />
              </span>
            ) : null}
          </div>
          <h2 className="mt-0.5 break-words text-title-lg font-semibold text-ink">
            {opportunityName}
          </h2>
          <p className="mt-1 text-label-md text-ink-muted">
            <span className="font-medium text-gold-strong">{positionName}</span>
            <span aria-hidden="true">{' • '}</span>
            <span>
              {t('applications.appliedLabel')}
              {': '}
              {formatDate(row.createdAt, locale)}
            </span>
          </p>
        </div>
      </div>

      <ApplicationStatusLine status={row.status} label={statusLabel} />

      <StatusBanner row={row} />

      <div className="mt-3 grid grid-cols-1 gap-2 text-body-md text-ink-muted sm:grid-cols-2">
        <span className="inline-flex min-w-0 items-center gap-2">
          <CalendarDays size={16} aria-hidden="true" className="shrink-0" />
          <span className="truncate">
            {t('applications.appliedOnLabel')}
            {': '}
            {formatDate(row.createdAt, locale)}
          </span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-label-md text-ink-muted">
            {t('applications.idLabel')}
            {':'}
          </span>
          <span className="truncate font-mono text-label-md font-semibold text-ink">
            {shortApplicationId(id)}
          </span>
        </span>
      </div>

      {row.message ? (
        <blockquote className="mt-3 rounded-lg bg-surface-muted p-3 text-body-md italic text-ink-muted">
          {row.message}
        </blockquote>
      ) : null}

      <div className="mt-3 border-t border-border-muted pt-3">
        <p className="text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
          {t('applications.auditTitle')}
        </p>
        <p className="mt-1 text-label-md text-ink-muted">
          {t('timeline.submitted')}
          {': '}
          {formatDate(row.createdAt, locale)}
          {row.updatedAt && row.updatedAt !== row.createdAt ? (
            <span>
              {' → '}
              {statusLabel}
              {': '}
              {formatDate(row.updatedAt, locale)}
            </span>
          ) : null}
          {decisionActorName !== '—' ? (
            <span>
              {' • '}
              {t('applications.decisionByLabel')}
              {': '}
              {decisionActorName}
            </span>
          ) : null}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border-muted pt-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid={`expand-${id}`}
            aria-expanded={expanded}
            onClick={onToggle}
            className="inline-flex items-center gap-1 text-label-md font-medium text-gold-strong hover:text-ink"
          >
            <span>
              {expanded ? t('applications.hideDetails') : t('applications.viewApplicationDetails')}
            </span>
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canWithdrawApplication(row.status) && !expanded ? (
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex items-center gap-1 text-label-md font-medium text-status-error hover:opacity-80"
            >
              <XCircle size={16} aria-hidden="true" />
              <span>{t('applications.withdrawCta')}</span>
            </button>
          ) : null}
          {row.status === 'rejected' ? (
            <Link
              href="/volunteer/opportunities"
              className="inline-flex h-10 items-center rounded-md bg-surface-muted px-4 text-label-md font-medium text-ink hover:bg-border-muted"
            >
              {t('applications.browseSimilar')}
            </Link>
          ) : null}
          {href ? (
            <Link
              data-testid={`opp-${id}`}
              href={href}
              className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-label-md font-medium text-ink hover:bg-surface-muted"
            >
              {row.status === 'accepted'
                ? t('applications.opportunityDetails')
                : t('applications.viewOpportunity')}
            </Link>
          ) : null}
          {row.status === 'accepted' ? (
            <Link
              data-testid={`task-${id}`}
              href="/volunteer/tasks"
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-label-md font-medium text-on-primary hover:bg-primary-hover"
            >
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>{t('applications.viewTask')}</span>
            </Link>
          ) : null}
        </div>
      </div>

      {row.status === 'withdrawn' ? (
        <p className="mt-3 text-label-xs text-ink-muted">
          {t('applications.archiveLabel')}
          {': '}
          <span className="font-mono font-semibold">{shortApplicationId(id)}</span>
        </p>
      ) : null}

      {expanded ? (
        <div className="mt-3">
          <ApplicationDetail applicationId={id} locale={locale} onWithdrawn={onWithdrawn} />
        </div>
      ) : null}
    </li>
  );
}

export function VolunteerApplicationsPage({ locale }: { locale: string }) {
  const t = useTranslations('volunteerTasks');
  const [tab, setTab] = useState<TabValue>('pending');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<ApplicationRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);

  const listQuery = useMyApplicationsQuery({
    status: tab === 'all' ? undefined : tab,
    from: from || undefined,
    to: to || undefined,
    cursor,
  });

  // Per-status totals feed the tab badges and the overview rail. Each
  // reads the real list endpoint with limit=1 (only `total` is used),
  // exactly like the sidebar badges.
  const allCountQuery = useMyApplicationsQuery({ limit: 1 });
  const pendingCountQuery = useMyApplicationsQuery({ status: 'pending', limit: 1 });
  const reviewCountQuery = useMyApplicationsQuery({ status: 'under_review', limit: 1 });
  const acceptedSummaryQuery = useMyApplicationsQuery({ status: 'accepted', limit: 3 });
  const rejectedCountQuery = useMyApplicationsQuery({ status: 'rejected', limit: 1 });
  const withdrawnCountQuery = useMyApplicationsQuery({ status: 'withdrawn', limit: 1 });

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
    setExpanded(null);
  }, [tab, from, to]);

  useEffect(() => {
    if (listQuery.data) {
      const pageItems = listQuery.data.items;
      if (cursor === undefined) setItems(pageItems);
      else setItems((prev) => [...prev, ...pageItems]);
    }
  }, [listQuery.data, cursor]);

  const tabs = [
    { value: 'all' as const, label: t('tabs.all'), Icon: LayoutGrid },
    { value: 'pending' as const, label: t('tabs.pending'), Icon: Clock },
    { value: 'under_review' as const, label: t('tabs.under_review'), Icon: Hourglass },
    { value: 'accepted' as const, label: t('tabs.accepted'), Icon: CheckCircle2 },
    { value: 'rejected' as const, label: t('applications.notSelected'), Icon: XCircle },
    { value: 'withdrawn' as const, label: t('tabs.withdrawn'), Icon: Ban },
  ];
  const statusLabels: Record<string, string> = Object.fromEntries(
    tabs.map((tabEntry) => [tabEntry.value, tabEntry.label]),
  );

  const counts: Record<string, number | undefined> = {
    all: allCountQuery.data?.total,
    pending: pendingCountQuery.data?.total,
    under_review: reviewCountQuery.data?.total,
    accepted: acceptedSummaryQuery.data?.total,
    rejected: rejectedCountQuery.data?.total,
    withdrawn: withdrawnCountQuery.data?.total,
  };

  // The list endpoint has no text-search param, so the design's search
  // box filters the loaded page client-side without touching the
  // server-side status/date behavior.
  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query === '') return items;
    return items.filter((row) =>
      [
        joinName(row.opportunity, locale),
        joinName(row.organization, locale),
        joinName(row.position, locale),
        row.message ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [items, search, locale]);

  const upcoming = acceptedSummaryQuery.data?.items ?? [];

  return (
    <RequireTasks locale={locale} next={`/volunteer/applications`}>
      <div data-testid="volunteer-applications" className="min-w-0">
        {/* Three independent scroll columns on desktop: the grid is capped
            to the viewport below the navbar (same 7rem offset as the
            sidebar), and the center + right columns scroll internally with
            visually hidden scrollbars. Below xl the layout collapses to a
            single column and the document scrolls normally. */}
        <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:h-[calc(100dvh-7rem)] xl:grid-cols-3 xl:grid-rows-[minmax(0,1fr)] xl:items-stretch xl:overflow-hidden">
          <ScrollFade
            className="min-w-0 xl:col-span-2 xl:min-h-0"
            viewportClassName="flex flex-col gap-6 xl:overflow-y-auto"
            tone="background"
          >
            <section className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
              <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <h1 className="break-words text-headline-lg text-ink">
                    {t('applications.title')}
                  </h1>
                  <p className="mt-1 text-body-md text-ink-muted">{t('applications.subtitle')}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md bg-surface-muted px-3 py-1.5 text-label-xs font-medium text-ink-muted md:self-auto">
                  <ShieldCheck size={16} aria-hidden="true" className="shrink-0 text-gold-strong" />
                  <span>{t('applications.identityBadge')}</span>
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="relative min-w-0 flex-1">
                  <Search
                    size={18}
                    aria-hidden="true"
                    className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
                  />
                  <label htmlFor="app-search" className="sr-only">
                    {t('applications.searchLabel')}
                  </label>
                  <input
                    id="app-search"
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('applications.searchPlaceholder')}
                    className="h-10 w-full rounded-md border border-border bg-surface-muted pe-3 ps-9 text-body-md text-ink placeholder:text-ink-muted focus:border-gold-strong focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-40">
                    <Input
                      id="applications-from"
                      data-testid="date-from"
                      type="date"
                      label={t('applications.fromLabel')}
                      value={from}
                      onChange={(event) => setFrom(event.target.value)}
                    />
                  </div>
                  <div className="w-40">
                    <Input
                      id="applications-to"
                      data-testid="date-to"
                      type="date"
                      label={t('applications.toLabel')}
                      value={to}
                      onChange={(event) => setTo(event.target.value)}
                    />
                  </div>
                  {from || to ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      data-testid="clear-dates"
                      onClick={() => {
                        setFrom('');
                        setTo('');
                      }}
                    >
                      {t('applications.clearDates')}
                    </Button>
                  ) : (
                    <span className="inline-flex h-10 items-center rounded-md bg-surface-muted px-3 text-label-md font-medium text-ink-muted">
                      {t('applications.allDates')}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={t('applications.refreshLabel')}
                    title={t('applications.refreshLabel')}
                    onClick={() => {
                      void listQuery.refetch();
                    }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-surface-muted text-ink-muted transition-colors hover:bg-border-muted hover:text-ink"
                  >
                    <RefreshCw size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <ApplicationFilterTabs
                  tabs={tabs}
                  active={tab}
                  counts={counts}
                  onTab={(value) => {
                    setNotice(false);
                    setTab(value);
                  }}
                />
              </div>
            </section>

            {notice ? (
              <p
                data-testid="withdraw-success"
                role="status"
                className="text-sm text-status-success"
              >
                {t('applications.withdrawn')}
              </p>
            ) : null}

            {listQuery.isPending && items.length === 0 ? (
              <Loader label={t('shared.loading')} />
            ) : null}
            {listQuery.isError ? (
              <SectionError testId="applications-error" message={t('shared.loadError')} />
            ) : null}
            {listQuery.data ? (
              <p data-testid="applications-count" className="text-sm text-ink-muted">
                {t('applications.count', { total: listQuery.data.total })}
              </p>
            ) : null}
            {listQuery.data && visibleItems.length === 0 ? (
              <Empty title={t('applications.empty')} pattern />
            ) : null}
            <ul className="flex min-w-0 flex-col gap-4">
              {visibleItems.map((row) => {
                const id = rowId(row);
                return (
                  <ApplicationCard
                    key={id}
                    row={row}
                    locale={locale}
                    statusLabel={statusLabels[row.status] ?? row.status}
                    expanded={expanded === id}
                    onToggle={() => setExpanded(expanded === id ? null : id)}
                    onWithdrawn={() => {
                      setNotice(true);
                      setTab('withdrawn');
                    }}
                  />
                );
              })}
            </ul>
            {listQuery.isPending && items.length > 0 ? (
              <Loader label={t('shared.loading')} />
            ) : null}
            {listQuery.data?.nextCursor ? (
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  data-testid="load-more"
                  onClick={() => setCursor(listQuery.data?.nextCursor ?? undefined)}
                >
                  {t('shared.loadMore')}
                </Button>
              </div>
            ) : null}
          </ScrollFade>

          <ScrollFade
            as="aside"
            className="min-w-0 xl:min-h-0"
            viewportClassName="flex flex-col gap-4 xl:overflow-y-auto"
            tone="background"
          >
            <section
              aria-labelledby="applications-overview-title"
              className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border-muted pb-3">
                <h2
                  id="applications-overview-title"
                  className="inline-flex items-center gap-2 text-title-md font-semibold text-ink"
                >
                  <ClipboardList size={18} aria-hidden="true" className="shrink-0 text-gold-strong" />
                  <span>{t('applications.overviewTitle')}</span>
                </h2>
                <span className="text-headline-md font-semibold text-gold-strong">
                  {allCountQuery.data ? allCountQuery.data.total : '—'}
                </span>
              </div>
              <ul className="divide-y divide-border-muted">
                <li className="flex items-center justify-between gap-2 py-2.5 text-body-md">
                  <span className="inline-flex min-w-0 items-center gap-2 text-ink">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full bg-status-pending"
                    />
                    <span className="truncate">{t('applications.overviewPending')}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-ink">
                    {pendingCountQuery.data ? pendingCountQuery.data.total : '—'}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2 py-2.5 text-body-md">
                  <span className="inline-flex min-w-0 items-center gap-2 text-ink">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full bg-status-pending"
                    />
                    <span className="truncate">{t('applications.overviewUnderReview')}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-ink">
                    {reviewCountQuery.data ? reviewCountQuery.data.total : '—'}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2 py-2.5 text-body-md">
                  <span className="inline-flex min-w-0 items-center gap-2 text-ink">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full bg-status-success"
                    />
                    <span className="truncate">{t('applications.overviewAccepted')}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-status-success">
                    {acceptedSummaryQuery.data ? acceptedSummaryQuery.data.total : '—'}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2 py-2.5 text-body-md">
                  <span className="inline-flex min-w-0 items-center gap-2 text-ink">
                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-border" />
                    <span className="truncate">{t('applications.overviewNotSelected')}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-ink-muted">
                    {rejectedCountQuery.data ? rejectedCountQuery.data.total : '—'}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2 py-2.5 text-body-md">
                  <span className="inline-flex min-w-0 items-center gap-2 text-ink">
                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-border" />
                    <span className="truncate">{t('applications.overviewWithdrawn')}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-ink-muted">
                    {withdrawnCountQuery.data ? withdrawnCountQuery.data.total : '—'}
                  </span>
                </li>
              </ul>
            </section>

            <section
              aria-labelledby="applications-upcoming-title"
              className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="border-b border-border-muted pb-3">
                <h2
                  id="applications-upcoming-title"
                  className="inline-flex items-center gap-2 text-title-md font-semibold text-ink"
                >
                  <CheckCircle2
                    size={18}
                    aria-hidden="true"
                    className="shrink-0 text-status-success"
                  />
                  <span>{t('applications.upcomingTitle')}</span>
                </h2>
                <p className="mt-1 text-label-md text-ink-muted">
                  {t('applications.upcomingSubtitle')}
                </p>
              </div>
              {acceptedSummaryQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
              {acceptedSummaryQuery.isError ? (
                <div className="pt-3">
                  <SectionError testId="upcoming-error" message={t('shared.loadError')} />
                </div>
              ) : null}
              {acceptedSummaryQuery.data && upcoming.length === 0 ? (
                <p className="pt-3 text-body-md text-ink-muted">
                  {t('applications.upcomingEmpty')}
                </p>
              ) : null}
              {upcoming.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-3">
                  {upcoming.map((row) => (
                    <li
                      key={rowId(row)}
                      className="flex min-w-0 flex-col gap-1 rounded-lg bg-surface-muted p-3"
                    >
                      <span className="truncate text-title-sm font-semibold text-ink">
                        {joinName(row.opportunity, locale)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-label-md text-ink-muted">
                        <CalendarDays size={14} aria-hidden="true" className="shrink-0" />
                        <span className="truncate">
                          {t('applications.appliedLabel')}
                          {': '}
                          {formatDate(row.createdAt, locale)}
                        </span>
                      </span>
                      <Link
                        href="/volunteer/tasks"
                        className="mt-1 inline-flex items-center justify-between gap-2 border-t border-border-muted pt-2 text-label-md font-semibold text-gold-strong hover:text-ink"
                      >
                        <span>{t('applications.goToTasks')}</span>
                        <ArrowRight
                          size={16}
                          aria-hidden="true"
                          className="shrink-0 rtl:rotate-180"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section
              aria-labelledby="applications-privacy-title"
              className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <h2
                id="applications-privacy-title"
                className="inline-flex items-center gap-2 text-title-sm font-semibold text-ink"
              >
                <ShieldCheck size={18} aria-hidden="true" className="shrink-0 text-gold-strong" />
                <span>{t('applications.privacyTitle')}</span>
              </h2>
              <p className="mt-2 text-body-md leading-relaxed text-ink-muted">
                {t('applications.privacyBody')}
              </p>
            </section>

            <ActivityStrip locale={locale} />
          </ScrollFade>
        </div>
      </div>
    </RequireTasks>
  );
}
