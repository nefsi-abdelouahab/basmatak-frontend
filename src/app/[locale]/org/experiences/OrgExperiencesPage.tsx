'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  BadgeCheck,
  ChevronDown,
  Clock,
  Download,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { mapToApiError } from '@/lib/api/errors';
import type { OrgExperienceRow } from '@/lib/api/orgRecords';
import { useOwnOpportunitiesQuery } from '@/hooks/useOrgOpps';
import {
  useOrgCsvExportMutation,
  useOrgExperiencesQuery,
  useOrgReviewsGivenQuery,
} from '@/hooks/useOrgRecords';
import { useMyOrganizationQuery } from '@/hooks/useOrgStats';
import { MasterDetail, RequireOrg, SectionError } from '../applications/components';
import { OrgExperienceDetail, OrgRecordCard } from './OrgRecordCard';

// Verified Experiences archive rebuilt from
// `design/Basmatak Tatatoua - Verified Experiences Organization-Dashboard/`
// (code.html + screen.png) with every fabricated institutional claim
// deleted (see session diff table): breadcrumb carries workspace + org
// name only; stats are real counts (total + summed documented hours); the
// list renders record identity only (no volunteer join exists in the org
// payload, so no invented names/roles/avatars/IDs); the detail panel renders
// the selected row's real verification fields plus the real CSV export
// (GET /organizations/me/experiences?format=csv) and the real attestation
// download (GET /experiences/:experienceId/attestation). Copy action targets
// the real inline /verify/:verificationCode proof (no standalone page).
// Layout reuses the shared MasterDetail split (independent scroll on lg,
// list->detail navigation on mobile) inside one shared Container. No toasts —
// all states render inline.

function formatHoursLabel(totalMinutes: number): string {
  const hours = totalMinutes / 60;
  if (Number.isInteger(hours)) return String(hours);
  return hours.toFixed(1);
}

function SectionReviews() {
  const t = useTranslations('orgRecords');
  const reviewsQuery = useOrgReviewsGivenQuery();
  if (reviewsQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (reviewsQuery.isError)
    return <SectionError testId="org-reviews-error" message={t('shared.loadError')} />;
  const reviews = reviewsQuery.data?.items ?? [];
  return (
    <Card title={t('reviews.title')}>
      <p className="mb-3 text-sm text-ink-muted">{t('reviews.subtitle')}</p>
      {reviews.length === 0 ? (
        <Empty title={t('reviews.empty')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.map((review, index) => (
            <li
              key={`${review.rating ?? 'na'}-${index}`}
              data-testid="org-review-row"
              className="rounded-md border border-border p-3"
            >
              <p className="text-sm font-semibold text-ink">
                {t('reviews.ratingLabel', { rating: review.rating ?? '—' })}
              </p>
              {typeof review.comment === 'string' && review.comment ? (
                <p className="mt-1 text-sm text-ink-muted">{review.comment}</p>
              ) : typeof review.notes === 'string' && review.notes ? (
                <p className="mt-1 text-sm text-ink-muted">{review.notes}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function OrgExperiencesPage({ locale }: { locale: string }) {
  const t = useTranslations('orgRecords');
  const [q, setQ] = useState('');
  const [opportunityId, setOpportunityId] = useState('');
  const [visibility, setVisibility] = useState('');
  const [sort, setSort] = useState('newest');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<OrgExperienceRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [csvError, setCsvError] = useState(false);

  const listQuery = useOrgExperiencesQuery({
    q: q === '' ? undefined : q,
    opportunityId: opportunityId === '' ? undefined : opportunityId,
    visibility: visibility === '' ? undefined : visibility,
    sort: sort === '' ? undefined : sort,
    cursor,
  });
  const csvMutation = useOrgCsvExportMutation();
  const orgQuery = useMyOrganizationQuery();
  const oppsQuery = useOwnOpportunitiesQuery({ limit: 50 });

  const filterKey = `${q}|${opportunityId}|${visibility}|${sort}`;
  useEffect(() => {
    setCursor(undefined);
    setItems([]);
    setSelected(null);
    setCsvError(false);
  }, [q, opportunityId, visibility, sort]);

  useEffect(() => {
    if (listQuery.data) {
      const pageItems = listQuery.data.items as OrgExperienceRow[];
      if (cursor === undefined) setItems(pageItems);
      else setItems((prev) => [...prev, ...pageItems]);
    }
  }, [listQuery.data, cursor]);

  // Auto-select the first row exactly once per filter set (same guard the org
  // Applications/Participants screens use): a user-initiated deselect via the
  // mobile back control must stick instead of reselecting on every null.
  const autoSelectedFor = useRef<string | null>(null);
  useEffect(() => {
    if (items.length > 0 && autoSelectedFor.current !== filterKey) {
      autoSelectedFor.current = filterKey;
      setSelected((prev) => (prev === null ? items[0].id : prev));
    }
  }, [items, filterKey]);

  const orgName = useMemo(() => {
    const org = orgQuery.data as unknown as {
      nameFr?: string | null;
      nameAr?: string | null;
    } | null | undefined;
    if (!org) return '';
    return locale === 'ar' ? (org.nameAr ?? org.nameFr ?? '') : (org.nameFr ?? org.nameAr ?? '');
  }, [orgQuery.data, locale]);

  const opportunityOptions = useMemo(() => {
    const rows = (oppsQuery.data?.items ?? []) as { id?: string; _id?: string; title?: string }[];
    return rows.map((opp) => {
      const value = opp.id ?? opp._id ?? '';
      return { value, label: opp.title ?? value };
    });
  }, [oppsQuery.data]);

  const total = listQuery.data?.total ?? items.length;
  const totalMinutes = items.reduce(
    (sum, row) => sum + (typeof row.duration === 'number' ? row.duration : 0),
    0,
  );
  const selectedRow = selected === null ? undefined : items.find((row) => row.id === selected);
  const forbidden =
    listQuery.isError && mapToApiError(listQuery.error).statusCode === 403;
  const hasFilters = q !== '' || opportunityId !== '' || visibility !== '';

  const clearFilters = () => {
    setQ('');
    setOpportunityId('');
    setVisibility('');
  };

  const onExportCsv = () => {
    setCsvError(false);
    csvMutation.mutate(
      {
        q: q === '' ? undefined : q,
        opportunityId: opportunityId === '' ? undefined : opportunityId,
        visibility: visibility === '' ? undefined : visibility,
        sort: sort === '' ? undefined : sort,
      },
      { onError: () => setCsvError(true) },
    );
  };

  return (
    <RequireOrg locale={locale} next={`/org/experiences`}>
      <Container testId="org-experiences-container" className="flex min-w-0 flex-col gap-6 py-4">
        <div data-testid="org-records" className="flex min-w-0 flex-col gap-6">
          {/* Header: cleaned breadcrumb (workspace + org name only), title,
              subtitle, neutral Export CSV wired to the real endpoint */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              {t('archive.workspace')}
              {orgName ? ` · ${orgName}` : ''}
            </span>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-ink">{t('archive.title')}</h1>
                <p className="mt-1 text-sm text-ink-muted">{t('archive.subtitle')}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                data-testid="org-records-csv"
                disabled={csvMutation.isPending}
                onClick={onExportCsv}
                className="shrink-0"
              >
                <Download size={14} aria-hidden="true" />
                <span>{csvMutation.isPending ? t('shared.downloading') : t('archive.csvCta')}</span>
              </Button>
            </div>
            {csvError ? (
              <p data-testid="org-records-csv-error" role="alert" className="text-sm text-status-error">
                {t('archive.csvError')}
              </p>
            ) : null}
          </div>

          {/* Stat row: 2 real counts max (legal-framework + SHA stats deleted) */}
          <Card>
            <dl
              data-testid="org-experiences-stats"
              className="flex flex-wrap items-center gap-x-8 gap-y-3"
            >
              <div className="flex items-center gap-2.5">
                <BadgeCheck size={20} aria-hidden="true" className="shrink-0 text-primary" />
                <div className="flex flex-col">
                  <dt className="text-xs uppercase tracking-wider text-ink-muted">
                    {t('stats.verifiedLabel')}
                  </dt>
                  <dd className="text-base font-semibold text-ink">
                    {t('stats.verified', { total })}
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock size={20} aria-hidden="true" className="shrink-0 text-ink-muted" />
                <div className="flex flex-col">
                  <dt className="text-xs uppercase tracking-wider text-ink-muted">
                    {t('stats.hoursLabel')}
                  </dt>
                  <dd className="text-base font-semibold text-ink">
                    {t('stats.hours', { hours: formatHoursLabel(totalMinutes) })}
                  </dd>
                </div>
              </div>
            </dl>
          </Card>

          {/* Filters: label-above-input row (search + real opportunity
              dropdown + visibility + backend-backed newest/oldest sort) */}
          <Card title={t('archive.filtersTitle')}>
            <div data-testid="org-records-filters" className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="min-w-0 md:col-span-2">
                <label htmlFor="org-records-q" className="mb-1 block text-sm font-medium text-ink">
                  {t('archive.searchLabel')}
                </label>
                <div className="relative">
                  <Search
                    size={18}
                    aria-hidden="true"
                    className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
                  />
                  <input
                    id="org-records-q"
                    type="search"
                    data-testid="org-records-search"
                    placeholder={t('archive.searchPlaceholder')}
                    value={q}
                    onChange={(event) => setQ(event.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-surface py-2 pe-3 ps-9 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
              <div className="min-w-0">
                <label htmlFor="org-records-opportunity" className="mb-1 block text-sm font-medium text-ink">
                  {t('archive.opportunityLabel')}
                </label>
                <div className="relative">
                  <select
                    id="org-records-opportunity"
                    data-testid="org-records-opportunity"
                    value={opportunityId}
                    onChange={(event) => setOpportunityId(event.target.value)}
                    className="h-10 w-full appearance-none rounded-lg border border-border bg-surface px-3 pe-8 text-sm text-ink focus:border-primary focus:outline-none"
                  >
                    <option value="">{t('archive.allOpportunities')}</option>
                    {opportunityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
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
              <div className="min-w-0">
                <label htmlFor="org-records-visibility" className="mb-1 block text-sm font-medium text-ink">
                  {t('archive.visibilityLabel')}
                </label>
                <div className="relative">
                  <select
                    id="org-records-visibility"
                    data-testid="org-records-visibility"
                    value={visibility}
                    onChange={(event) => setVisibility(event.target.value)}
                    className="h-10 w-full appearance-none rounded-lg border border-border bg-surface px-3 pe-8 text-sm text-ink focus:border-primary focus:outline-none"
                  >
                    <option value="">{t('archive.allVisibilities')}</option>
                    <option value="public">{t('archive.visibilityPublic')}</option>
                    <option value="private">{t('archive.visibilityPrivate')}</option>
                  </select>
                  <ChevronDown
                    size={18}
                    aria-hidden="true"
                    className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
                  />
                </div>
              </div>
              <div className="min-w-0">
                <label htmlFor="org-records-sort" className="mb-1 block text-sm font-medium text-ink">
                  {t('archive.sortLabel')}
                </label>
                <div className="relative">
                  <select
                    id="org-records-sort"
                    data-testid="org-records-sort"
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                    className="h-10 w-full appearance-none rounded-lg border border-border bg-surface px-3 pe-8 text-sm text-ink focus:border-primary focus:outline-none"
                  >
                    <option value="newest">{t('archive.sortNewest')}</option>
                    <option value="oldest">{t('archive.sortOldest')}</option>
                  </select>
                  <ChevronDown
                    size={18}
                    aria-hidden="true"
                    className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
                  />
                </div>
              </div>
              <div className="min-w-0 self-end">
                {hasFilters ? (
                  <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                    {t('archive.clearFilters')}
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>

          {/* 2-pane records + detail (shared MasterDetail split) */}
          {listQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
          {forbidden ? (
            <SectionError testId="org-records-forbidden" message={t('shared.loadError')} />
          ) : listQuery.isError ? (
            <SectionError testId="org-records-error" message={t('shared.loadError')} />
          ) : (
            <MasterDetail
              listLabel={t('list.directory')}
              detailLabel={t('archive.title')}
              hasSelection={selectedRow !== undefined}
              onBack={() => setSelected(null)}
              backLabel={t('detail.backToList')}
              list={
                <div data-testid="org-records-list" className="flex min-w-0 flex-col gap-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('list.directory')}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {t('list.showing', { shown: items.length, total })}
                    </span>
                  </div>
                  <p data-testid="org-records-count" className="sr-only">
                    {t('archive.count', { total })}
                  </p>
                  {items.length === 0 ? (
                    <Empty title={t('archive.empty')} />
                  ) : (
                    <ul className="flex min-w-0 flex-col gap-3">
                      {items.map((record) => (
                        <OrgRecordCard
                          key={record.id}
                          record={record}
                          locale={locale}
                          selected={selected === record.id}
                          onSelect={() => setSelected(selected === record.id ? null : record.id)}
                        />
                      ))}
                    </ul>
                  )}
                  {items.length > 0 ? (
                    <p className="rounded-lg bg-surface-muted p-3 text-center text-sm text-ink-muted">
                      {t('list.endOfResults')}
                    </p>
                  ) : null}
                  {listQuery.data?.nextCursor ? (
                    <div className="mt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={listQuery.isFetching}
                        onClick={() => setCursor(listQuery.data?.nextCursor ?? undefined)}
                        data-testid="org-records-more"
                      >
                        {t('archive.nextPage')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              }
              detail={
                selectedRow ? (
                  <OrgExperienceDetail
                    record={selectedRow}
                    locale={locale}
                    testIdPrefix="org-record-detail"
                  />
                ) : (
                  <Card>
                    <Empty title={t('detail.empty')} />
                  </Card>
                )
              }
            />
          )}

          <div data-testid="org-reviews">
            <SectionReviews />
          </div>
        </div>
      </Container>
    </RequireOrg>
  );
}

// Re-exported for route-level tests that assert the guard contract without
// mounting the full page (mirrors the previous route-local guard surface).
export function RequireOrgRecords({
  locale,
  next,
  children,
}: {
  locale: string;
  next: string;
  children: ReactNode;
}) {
  return (
    <RequireOrg locale={locale} next={next}>
      {children}
    </RequireOrg>
  );
}
