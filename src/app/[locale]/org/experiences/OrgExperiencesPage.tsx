'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Select } from '@/components/ui/Select';
import { getLoginHref, useSessionQuery } from '@/hooks/useSession';
import {
  useOrgCsvExportMutation,
  useOrgExperiencesQuery,
  useOrgReviewsGivenQuery,
} from '@/hooks/useOrgRecords';
import { OrgRecordCard } from './OrgRecordCard';

// F12-owned route-local guard for org/experiences. Mirrors the F9/F10
// route-local guard pattern without editing other files.
// Guest guard (decision 10): unauthenticated visits redirect to Login.
export function RequireOrgRecords({
  locale,
  next,
  children,
}: {
  locale: string;
  next: string;
  children: ReactNode;
}) {
  const t = useTranslations('orgRecords');
  const session = useSessionQuery();
  const router = useRouter();

  useEffect(() => {
    if (session.isError) router.replace(getLoginHref(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isError, router, locale]);

  if (session.isPending) return <Loader label={t('shared.loading')} />;
  if (session.isError) return null;
  return <>{children}</>;
}

function SectionError({ message, testId }: { message: string; testId: string }) {
  return (
    <p data-testid={testId} role="alert" className="text-sm text-status-error">
      {message}
    </p>
  );
}

function ReviewsGivenSection() {
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

// F12-owned Verified Experiences archive route: search/opportunity/
// visibility/sort filters, totals from the cursor page, CSV export via the
// shared blob helper, per-row verify-link copies + attestation downloads,
// plus the org-given reviews section on the same page (OQ2: section below
// the archive). Guest visits redirect to Login (decision 10). No verify
// page, no ledger/SHA copy, no audio player.
export function OrgExperiencesPage({ locale }: { locale: string }) {
  const t = useTranslations('orgRecords');
  const [q, setQ] = useState('');
  const [opportunityId, setOpportunityId] = useState('');
  const [visibility, setVisibility] = useState('');
  const [sort, setSort] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [csvError, setCsvError] = useState(false);

  const listQuery = useOrgExperiencesQuery({
    q: q === '' ? undefined : q,
    opportunityId: opportunityId === '' ? undefined : opportunityId,
    visibility: visibility === '' ? undefined : visibility,
    sort: sort === '' ? undefined : sort,
    cursor,
  });
  const csvMutation = useOrgCsvExportMutation();

  const clearFilters = () => {
    setQ('');
    setOpportunityId('');
    setVisibility('');
    setSort('');
    setCursor(undefined);
    setCursorHistory([]);
  };

  const onFilterChange = () => {
    setCursor(undefined);
    setCursorHistory([]);
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
        opportunityId: opportunityId === '' ? undefined : opportunityId,
        visibility: visibility === '' ? undefined : visibility,
        sort: sort === '' ? undefined : sort,
      },
      { onError: () => setCsvError(true) },
    );
  };

  return (
    <RequireOrgRecords locale={locale} next={`/org/experiences`}>
      <div data-testid="org-records" className="flex min-w-0 flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('archive.title')}</h1>
          <p className="text-sm text-ink-muted">{t('archive.subtitle')}</p>
        </div>
        <Card title={t('archive.filtersTitle')}>
          <div data-testid="org-records-filters" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              id="org-records-q"
              label={t('archive.searchLabel')}
              placeholder={t('archive.searchPlaceholder')}
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                onFilterChange();
              }}
            />
            <Input
              id="org-records-opportunity"
              label={t('archive.opportunityLabel')}
              placeholder={t('archive.opportunityPlaceholder')}
              value={opportunityId}
              onChange={(event) => {
                setOpportunityId(event.target.value);
                onFilterChange();
              }}
            />
            <Select
              id="org-records-visibility"
              label={t('archive.visibilityLabel')}
              value={visibility}
              onChange={(event) => {
                setVisibility(event.target.value);
                onFilterChange();
              }}
              options={[
                { value: '', label: t('archive.allVisibilities') },
                { value: 'public', label: t('archive.visibilityPublic') },
                { value: 'private', label: t('archive.visibilityPrivate') },
              ]}
            />
            <Select
              id="org-records-sort"
              label={t('archive.sortLabel')}
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                onFilterChange();
              }}
              options={[
                { value: '', label: t('archive.sortNewest') },
                { value: 'newest', label: t('archive.sortNewest') },
                { value: 'oldest', label: t('archive.sortOldest') },
              ]}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              {t('archive.clearFilters')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="org-records-csv"
              disabled={csvMutation.isPending}
              onClick={onExportCsv}
            >
              {csvMutation.isPending ? t('shared.downloading') : t('archive.csvCta')}
            </Button>
          </div>
          {csvError ? (
            <p data-testid="org-records-csv-error" role="alert" className="mt-2 text-sm text-status-error">
              {t('archive.csvError')}
            </p>
          ) : null}
        </Card>
        {listQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {listQuery.isError ? (
          <SectionError testId="org-records-error" message={t('shared.loadError')} />
        ) : null}
        {listQuery.data ? (
          <p data-testid="org-records-count" className="text-sm text-ink-muted">
            {t('archive.count', { total: listQuery.data.total })}
          </p>
        ) : null}
        {listQuery.data && listQuery.data.items.length === 0 ? (
          <Empty title={t('archive.empty')} />
        ) : null}
        {(listQuery.data?.items ?? []).map((record) => (
          <OrgRecordCard key={record.id} record={record} locale={locale} />
        ))}
        {listQuery.data ? (
          <div className="flex items-center gap-2">
            {cursorHistory.length > 0 || cursor ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                data-testid="org-records-back"
                onClick={goBack}
              >
                {t('archive.prevPage')}
              </Button>
            ) : null}
            {listQuery.data.nextCursor ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                data-testid="org-records-next"
                onClick={goNext}
              >
                {t('archive.nextPage')}
              </Button>
            ) : null}
          </div>
        ) : null}
        <div data-testid="org-reviews">
          <ReviewsGivenSection />
        </div>
      </div>
    </RequireOrgRecords>
  );
}
