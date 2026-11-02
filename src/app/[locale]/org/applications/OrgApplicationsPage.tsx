'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, ChevronDown, ChevronsUpDown, CircleCheck, Search } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { mapToApiError } from '@/lib/api/errors';
import { rowId, type InboxApplication } from '@/lib/api/orgInbox';
import { opportunityIdOf } from '@/lib/api/orgOpps';
import { useOrgApplicationsQuery } from '@/hooks/useOrgInbox';
import { useOwnOpportunitiesQuery } from '@/hooks/useOrgOpps';
import { ApplicationDetailCard } from './ApplicationDetail';
import {
  ApplicantAvatar,
  ApplicationStatusLine,
  MasterDetail,
  RequireOrg,
  SectionError,
  inboxApplicantName,
  inboxAvatarMediaId,
  joinName,
} from './components';

// Org applications review: header + underline tabs (All/New/Under
// review/Accepted/Rejected) + search/opportunity/sort controls, then the
// master-detail split (applicant queue | selected applicant detail). No
// fabricated copy: counts/avatars/positions/dates/statuses are real inbox
// rows; the opportunity filter lists real owned opportunities; sort uses the
// backend sort whitelist (newest/oldest only — no invented "opportunity"
// sort). Mobile stacks the panes: selecting a card reveals the detail with a
// back affordance instead of side-by-side panes.
type QueueTab = 'all' | 'pending' | 'under_review' | 'accepted' | 'rejected';

const QUEUE_TABS: QueueTab[] = ['all', 'pending', 'under_review', 'accepted', 'rejected'];

export function OrgApplicationsPage({ locale }: { locale: string }) {
  const t = useTranslations('orgReview');
  const [tab, setTab] = useState<QueueTab>('all');
  const [q, setQ] = useState('');
  const [opportunityId, setOpportunityId] = useState('');
  const [sort, setSort] = useState('newest');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<InboxApplication[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const listQuery = useOrgApplicationsQuery({
    opportunityId: opportunityId || undefined,
    status: tab === 'all' ? undefined : tab,
    q: q || undefined,
    sort,
    cursor,
  });
  const oppsQuery = useOwnOpportunitiesQuery({ limit: 50 });

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
    setSelected(null);
  }, [tab, q, opportunityId, sort]);

  useEffect(() => {
    if (listQuery.data) {
      const pageItems = listQuery.data.items as InboxApplication[];
      if (cursor === undefined) setItems(pageItems);
      else setItems((prev) => [...prev, ...pageItems]);
    }
  }, [listQuery.data, cursor]);

  // Auto-select the first row exactly once per filter set. A user-initiated
  // deselect (mobile back button) must stick: reselecting on every null
  // would make "back to list" a no-op. Decided rows that leave the tab keep
  // their selection (fresh detail data renders the new status).
  const filterKey = `${tab}|${q}|${opportunityId}|${sort}`;
  const autoSelectedFor = useRef<string | null>(null);
  useEffect(() => {
    if (items.length > 0 && autoSelectedFor.current !== filterKey) {
      autoSelectedFor.current = filterKey;
      setSelected((prev) => (prev === null ? rowId(items[0]) : prev));
    }
  }, [items, filterKey]);

  const selectedIndex = selected === null ? -1 : items.findIndex((row) => rowId(row) === selected);
  const detached = selected !== null && selectedIndex === -1;
  const total = listQuery.data?.total ?? items.length;
  const forbidden =
    listQuery.isError && mapToApiError(listQuery.error).statusCode === 403;

  return (
    <RequireOrg locale={locale} next={`/org/applications`}>
      <div data-testid="org-applications" className="flex min-w-0 flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {t('applications.title')}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">{t('applications.subtitle')}</p>
          </div>
          <Link
            href="/org/opportunities"
            className="mt-1 inline-flex shrink-0 items-center gap-1 text-sm font-medium text-gold-strong transition-colors hover:underline"
          >
            <span>{t('applications.viewOpportunities')}</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        {/* Underline tabs (text only, no invented counts) */}
        <div
          data-testid="application-tabs"
          role="tablist"
          aria-label={t('applications.title')}
          className="flex items-center gap-6 overflow-x-auto border-b border-border-muted"
        >
          {QUEUE_TABS.map((value) => {
            const active = tab === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`tab-${value}`}
                onClick={() => setTab(value)}
                className={`shrink-0 pb-2.5 text-sm transition-colors ${
                  active
                    ? 'border-b-2 border-gold-strong font-semibold text-gold-strong'
                    : 'font-medium text-ink-muted hover:text-ink'
                }`}
              >
                {value === 'all'
                  ? t('applications.allTab')
                  : value === 'pending'
                    ? t('applications.newLabel')
                    : t(`tabs.${value}`)}
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-6">
            <Search
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              id="applications-q"
              type="search"
              data-testid="applications-search"
              aria-label={t('shared.searchLabel')}
              placeholder={t('applications.searchPlaceholder')}
              value={q}
              onChange={(event) => setQ(event.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-surface py-2 pe-3 ps-9 text-sm text-ink placeholder:text-ink-muted focus:border-gold-strong focus:outline-none"
            />
          </div>
          <div className="relative md:col-span-4">
            <select
              id="applications-opportunity"
              data-testid="applications-opportunity"
              aria-label={t('shared.opportunityLabel')}
              value={opportunityId}
              onChange={(event) => setOpportunityId(event.target.value)}
              className="h-10 w-full appearance-none rounded-lg border border-border bg-surface px-3 pe-8 text-sm text-ink focus:border-gold-strong focus:outline-none"
            >
              <option value="">{t('shared.allOpportunities')}</option>
              {(oppsQuery.data?.items ?? []).map((opp) => {
                const id = opportunityIdOf(opp);
                return (
                  <option key={id} value={id}>
                    {opp.title}
                  </option>
                );
              })}
            </select>
            <ChevronsUpDown
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
            />
          </div>
          <div className="relative md:col-span-2">
            <select
              id="applications-sort"
              data-testid="applications-sort"
              aria-label={t('contributions.sortLabel')}
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="h-10 w-full appearance-none rounded-lg border border-border bg-surface px-3 pe-8 text-sm text-ink focus:border-gold-strong focus:outline-none"
            >
              <option value="newest">{t('applications.sortNewest')}</option>
              <option value="oldest">{t('applications.sortOldest')}</option>
            </select>
            <ChevronDown
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
            />
          </div>
        </div>

        {/* Master-detail split */}
        {listQuery.isPending ? (
          <Loader label={t('shared.loading')} />
        ) : forbidden ? (
          <SectionError testId="applications-forbidden" message={t('shared.loadError')} />
        ) : listQuery.isError ? (
          <SectionError testId="applications-error" message={t('shared.loadError')} />
        ) : items.length === 0 && !detached ? (
          <Empty title={t('shared.empty')} />
        ) : (
          <MasterDetail
            listLabel={t('applications.queueTitle')}
            detailLabel={t('applications.detailTitle')}
            hasSelection={selected !== null}
            onBack={() => setSelected(null)}
            backLabel={t('applications.backToQueue')}
            listClassName="overflow-hidden rounded-xl border border-border-muted bg-surface shadow-sm"
            detailClassName={
              selected !== null
                ? 'overflow-hidden rounded-xl border border-border-muted bg-surface shadow-sm'
                : ''
            }
            list={
              <>
                <div className="flex items-center justify-between gap-2 border-b border-border-muted bg-surface-muted px-4 py-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink">
                    {t('applications.queueTitle')}
                  </span>
                  <span data-testid="applications-count" className="text-sm text-ink-muted">
                    {t('applications.queueTotal', { total })}
                  </span>
                </div>
                <ul className="flex flex-col divide-y divide-border-muted">
                  {items.map((row) => (
                    <QueueCard
                      key={rowId(row)}
                      locale={locale}
                      row={row}
                      active={rowId(row) === selected}
                      onSelect={() => setSelected(rowId(row))}
                    />
                  ))}
                </ul>
                {listQuery.data?.nextCursor ? (
                  <div className="border-t border-border-muted p-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={listQuery.isFetching}
                      onClick={() => setCursor(listQuery.data?.nextCursor ?? undefined)}
                      data-testid="applications-more"
                    >
                      {t('shared.next')}
                    </Button>
                  </div>
                ) : null}
              </>
            }
            detail={
              selected !== null ? (
                <ApplicationDetailCard
                  locale={locale}
                  applicationId={selected}
                  index={selectedIndex >= 0 ? selectedIndex : undefined}
                  total={selectedIndex >= 0 ? total : undefined}
                  testIdPrefix="application-detail"
                />
              ) : null
            }
          />
        )}
      </div>
    </RequireOrg>
  );
}

function QueueCard({
  locale,
  row,
  active,
  onSelect,
}: {
  locale: string;
  row: InboxApplication;
  active: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations('orgReview');
  const activeLocale = useLocale();
  const id = rowId(row);
  const applicantJoin = row.applicant ?? row.volunteer;
  const name = inboxApplicantName(applicantJoin, locale);
  const positionTitle = (row.position as { title?: unknown } | null)?.title;
  const positionName =
    typeof positionTitle === 'string' && positionTitle !== '' ? positionTitle : null;
  const opportunityName = joinName(row.opportunity, locale);
  const createdAt = typeof row.createdAt === 'string' ? new Date(row.createdAt) : null;
  const appliedDate =
    createdAt !== null && !Number.isNaN(createdAt.getTime())
      ? createdAt.toLocaleDateString(activeLocale, { dateStyle: 'medium' })
      : null;
  const excerpt =
    typeof row.message === 'string' && row.message.trim() !== '' ? row.message : null;

  return (
    <li data-testid="application-row">
      <article
        className={`p-4 transition-colors ${
          active ? 'border-s-2 border-gold-strong bg-gold-soft' : 'hover:bg-surface-muted'
        }`}
      >
        <div className="flex items-start gap-3">
          <ApplicantAvatar
            mediaId={inboxAvatarMediaId(applicantJoin)}
            name={name}
            size={48}
            testId={`application-avatar-${id}`}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <button
              type="button"
              data-testid={`application-expand-${id}`}
              aria-expanded={active}
              onClick={onSelect}
              className="flex min-w-0 items-baseline justify-between gap-2 text-start"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{name}</span>
              <QueueStatus status={row.status} />
            </button>
            {positionName ? (
              <span className="truncate text-sm font-medium text-ink">{positionName}</span>
            ) : null}
            <span className="truncate text-sm text-ink-muted">{opportunityName}</span>
            {appliedDate ? (
              <span className="mt-1 text-xs text-ink-muted">
                {t('applications.appliedOn', { date: appliedDate })}
              </span>
            ) : null}
            {row.status === 'accepted' ? (
              <p className="mt-1.5 text-sm text-ink">
                <span className="inline-flex items-center gap-1 font-medium">
                  <CircleCheck size={14} aria-hidden="true" className="text-status-success" />
                  {t('applications.participantAdded')}
                </span>
                <span aria-hidden="true" className="text-ink-muted">
                  {' '}
                  ·{' '}
                </span>
                <Link
                  href="/org/participants"
                  className="font-medium text-gold-strong hover:underline"
                >
                  {t('applications.viewParticipants')} →
                </Link>
              </p>
            ) : excerpt ? (
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">
                “{excerpt}”
              </p>
            ) : null}
            {active ? (
              <span className="mt-2.5 flex items-center justify-end gap-0.5 text-sm font-medium text-gold-strong">
                <Link
                  href={`/org/applications/${encodeURIComponent(id)}`}
                  className="inline-flex items-center gap-0.5 hover:underline"
                >
                  <span>{t('applications.viewApplication')}</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </span>
            ) : null}
          </div>
        </div>
      </article>
    </li>
  );
}

function QueueStatus({ status }: { status: string }) {
  const t = useTranslations('orgReview');
  const label =
    status === 'pending'
      ? t('applications.newLabel')
      : (['under_review', 'accepted', 'rejected', 'withdrawn'] as const).includes(
            status as 'under_review' | 'accepted' | 'rejected' | 'withdrawn',
          )
        ? t(`tabs.${status as 'under_review' | 'accepted' | 'rejected' | 'withdrawn'}`)
        : status;
  return <ApplicationStatusLine status={status} label={label} />;
}
