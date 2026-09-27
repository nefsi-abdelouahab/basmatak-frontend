'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import {
  rowId,
  type ParticipationRow,
  type ParticipationStatus,
} from '@/lib/api/tasks';
import { useMyParticipationsQuery } from '@/hooks/useTasks';
import {
  ActivityStrip,
  RequireTasks,
  SectionError,
  StatusPill,
  TabBar,
  joinName,
} from '../applications/components';
import { ParticipationDetail } from './ParticipationDetail';

// F6-owned My Tasks route: exact-enum status tabs (no date filter — the
// backend ParticipationListQueryDto has none), joined rows, inline
// expansion + deep links, leave flow + attestation in detail, onward F7
// link. No submission editing, no messaging UI.
export function VolunteerTasksPage({ locale }: { locale: string }) {
  const t = useTranslations('volunteerTasks');
  const [tab, setTab] = useState<ParticipationStatus>('accepted');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<ParticipationRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);

  const listQuery = useMyParticipationsQuery({ status: tab, cursor });

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
    setExpanded(null);
  }, [tab]);

  useEffect(() => {
    if (listQuery.data) {
      const pageItems = listQuery.data.items;
      if (cursor === undefined) setItems(pageItems);
      else setItems((prev) => [...prev, ...pageItems]);
    }
  }, [listQuery.data, cursor]);

  const tabs = [
    { value: 'accepted' as const, label: t('tabs.accepted') },
    { value: 'active' as const, label: t('tabs.active') },
    { value: 'completed' as const, label: t('tabs.completed') },
    { value: 'withdrawn' as const, label: t('tabs.withdrawn') },
    { value: 'removed' as const, label: t('tabs.removed') },
  ];
  const statusLabels: Record<string, string> = Object.fromEntries(
    tabs.map((tabEntry) => [tabEntry.value, tabEntry.label]),
  );

  return (
    <RequireTasks locale={locale} next={`/volunteer/tasks`}>
      <div data-testid="volunteer-tasks" className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('participations.title')}</h1>
          <p className="text-sm text-ink-muted">{t('participations.subtitle')}</p>
        </div>

        <TabBar tabs={tabs} active={tab} onTab={(value) => { setNotice(false); setTab(value as ParticipationStatus); }} testId="participation-tabs" />

        {notice ? (
          <p data-testid="leave-success" role="status" className="text-sm text-status-success">
            {t('participations.withdrawn')}
          </p>
        ) : null}

        <Card>
          {listQuery.isPending && items.length === 0 ? <Loader label={t('shared.loading')} /> : null}
          {listQuery.isError ? (
            <SectionError testId="participations-error" message={t('shared.loadError')} />
          ) : null}
          {listQuery.data ? (
            <p data-testid="participations-count" className="mb-3 text-sm text-ink-muted">
              {t('participations.count', { total: listQuery.data.total })}
            </p>
          ) : null}
          {listQuery.data && items.length === 0 ? (
            <Empty title={t('participations.empty')} />
          ) : null}
          <ul className="flex flex-col gap-3">
            {items.map((row) => {
              const id = rowId(row);
              const isOpen = expanded === id;
              return (
                <li
                  key={id}
                  data-testid="participation-row"
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-ink">
                        {joinName(row.opportunity, locale)}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {joinName(row.organization, locale)} · {joinName(row.position, locale)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill status={row.status} label={statusLabels[row.status] ?? row.status} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        data-testid={`expand-task-${id}`}
                        aria-expanded={isOpen}
                        onClick={() => setExpanded(isOpen ? null : id)}
                      >
                        {t('shared.details')}
                      </Button>
                      <Link
                        data-testid={`open-task-${id}`}
                        href={`/volunteer/tasks/${id}`}
                        className="text-sm font-medium text-primary"
                      >
                        {t('shared.details')}
                      </Link>
                    </div>
                  </div>
                  {isOpen ? (
                    <div className="mt-3">
                      <ParticipationDetail
                        participationId={id}
                        locale={locale}
                        onLeft={() => {
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
                data-testid="load-more-tasks"
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
