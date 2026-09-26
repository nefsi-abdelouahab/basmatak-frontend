'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import {
  rowId,
  shortApplicationId,
  type ApplicationRow,
  type ApplicationStatus,
} from '@/lib/api/tasks';
import { useMyApplicationsQuery } from '@/hooks/useTasks';
import {
  ActivityStrip,
  RequireTasks,
  SectionError,
  StatusPill,
  TabBar,
  joinName,
} from './components';
import { ApplicationDetail } from './ApplicationDetail';

// F6-owned My Applications route: real under_review tab, ISO date filter,
// short-form IDs, inline expansion + deep links, withdraw in detail,
// activity strip. No messaging UI.
export function VolunteerApplicationsPage({ locale }: { locale: string }) {
  const t = useTranslations('volunteerTasks');
  const [tab, setTab] = useState<ApplicationStatus>('pending');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<ApplicationRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);

  const listQuery = useMyApplicationsQuery({
    status: tab,
    from: from || undefined,
    to: to || undefined,
    cursor,
  });

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
    { value: 'pending' as const, label: t('tabs.pending') },
    { value: 'under_review' as const, label: t('tabs.under_review') },
    { value: 'accepted' as const, label: t('tabs.accepted') },
    { value: 'rejected' as const, label: t('tabs.rejected') },
    { value: 'withdrawn' as const, label: t('tabs.withdrawn') },
  ];
  const statusLabels: Record<string, string> = Object.fromEntries(
    tabs.map((tabEntry) => [tabEntry.value, tabEntry.label]),
  );

  return (
    <RequireTasks locale={locale} next={`/${locale}/volunteer/applications`}>
      <div data-testid="volunteer-applications" className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('applications.title')}</h1>
          <p className="text-sm text-ink-muted">{t('applications.subtitle')}</p>
        </div>

        <TabBar tabs={tabs} active={tab} onTab={(value) => { setNotice(false); setTab(value as ApplicationStatus); }} testId="application-tabs" />

        {notice ? (
          <p data-testid="withdraw-success" role="status" className="text-sm text-status-success">
            {t('applications.withdrawn')}
          </p>
        ) : null}

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
          ) : null}
        </div>

        <Card>
          {listQuery.isPending && items.length === 0 ? <Loader label={t('shared.loading')} /> : null}
          {listQuery.isError ? (
            <SectionError testId="applications-error" message={t('shared.loadError')} />
          ) : null}
          {listQuery.data ? (
            <p data-testid="applications-count" className="mb-3 text-sm text-ink-muted">
              {t('applications.count', { total: listQuery.data.total })}
            </p>
          ) : null}
          {listQuery.data && items.length === 0 ? (
            <Empty title={t('applications.empty')} />
          ) : null}
          <ul className="flex flex-col gap-3">
            {items.map((row) => {
              const id = rowId(row);
              const isOpen = expanded === id;
              return (
                <li
                  key={id}
                  data-testid="application-row"
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-ink">
                        {joinName(row.opportunity, locale)}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {t('applications.idLabel')}: {shortApplicationId(id)} ·{' '}
                        {joinName(row.organization, locale)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill status={row.status} label={statusLabels[row.status] ?? row.status} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        data-testid={`expand-${id}`}
                        aria-expanded={isOpen}
                        onClick={() => setExpanded(isOpen ? null : id)}
                      >
                        {t('shared.details')}
                      </Button>
                      <Link
                        data-testid={`open-${id}`}
                        href={`/volunteer/applications/${id}`}
                        className="text-sm font-medium text-primary"
                      >
                        {t('shared.details')}
                      </Link>
                    </div>
                  </div>
                  {isOpen ? (
                    <div className="mt-3">
                      <ApplicationDetail
                        applicationId={id}
                        locale={locale}
                        onWithdrawn={() => {
                          setNotice(true);
                          setTab('withdrawn');
                        }}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {listQuery.isPending && items.length > 0 ? <Loader label={t('shared.loading')} /> : null}
          {listQuery.data?.nextCursor ? (
            <div className="mt-3">
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
        </Card>

        <ActivityStrip locale={locale} />
      </div>
    </RequireTasks>
  );
}
