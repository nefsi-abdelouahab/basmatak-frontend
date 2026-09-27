'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { mapToApiError } from '@/lib/api/errors';
import {
  APPLICATION_STATUSES,
  rowId,
  type ApplicationStatus,
  type InboxApplication,
} from '@/lib/api/orgInbox';
import { useOrgApplicationsQuery } from '@/hooks/useOrgInbox';
import { ApplicationDetailCard } from './ApplicationDetail';
import { RequireOrg, SectionError, StatusPill, TabBar, joinName } from './components';

// F11-owned Applications inbox: cross-opportunity aggregate
// (?opportunityId=&status=&q=) with real under_review tab, count banners from
// total, inline expansion + deep-linkable [applicationId] detail,
// start-review/accept/reject-with-required-reason. No messaging UI.
export function OrgApplicationsPage({ locale }: { locale: string }) {
  const t = useTranslations('orgReview');
  const [tab, setTab] = useState<ApplicationStatus>('pending');
  const [q, setQ] = useState('');
  const [opportunityId, setOpportunityId] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<InboxApplication[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const listQuery = useOrgApplicationsQuery({
    opportunityId: opportunityId || undefined,
    status: tab,
    q: q || undefined,
    cursor,
  });

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
    setExpanded(null);
  }, [tab, q, opportunityId]);

  useEffect(() => {
    if (listQuery.data) {
      const pageItems = listQuery.data.items as InboxApplication[];
      if (cursor === undefined) setItems(pageItems);
      else setItems((prev) => [...prev, ...pageItems]);
    }
  }, [listQuery.data, cursor]);

  const tabs = APPLICATION_STATUSES.map((value) => ({
    value,
    label: t(`tabs.${value}`),
  }));
  const statusLabels: Record<string, string> = Object.fromEntries(
    tabs.map((tabEntry) => [tabEntry.value, tabEntry.label]),
  );
  const forbidden =
    listQuery.isError && mapToApiError(listQuery.error).statusCode === 403;
  // A decided row leaves the current tab (server-side filter), which would
  // unmount its own detail panel mid-flow. The panel below persists outside
  // the list (fresh data via the detail endpoint) so the new status renders.
  const detached =
    expanded !== null && !items.some((row) => rowId(row) === expanded);

  return (
    <RequireOrg locale={locale} next={`/${locale}/org/applications`}>
      <div data-testid="org-applications" className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('applications.title')}</h1>
          <p className="text-sm text-ink-muted">{t('applications.subtitle')}</p>
        </div>

        <TabBar
          tabs={tabs}
          active={tab}
          onTab={(value) => setTab(value as ApplicationStatus)}
          testId="application-tabs"
        />

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-52 flex-1">
            <Input
              id="applications-q"
              label={t('shared.searchLabel')}
              placeholder={t('shared.searchPlaceholder')}
              value={q}
              onChange={(event) => setQ(event.target.value)}
              data-testid="applications-search"
            />
          </div>
          <div className="min-w-52 flex-1">
            <Input
              id="applications-opportunity"
              label={t('shared.opportunityLabel')}
              placeholder={t('shared.allOpportunities')}
              value={opportunityId}
              onChange={(event) => setOpportunityId(event.target.value.trim())}
              data-testid="applications-opportunity"
            />
          </div>
          {q || opportunityId ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="applications-clear"
              onClick={() => {
                setQ('');
                setOpportunityId('');
              }}
            >
              {t('shared.clearFilters')}
            </Button>
          ) : null}
        </div>

        {listQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {forbidden ? (
          <SectionError testId="applications-forbidden" message={t('shared.loadError')} />
        ) : listQuery.isError ? (
          <SectionError testId="applications-error" message={t('shared.loadError')} />
        ) : (
          <Card>
            <p data-testid="applications-count" className="mb-3 text-sm font-medium text-ink">
              {t('applications.count', { total: listQuery.data?.total ?? items.length })}
            </p>
            {items.length === 0 && !detached ? (
              <Empty title={t('shared.empty')} />
            ) : (
              <>
                {items.length > 0 ? (
                  <ul className="flex flex-col gap-3">
                    {items.map((row) => {
                const id = rowId(row);
                const name = joinName(row.applicant ?? row.volunteer, locale);
                const isOpen = expanded === id;
                return (
                  <li
                    key={id}
                    data-testid="application-row"
                    className="rounded-md border border-border-muted bg-surface-muted p-3"
                  >
                    <button
                      type="button"
                      data-testid={`application-expand-${id}`}
                      aria-expanded={isOpen}
                      onClick={() => setExpanded(isOpen ? null : id)}
                      className="flex w-full flex-wrap items-center justify-between gap-2 text-start"
                    >
                      <span className="font-medium text-ink">{name}</span>
                      <StatusPill status={row.status} label={statusLabels[row.status] ?? row.status} />
                    </button>
                    <span className="mt-1 block text-sm text-ink-muted">
                      {joinName(row.opportunity, locale)}
                    </span>
                    {isOpen ? (
                      <div className="mt-3">
                        <ApplicationDetailCard
                          locale={locale}
                          applicationId={id}
                          testIdPrefix="application-detail"
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
                    <ApplicationDetailCard
                      locale={locale}
                      applicationId={expanded}
                      testIdPrefix="application-detail"
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
                  data-testid="applications-more"
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
