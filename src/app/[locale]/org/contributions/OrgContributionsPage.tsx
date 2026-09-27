'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Select } from '@/components/ui/Select';
import { mapToApiError } from '@/lib/api/errors';
import {
  SUBMISSION_FORMATS,
  SUBMISSION_INBOX_SORTS,
  TO_REVIEW_STATUSES,
  rowId,
  type InboxSubmission,
  type SubmissionFormat,
  type SubmissionInboxSort,
} from '@/lib/api/orgInbox';
import { useOrgSubmissionsQuery } from '@/hooks/useOrgInbox';
import { SubmissionDetailCard } from './SubmissionDetail';
import { RequireOrg, SectionError, StatusPill, TabBar, joinName } from '../applications/components';

// F11-owned Contributions verification inbox: to-review multi-status
// (submitted,under_review) + single-status tabs, ?q=&format=&sort=, totals
// banners + volunteer join, inline expansion + deep-linkable [submissionId]
// detail, start-review / single approve-and-mint / reject-with-required-
// reason, owning-org evidence render. No Verified tab (F12-owned), no
// council/compliance copy, no messaging UI.
const TABS = ['to-review', 'submitted', 'rejected'] as const;

type ContributionsTab = (typeof TABS)[number];

export function OrgContributionsPage({ locale }: { locale: string }) {
  const t = useTranslations('orgReview');
  const [tab, setTab] = useState<ContributionsTab>('to-review');
  const [q, setQ] = useState('');
  const [format, setFormat] = useState<'' | SubmissionFormat>('');
  const [sort, setSort] = useState<SubmissionInboxSort>('newest');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<InboxSubmission[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const statusParam =
    tab === 'to-review' ? TO_REVIEW_STATUSES.split(',') : [tab];
  const listQuery = useOrgSubmissionsQuery({
    status: statusParam,
    q: q || undefined,
    format: format || undefined,
    sort,
    cursor,
  });

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
    setExpanded(null);
  }, [tab, q, format, sort]);

  useEffect(() => {
    if (listQuery.data) {
      const pageItems = listQuery.data.items as InboxSubmission[];
      if (cursor === undefined) setItems(pageItems);
      else setItems((prev) => [...prev, ...pageItems]);
    }
  }, [listQuery.data, cursor]);

  const tabs = TABS.map((value) => ({
    value,
    label: value === 'to-review' ? t('contributions.toReviewLabel') : t(`tabs.${value}`),
  }));
  const forbidden =
    listQuery.isError && mapToApiError(listQuery.error).statusCode === 403;
  // A decided row leaves the current filter (server-side), which would
  // unmount its own detail panel mid-flow. The panel below persists outside
  // the list (fresh data via the detail endpoint) so the new status renders.
  const detached =
    expanded !== null && !items.some((row) => rowId(row) === expanded);

  return (
    <RequireOrg locale={locale} next={`/org/contributions`}>
      <div data-testid="org-contributions" className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('contributions.title')}</h1>
          <p className="text-sm text-ink-muted">{t('contributions.subtitle')}</p>
        </div>

        <TabBar
          tabs={tabs}
          active={tab}
          onTab={(value) => setTab(value as ContributionsTab)}
          testId="contribution-tabs"
        />

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-52 flex-1">
            <Input
              id="contributions-q"
              label={t('shared.searchLabel')}
              placeholder={t('shared.searchPlaceholder')}
              value={q}
              onChange={(event) => setQ(event.target.value)}
              data-testid="contributions-search"
            />
          </div>
          <div className="w-44">
            <Select
              id="contributions-format"
              label={t('contributions.formatLabel')}
              value={format}
              onChange={(event) => setFormat(event.target.value as '' | SubmissionFormat)}
              options={[
                { value: '', label: t('contributions.allFormats') },
                ...SUBMISSION_FORMATS.map((value) => ({ value, label: value })),
              ]}
              data-testid="contributions-format"
            />
          </div>
          <div className="w-44">
            <Select
              id="contributions-sort"
              label={t('contributions.sortLabel')}
              value={sort}
              onChange={(event) => setSort(event.target.value as SubmissionInboxSort)}
              options={SUBMISSION_INBOX_SORTS.map((value) => ({
                value,
                label: value === 'newest' ? t('contributions.sortNewest') : t('contributions.sortOldest'),
              }))}
              data-testid="contributions-sort"
            />
          </div>
          {q || format ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="contributions-clear"
              onClick={() => {
                setQ('');
                setFormat('');
              }}
            >
              {t('shared.clearFilters')}
            </Button>
          ) : null}
        </div>

        {listQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {forbidden ? (
          <SectionError testId="contributions-forbidden" message={t('shared.loadError')} />
        ) : listQuery.isError ? (
          <SectionError testId="contributions-error" message={t('shared.loadError')} />
        ) : (
          <Card>
            <p data-testid="contributions-count" className="mb-3 text-sm font-medium text-ink">
              {t('contributions.count', { total: listQuery.data?.total ?? items.length })}
            </p>
            {items.length === 0 && !detached ? (
              <Empty title={t('shared.empty')} />
            ) : (
              <>
                {items.length > 0 ? (
                  <ul className="flex flex-col gap-3">
                    {items.map((row) => {
                      const id = rowId(row);
                      const isOpen = expanded === id;
                      return (
                        <li
                          key={id}
                          data-testid="submission-row"
                          className="rounded-md border border-border-muted bg-surface-muted p-3"
                        >
                          <button
                            type="button"
                            data-testid={`submission-expand-${id}`}
                            aria-expanded={isOpen}
                            onClick={() => setExpanded(isOpen ? null : id)}
                            className="flex w-full flex-wrap items-center justify-between gap-2 text-start"
                          >
                            <span className="font-medium text-ink">
                              {row.title ?? joinName(row.volunteer, locale)}
                            </span>
                            <StatusPill
                              status={row.status}
                              label={row.status === 'submitted' || row.status === 'verified' || row.status === 'rejected' ? t(`tabs.${row.status}`) : row.status}
                            />
                          </button>
                          <span className="mt-1 block text-sm text-ink-muted">
                            {joinName(row.volunteer, locale)} · {joinName(row.opportunity, locale)}
                          </span>
                          {isOpen ? (
                            <div className="mt-3">
                              <SubmissionDetailCard
                                locale={locale}
                                submissionId={id}
                                testIdPrefix="submission-detail"
                              />
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {detached && expanded ? (
                  <div className="mt-3">
                    <SubmissionDetailCard
                      locale={locale}
                      submissionId={expanded}
                      testIdPrefix="submission-detail"
                    />
                  </div>
                ) : null}
              </>
            )}
            {listQuery.data?.nextCursor ? (
              <div className="mt-3">
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
          </Card>
        )}
      </div>
    </RequireOrg>
  );
}
