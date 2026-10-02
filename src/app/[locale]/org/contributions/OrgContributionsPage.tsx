'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowRight,
  ArrowUpDown,
  BadgeCheck,
  Briefcase,
  ChevronDown,
  Clock,
  FileStack,
  FileType,
  Search,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { mapToApiError } from '@/lib/api/errors';
import {
  SUBMISSION_FORMATS,
  SUBMISSION_INBOX_SORTS,
  rowId,
  type InboxSubmission,
  type SubmissionFormat,
  type SubmissionInboxSort,
} from '@/lib/api/orgInbox';
import { opportunityIdOf } from '@/lib/api/orgOpps';
import type { OrgExperienceRow } from '@/lib/api/orgRecords';
import { useOrgExperiencesQuery } from '@/hooks/useOrgRecords';
import { useOrgSubmissionsQuery } from '@/hooks/useOrgInbox';
import { useOwnOpportunitiesQuery } from '@/hooks/useOrgOpps';
import { useMyOrganizationQuery } from '@/hooks/useOrgStats';
import { SubmissionDetail, statusLabelOf } from './SubmissionDetail';
import {
  ApplicantAvatar,
  MasterDetail,
  RequireOrg,
  SectionError,
  StatusPill,
  inboxApplicantName,
  inboxAvatarMediaId,
} from '../applications/components';

// Contributions verification inbox rebuilt from
// `design/Basmatak Tatatoua - Contributions/` (code.html + screen.png):
// workspace header + stat chips (real totals only), underline tabs with real
// counts (All / To review / Submitted / Under review / Approved / Changes
// requested / Verified), search + opportunity + format + sort controls, then
// the shared MasterDetail split (submissions queue | selected submission
// detail) with independent pane scroll and mobile list→detail navigation.
// The Verified tab reads GET /organizations/me/experiences (submissions have
// no `verified` status server-side); every other tab reads the submissions
// inbox. Sort uses the backend whitelist (newest/oldest); invented sorts
// ("name A-Z", "deliverable size") are dropped. No flag action, no bulk
// archive download, no compliance copy anywhere.

type ContributionsTab =
  | 'all'
  | 'to-review'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'verified';

const SUBMISSION_TABS: Exclude<ContributionsTab, 'verified'>[] = [
  'all',
  'to-review',
  'submitted',
  'under_review',
  'approved',
  'rejected',
];

const ALL_TABS: ContributionsTab[] = [...SUBMISSION_TABS, 'verified'];

function tabStatusParam(tab: ContributionsTab): string[] | undefined {
  switch (tab) {
    case 'all':
    case 'verified':
      return undefined;
    case 'to-review':
      return ['submitted', 'under_review'];
    default:
      return [tab];
  }
}

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function formatDate(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(time));
}

// EXP- display code (idempotent single prefix).
function expCodeOf(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const bare = raw.trim().startsWith('EXP-') ? raw.trim().slice(4) : raw.trim();
  return bare.length > 0 ? `EXP-${bare}` : null;
}

export function OrgContributionsPage({ locale }: { locale: string }) {
  const t = useTranslations('orgReview');
  const activeLocale = useLocale();
  const [tab, setTab] = useState<ContributionsTab>('to-review');
  const [q, setQ] = useState('');
  const [opportunityId, setOpportunityId] = useState('');
  const [format, setFormat] = useState<'' | SubmissionFormat>('');
  const [sort, setSort] = useState<SubmissionInboxSort>('newest');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<InboxSubmission[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [verifiedItems, setVerifiedItems] = useState<OrgExperienceRow[]>([]);
  const [verifiedCursor, setVerifiedCursor] = useState<string | undefined>(undefined);
  const verifiedCache = useRef(new Map<string, OrgExperienceRow>());

  const isVerifiedTab = tab === 'verified';
  const statusParam = tabStatusParam(tab);

  const listQuery = useOrgSubmissionsQuery({
    status: isVerifiedTab ? undefined : statusParam,
    opportunityId: opportunityId || undefined,
    q: q || undefined,
    format: !isVerifiedTab && format ? format : undefined,
    sort,
    cursor,
  });
  const verifiedQuery = useOrgExperiencesQuery({
    q: q || undefined,
    opportunityId: opportunityId || undefined,
    sort,
    cursor: verifiedCursor,
  });
  const oppsQuery = useOwnOpportunitiesQuery({ limit: 50 });
  const orgQuery = useMyOrganizationQuery();

  // Per-tab real totals (limit-1 reads; CursorPage.total is authoritative).
  const allTotal = useOrgSubmissionsQuery({ limit: 1 });
  const toReviewTotal = useOrgSubmissionsQuery({ status: ['submitted', 'under_review'], limit: 1 });
  const submittedTotal = useOrgSubmissionsQuery({ status: 'submitted', limit: 1 });
  const underReviewTotal = useOrgSubmissionsQuery({ status: 'under_review', limit: 1 });
  const approvedTotal = useOrgSubmissionsQuery({ status: 'approved', limit: 1 });
  const rejectedTotal = useOrgSubmissionsQuery({ status: 'rejected', limit: 1 });
  const verifiedTotal = useOrgExperiencesQuery({ limit: 1 });

  const totals: Record<ContributionsTab, number | undefined> = {
    all: allTotal.data?.total,
    'to-review': toReviewTotal.data?.total,
    submitted: submittedTotal.data?.total,
    under_review: underReviewTotal.data?.total,
    approved: approvedTotal.data?.total,
    rejected: rejectedTotal.data?.total,
    verified: verifiedTotal.data?.total,
  };

  useEffect(() => {
    setCursor(undefined);
    setVerifiedCursor(undefined);
    setItems([]);
    setVerifiedItems([]);
    setSelected(null);
  }, [tab, q, opportunityId, format, sort]);

  useEffect(() => {
    if (!isVerifiedTab && listQuery.data) {
      const pageItems = listQuery.data.items as InboxSubmission[];
      if (cursor === undefined) setItems(pageItems);
      else setItems((prev) => [...prev, ...pageItems]);
    }
  }, [listQuery.data, cursor, isVerifiedTab]);

  useEffect(() => {
    if (isVerifiedTab && verifiedQuery.data) {
      const pageItems = verifiedQuery.data.items;
      for (const row of pageItems) {
        const id = verifiedRowId(row);
        if (id) verifiedCache.current.set(id, row);
      }
      if (verifiedCursor === undefined) setVerifiedItems(pageItems);
      else setVerifiedItems((prev) => [...prev, ...pageItems]);
    }
  }, [verifiedQuery.data, verifiedCursor, isVerifiedTab]);

  // Auto-select the first row exactly once per filter set. Two guards:
  // (a) a user-initiated deselect via the mobile back control must stick
  // instead of reselecting on every null (same guard the org Applications
  // screen uses); (b) the selection must come from the CURRENT filter's data
  // — while the new tab's query is still pending, `items` still holds the
  // previous tab's rows and selecting from them would pin a stale detached
  // detail (the list query key already changed, so isPending is the signal).
  // Decided rows that leave the tab keep their selection (fresh detail data
  // renders the new status) because the filterKey is unchanged for them.
  const filterKey = `${tab}|${q}|${opportunityId}|${format}|${sort}`;
  const autoSelectedFor = useRef<string | null>(null);
  const firstId = isVerifiedTab
    ? (verifiedItems.length > 0 ? verifiedRowId(verifiedItems[0]) : null)
    : (items.length > 0 ? rowId(items[0]) : null);
  const listSettled = isVerifiedTab ? !verifiedQuery.isPending : !listQuery.isPending;
  useEffect(() => {
    if (firstId && listSettled && autoSelectedFor.current !== filterKey) {
      autoSelectedFor.current = filterKey;
      setSelected(firstId);
    }
  }, [firstId, filterKey, listSettled]);

  const opportunityLookup = useMemo(() => {
    const map = new Map<string, { title: string; positions: { id: string; title: string }[] }>();
    for (const opp of oppsQuery.data?.items ?? []) {
      const id = opportunityIdOf(opp);
      if (!id) continue;
      map.set(id, {
        title: opp.title,
        positions: (opp.positions ?? []).map((position) => ({
          id: position.id ?? position._id ?? '',
          title: position.title ?? '',
        })),
      });
    }
    return map;
  }, [oppsQuery.data]);

  const orgName = useMemo(() => {
    const org = orgQuery.data;
    if (!org) return '';
    return locale === 'ar' ? (org.nameAr ?? org.nameFr ?? '') : (org.nameFr ?? org.nameAr ?? '');
  }, [orgQuery.data, locale]);

  const tabLabel = (value: ContributionsTab): string => {
    switch (value) {
      case 'all':
        return t('tabs.all');
      case 'to-review':
        return t('contributions.toReviewLabel');
      case 'submitted':
        return t('tabs.submitted');
      case 'under_review':
        return t('tabs.under_review');
      case 'approved':
        return t('tabs.approved');
      case 'rejected':
        return t('contributions.changesRequested');
      case 'verified':
        return t('tabs.verified');
    }
  };

  const activeQuery = isVerifiedTab ? verifiedQuery : listQuery;
  const forbidden = activeQuery.isError && mapToApiError(activeQuery.error).statusCode === 403;
  const activeTotal = isVerifiedTab ? (verifiedQuery.data?.total ?? verifiedItems.length) : (listQuery.data?.total ?? items.length);
  const selectedVerified = selected !== null ? (verifiedItems.find((row) => verifiedRowId(row) === selected) ?? verifiedCache.current.get(selected)) : undefined;
  const hasSelection = isVerifiedTab ? selectedVerified !== undefined : selected !== null;
  // A decided row leaves the current filter (server-side), which would
  // unmount its own detail panel mid-flow. The panel below persists outside
  // the list (fresh data via the detail endpoint) so the new status renders.
  const detachedSubmission = !isVerifiedTab && selected !== null && !items.some((row) => rowId(row) === selected);

  return (
    <RequireOrg locale={locale} next={`/org/contributions`}>
      <Container testId="org-contributions-container" className="flex min-w-0 flex-col gap-6 py-4">
        <div data-testid="org-contributions" className="flex min-w-0 flex-col gap-4">
          {/* Header */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              {t('participants.workspace')}
              {orgName ? ` · ${orgName}` : ''}
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-ink">{t('contributions.title')}</h1>
            <p className="max-w-2xl text-sm text-ink-muted">{t('contributions.subtitle')}</p>
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pt-1 text-sm text-ink-muted">
              <FileStack size={16} aria-hidden="true" className="text-primary" />
              <span data-testid="contributions-stats">
                <span>{t('contributions.statAwaiting', { count: totals['to-review'] ?? '…' })}</span>
                <span aria-hidden="true"> · </span>
                <span>{t('contributions.statApproved', { count: totals.approved ?? '…' })}</span>
                <span aria-hidden="true"> · </span>
                <span>{t('contributions.statVerified', { count: totals.verified ?? '…' })}</span>
              </span>
            </p>
          </div>

          {/* Underline tabs with real counts */}
          <div
            data-testid="contribution-tabs"
            role="tablist"
            aria-label={t('contributions.title')}
            className="flex items-center gap-6 overflow-x-auto border-b border-border-muted"
          >
            {ALL_TABS.map((value) => {
              const active = tab === value;
              const count = totals[value];
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
                      ? 'border-b-2 border-primary font-semibold text-primary'
                      : 'font-medium text-ink-muted hover:text-ink'
                  }`}
                >
                  {tabLabel(value)}
                  {count !== undefined ? ` (${count})` : ''}
                </button>
              );
            })}
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="relative md:col-span-5">
              <Search
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                id="contributions-q"
                type="search"
                data-testid="contributions-search"
                aria-label={t('shared.searchLabel')}
                placeholder={t('shared.searchPlaceholder')}
                value={q}
                onChange={(event) => setQ(event.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface py-2 pe-3 ps-9 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
              />
            </div>
            <div className="relative md:col-span-3">
              <Briefcase
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <select
                id="contributions-opportunity"
                data-testid="contributions-opportunity"
                aria-label={t('shared.opportunityLabel')}
                value={opportunityId}
                onChange={(event) => setOpportunityId(event.target.value)}
                className="h-10 w-full appearance-none rounded-lg border border-border bg-surface py-2 pe-8 ps-9 text-sm text-ink focus:border-primary focus:outline-none"
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
              <ChevronDown
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
              />
            </div>
            {!isVerifiedTab ? (
              <div className="relative md:col-span-2">
                <FileType
                  size={18}
                  aria-hidden="true"
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
                />
                <select
                  id="contributions-format"
                  data-testid="contributions-format"
                  aria-label={t('contributions.formatLabel')}
                  value={format}
                  onChange={(event) => setFormat(event.target.value as '' | SubmissionFormat)}
                  className="h-10 w-full appearance-none rounded-lg border border-border bg-surface py-2 pe-8 ps-9 text-sm text-ink focus:border-primary focus:outline-none"
                >
                  <option value="">{t('contributions.allFormats')}</option>
                  {SUBMISSION_FORMATS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={18}
                  aria-hidden="true"
                  className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
                />
              </div>
            ) : null}
            <div className={`relative ${isVerifiedTab ? 'md:col-span-4' : 'md:col-span-2'}`}>
              <ArrowUpDown
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <select
                id="contributions-sort"
                data-testid="contributions-sort"
                aria-label={t('contributions.sortLabel')}
                value={sort}
                onChange={(event) => setSort(event.target.value as SubmissionInboxSort)}
                className="h-10 w-full appearance-none rounded-lg border border-border bg-surface py-2 pe-8 ps-9 text-sm text-ink focus:border-primary focus:outline-none"
              >
                {SUBMISSION_INBOX_SORTS.map((value) => (
                  <option key={value} value={value}>
                    {value === 'newest' ? t('contributions.sortNewest') : t('contributions.sortOldest')}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
              />
            </div>
          </div>
          {q || opportunityId || format ? (
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-testid="contributions-clear"
                onClick={() => {
                  setQ('');
                  setOpportunityId('');
                  setFormat('');
                }}
              >
                {t('shared.clearFilters')}
              </Button>
            </div>
          ) : null}

          {/* Master-detail split */}
          {activeQuery.isPending ? (
            <Loader label={t('shared.loading')} />
          ) : forbidden ? (
            <SectionError testId="contributions-forbidden" message={t('shared.loadError')} />
          ) : activeQuery.isError ? (
            <SectionError testId="contributions-error" message={t('shared.loadError')} />
          ) : (
            <MasterDetail
              listLabel={t('contributions.queueTitle')}
              detailLabel={t('contributions.detailTitle')}
              hasSelection={hasSelection}
              onBack={() => setSelected(null)}
              backLabel={t('contributions.backToList')}
              listClassName="overflow-hidden rounded-xl border border-border-muted bg-surface shadow-sm"
              list={
                <>
                  <div className="flex items-center justify-between gap-2 border-b border-border-muted bg-surface-muted px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-ink">
                      {t('contributions.queueTitle')}
                    </span>
                    <span data-testid="contributions-count" className="text-sm text-ink-muted">
                      {t('contributions.queueShowing', { shown: isVerifiedTab ? verifiedItems.length : items.length, total: activeTotal })}
                    </span>
                  </div>
                  {(isVerifiedTab ? verifiedItems.length === 0 : items.length === 0) && !detachedSubmission ? (
                    <div className="p-4">
                      <Empty title={t('shared.empty')} />
                    </div>
                  ) : (
                    <ul className="flex flex-col divide-y divide-border-muted">
                      {!isVerifiedTab &&
                        items.map((row) => (
                          <QueueCard
                            key={rowId(row)}
                            locale={locale}
                            row={row}
                            opportunityLookup={opportunityLookup}
                            active={rowId(row) === selected}
                            onSelect={() => setSelected(rowId(row))}
                          />
                        ))}
                      {isVerifiedTab &&
                        verifiedItems.map((row) => {
                          const id = verifiedRowId(row) ?? '';
                          return (
                            <VerifiedQueueCard
                              key={id}
                              locale={activeLocale}
                              row={row}
                              active={id !== '' && id === selected}
                              onSelect={() => setSelected(id)}
                            />
                          );
                        })}
                    </ul>
                  )}
                  {!isVerifiedTab && listQuery.data?.nextCursor ? (
                    <div className="border-t border-border-muted p-3">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={listQuery.isFetching}
                        onClick={() => setCursor(listQuery.data?.nextCursor ?? undefined)}
                        data-testid="contributions-more"
                      >
                        {t('shared.next')}
                      </Button>
                    </div>
                  ) : null}
                  {isVerifiedTab && verifiedQuery.data?.nextCursor ? (
                    <div className="border-t border-border-muted p-3">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={verifiedQuery.isFetching}
                        onClick={() => setVerifiedCursor(verifiedQuery.data?.nextCursor ?? undefined)}
                        data-testid="verified-more"
                      >
                        {t('shared.next')}
                      </Button>
                    </div>
                  ) : null}
                </>
              }
              detail={
                !isVerifiedTab && selected !== null ? (
                  <SubmissionDetail locale={locale} submissionId={selected} testIdPrefix="submission-detail" />
                ) : isVerifiedTab && selectedVerified ? (
                  <VerifiedExperiencePanel row={selectedVerified} />
                ) : (
                  <Card>
                    <Empty title={t('contributions.detailEmpty')} />
                  </Card>
                )
              }
            />
          )}
        </div>
      </Container>
    </RequireOrg>
  );
}

function QueueCard({
  locale,
  row,
  opportunityLookup,
  active,
  onSelect,
}: {
  locale: string;
  row: InboxSubmission;
  opportunityLookup: Map<string, { title: string; positions: { id: string; title: string }[] }>;
  active: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations('orgReview');
  const activeLocale = useLocale();
  const id = rowId(row);
  const record = recordOf(row);
  const opportunityId = textOf(record.opportunityId);
  const positionId = textOf(record.positionId);
  const createdAt = textOf(record.createdAt);
  const submittedDate = formatDate(createdAt, activeLocale);
  const name = inboxApplicantName(
    (row.volunteer ?? null) as Parameters<typeof inboxApplicantName>[0],
    locale,
  );
  const entry = opportunityId ? opportunityLookup.get(opportunityId) : undefined;
  const opportunityTitle = entry?.title ?? null;
  const positionTitle = entry && positionId ? (entry.positions.find((position) => position.id === positionId)?.title || null) : null;
  const evidenceCount = Array.isArray(row.evidence) ? row.evidence.length : 0;

  return (
    <li data-testid="submission-row">
      <article
        className={`relative p-4 transition-colors ${
          active ? 'bg-primary-tint' : 'hover:bg-surface-muted'
        }`}
      >
        {active ? (
          <span aria-hidden="true" className="absolute inset-y-3 start-0 w-1 rounded-e bg-primary" />
        ) : null}
        <button
          type="button"
          data-testid={`submission-expand-${id}`}
          aria-expanded={active}
          onClick={onSelect}
          className="flex w-full min-w-0 items-start gap-3 text-start"
        >
          <ApplicantAvatar
            mediaId={inboxAvatarMediaId(row.volunteer)}
            name={name}
            size={40}
            testId={`submission-avatar-${id}`}
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-semibold text-ink">{name}</span>
              {submittedDate ? (
                <span className="shrink-0 text-xs text-ink-muted">{submittedDate}</span>
              ) : null}
            </span>
            {positionTitle ? (
              <span className="truncate text-sm text-ink-muted">{positionTitle}</span>
            ) : null}
            {row.title ? (
              <span className="mt-1 line-clamp-1 text-sm font-medium text-ink">{row.title}</span>
            ) : null}
            {opportunityTitle ? (
              <span className="truncate text-xs text-ink-muted">{opportunityTitle}</span>
            ) : null}
            <span className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border-muted pt-2">
              <SubmissionStatusLine status={row.status} />
              <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                <FileStack size={14} aria-hidden="true" />
                <span>
                  {evidenceCount === 1
                    ? t('contributions.filesOne')
                    : t('contributions.filesCount', { count: evidenceCount })}
                </span>
              </span>
            </span>
          </span>
        </button>
      </article>
    </li>
  );
}

function SubmissionStatusLine({ status }: { status: string }) {
  const t = useTranslations('orgReview');
  return <StatusPill status={status} label={statusLabelOf(status, t)} />;
}

function verifiedRowId(row: OrgExperienceRow): string | null {
  const record = recordOf(row);
  return textOf(record.id) ?? textOf(record._id);
}

function VerifiedQueueCard({
  locale,
  row,
  active,
  onSelect,
}: {
  locale: string;
  row: OrgExperienceRow;
  active: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations('orgReview');
  const record = recordOf(row);
  const id = verifiedRowId(row) ?? '';
  const code = expCodeOf(record.registryId);
  const title = textOf(record.title) ?? '—';
  const verifiedAt = textOf(record.verifiedAt);
  const verifiedLabel = formatDate(verifiedAt, locale);

  return (
    <li data-testid="verified-row">
      <article
        className={`relative p-4 transition-colors ${
          active ? 'bg-primary-tint' : 'hover:bg-surface-muted'
        }`}
      >
        {active ? (
          <span aria-hidden="true" className="absolute inset-y-3 start-0 w-1 rounded-e bg-primary" />
        ) : null}
        <button
          type="button"
          data-testid={`verified-expand-${id}`}
          aria-expanded={active}
          onClick={onSelect}
          className="flex w-full min-w-0 items-start gap-3 text-start"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink">
            <BadgeCheck size={20} aria-hidden="true" className="text-primary" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-semibold text-ink">{title}</span>
              {verifiedLabel ? (
                <span className="shrink-0 text-xs text-ink-muted">{verifiedLabel}</span>
              ) : null}
            </span>
            {code ? <span className="mt-0.5 text-xs text-ink-muted">{code}</span> : null}
            <span className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border-muted pt-2">
              <StatusPill status="verified" label={t('tabs.verified')} />
              <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                <Clock size={14} aria-hidden="true" />
                <span>{t('contributions.verifiedTitle')}</span>
              </span>
            </span>
          </span>
        </button>
      </article>
    </li>
  );
}

function VerifiedExperiencePanel({ row }: { row: OrgExperienceRow }) {
  const t = useTranslations('orgReview');
  const activeLocale = useLocale();
  const record = recordOf(row);
  const code = expCodeOf(record.registryId);
  const title = textOf(record.title) ?? '—';
  const verificationCode = textOf(record.verificationCode);
  const verifiedAt = textOf(record.verifiedAt);
  const verifiedLabel = verifiedAt && formatDate(verifiedAt, activeLocale)
    ? t('participants.verifiedOn', { date: formatDate(verifiedAt, activeLocale) as string })
    : null;
  const visibility = textOf(record.publicVisibility);

  return (
    <div data-testid="verified-detail" className="flex min-w-0 flex-col gap-6">
      <section
        aria-label={title}
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6"
      >
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-muted">
              <BadgeCheck size={28} aria-hidden="true" className="text-primary" />
            </span>
            <div className="flex min-w-0 flex-col">
              <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
              {code ? <span className="mt-0.5 text-sm text-ink-muted">{code}</span> : null}
              {verifiedLabel ? <span className="mt-1 text-sm text-ink-muted">{verifiedLabel}</span> : null}
            </div>
          </div>
          <StatusPill status="verified" label={t('tabs.verified')} />
        </div>
        <dl className="grid grid-cols-1 gap-3 rounded-lg bg-surface-muted p-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-ink-muted">{t('contributions.verifiedCode')}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">{verificationCode ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">{t('contributions.visibilityLabel')}</dt>
            <dd className="mt-0.5 text-sm text-ink">{visibility ?? '—'}</dd>
          </div>
        </dl>
        <div>
          <Link
            href="/org/experiences"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-hover"
          >
            <span>{t('contributions.openArchive')}</span>
            <ArrowRight size={16} aria-hidden="true" className="rtl:rotate-180" />
          </Link>
        </div>
      </section>
      <p className="px-2 text-xs leading-relaxed text-ink-muted">
        {t('contributions.privacyNote')}
      </p>
    </div>
  );
}
