'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import {
  isAdminOppCloseStatus,
  type AdminOpportunityRow,
} from '@/lib/api/adminLists';
import {
  useAdminOpportunitiesCsvMutation,
  useAdminOpportunitiesQuery,
  useAdminOpportunityStatusMutation,
  useAdminStatusHistoriesQuery,
} from '@/hooks/useAdminLists';
import { AdminDialog } from '../AdminDialog';

function rowId(row: AdminOpportunityRow): string {
  if (typeof row.id === 'string' && row.id !== '') return row.id;
  if (typeof row._id === 'string') return row._id;
  return '';
}

function displayTitle(row: AdminOpportunityRow): string {
  if (typeof row.title === 'string' && row.title !== '') return row.title;
  if (typeof row.slug === 'string' && row.slug !== '') return row.slug;
  return rowId(row);
}

function statusTone(status: string | null | undefined): PillTone {
  if (status === 'closed' || status === 'cancelled') return 'error';
  return 'neutral';
}

function SectionError({ message, testId }: { message: string; testId: string }) {
  return (
    <p data-testid={testId} role="alert" className="text-sm text-status-error">
      {message}
    </p>
  );
}

function OpportunityDetail({
  row,
  onChanged,
}: {
  row: AdminOpportunityRow;
  onChanged: () => void;
}) {
  const t = useTranslations('adminManage');
  const id = rowId(row);
  const [forceCloseOpen, setForceCloseOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [closeStatus, setCloseStatus] = useState('closed');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const historiesQuery = useAdminStatusHistoriesQuery(
    historyOpen ? 'opportunity' : undefined,
    historyOpen ? id : undefined,
  );
  const statusMutation = useAdminOpportunityStatusMutation();

  const currentStatus = typeof row.status === 'string' ? row.status : '';
  const canForceClose =
    currentStatus === 'published' || currentStatus === 'in_progress';
  const positions = Array.isArray(row.positions) ? row.positions : [];
  const assigned = Array.isArray(row.assignedNames)
    ? row.assignedNames.filter((name) => name !== '')
    : [];

  const confirmForceClose = () => {
    if (!isAdminOppCloseStatus(closeStatus)) return;
    setFeedback(null);
    statusMutation.mutate(
      { opportunityId: id, change: { status: closeStatus, reason, notes } },
      {
        onSuccess: () => {
          setForceCloseOpen(false);
          setReason('');
          setNotes('');
          setFeedback(t('shared.actionSuccess'));
          onChanged();
        },
        onError: () => setFeedback(t('shared.actionError')),
      },
    );
  };

  return (
    <Card title={t('opportunities.detailTitle')}>
      <div data-testid="admin-opportunity-detail" className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-ink">{displayTitle(row)}</p>
        <p className="text-sm text-ink-muted">
          <Pill tone={statusTone(currentStatus)}>{currentStatus}</Pill>
          {typeof row.registryId === 'string' && row.registryId !== ''
            ? ` · ${row.registryId}`
            : null}
        </p>
        <p className="text-sm text-ink-muted">
          {t('opportunities.positionsLabel')}: {positions.length}
          {typeof row.applicationCount === 'number'
            ? ` · ${t('opportunities.applicationsLabel', { count: row.applicationCount })}`
            : null}
        </p>
        {assigned.length > 0 ? (
          <p className="text-sm text-ink-muted">
            {t('opportunities.assignedLabel')}: {assigned.join(', ')}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {canForceClose ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="admin-opportunity-force-close-open"
              onClick={() => setForceCloseOpen(true)}
            >
              {t('opportunities.forceCloseCta')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="admin-opportunity-history-toggle"
            onClick={() => setHistoryOpen((open) => !open)}
          >
            {t('opportunities.historyCta')}
          </Button>
        </div>
        {feedback ? (
          <p data-testid="admin-opportunity-feedback" className="text-sm text-ink-muted">
            {feedback}
          </p>
        ) : null}
        {historyOpen ? (
          <div>
            <h3 className="text-sm font-semibold text-ink">
              {t('shared.historyTitle')}
            </h3>
            {historiesQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
            {historiesQuery.isError ? (
              <SectionError
                testId="admin-opportunity-history-error"
                message={t('shared.loadError')}
              />
            ) : null}
            {historiesQuery.data && historiesQuery.data.length === 0 ? (
              <p className="text-sm text-ink-muted">{t('shared.historyEmpty')}</p>
            ) : null}
            <ul className="flex flex-col gap-2">
              {(historiesQuery.data ?? []).map((entry, index) => (
                <li
                  key={`${entry.from ?? ''}-${entry.to ?? ''}-${index}`}
                  data-testid="admin-opportunity-history-row"
                  className="rounded-md border border-border p-3 text-sm text-ink-muted"
                >
                  {entry.from} → {entry.to}
                  {typeof entry.reason === 'string' && entry.reason !== ''
                    ? ` · ${entry.reason}`
                    : null}
                  {typeof entry.notes === 'string' && entry.notes !== ''
                    ? ` · ${entry.notes}`
                    : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {forceCloseOpen ? (
        <AdminDialog
          testId="admin-opportunity-force-close-dialog"
          title={t('opportunities.forceCloseTitle')}
          onClose={() => setForceCloseOpen(false)}
        >
          <div className="flex flex-col gap-3">
            <Select
              id="admin-opportunity-close-status"
              label={t('opportunities.closeStatusLabel')}
              value={closeStatus}
              onChange={(event) => setCloseStatus(event.target.value)}
              options={[
                { value: 'closed', label: t('opportunities.statusClosed') },
                { value: 'cancelled', label: t('opportunities.statusCancelled') },
              ]}
            />
            <Input
              id="admin-opportunity-reason"
              label={t('shared.reasonLabel')}
              placeholder={t('shared.reasonPlaceholder')}
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
            />
            <Input
              id="admin-opportunity-notes"
              label={t('shared.notesLabel')}
              placeholder={t('shared.notesPlaceholder')}
              value={notes}
              maxLength={2000}
              onChange={(event) => setNotes(event.target.value)}
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              data-testid="admin-opportunity-force-close-confirm"
              disabled={statusMutation.isPending || !isAdminOppCloseStatus(closeStatus)}
              onClick={confirmForceClose}
            >
              {t('shared.confirm')}
            </Button>
          </div>
        </AdminDialog>
      ) : null}
    </Card>
  );
}

// F15-owned Manage Opportunities route: enriched rows (positions/capacity,
// app counts, location labels, assigned names), totals banners, CSV parity,
// force-close via status-PATCH (§A#16 — never a close POST), histories.
// No global topbar search.
export function AdminOpportunitiesPage() {
  const t = useTranslations('adminManage');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [csvError, setCsvError] = useState(false);

  const listQuery = useAdminOpportunitiesQuery({
    q: q === '' ? undefined : q,
    status: status === '' ? undefined : status,
    organizationId: organizationId === '' ? undefined : organizationId,
    cursor,
  });
  const csvMutation = useAdminOpportunitiesCsvMutation();

  const resetPage = () => {
    setCursor(undefined);
    setCursorHistory([]);
  };

  const clearFilters = () => {
    setQ('');
    setStatus('');
    setOrganizationId('');
    resetPage();
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
        status: status === '' ? undefined : status,
        organizationId: organizationId === '' ? undefined : organizationId,
      },
      { onError: () => setCsvError(true) },
    );
  };

  const selected = (listQuery.data?.items ?? []).find(
    (row) => rowId(row) === selectedId,
  );

  return (
    <div data-testid="admin-opportunities" className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t('opportunities.title')}</h1>
        <p className="text-sm text-ink-muted">{t('opportunities.subtitle')}</p>
      </div>
      <Card title={t('opportunities.filtersTitle')}>
        <div
          data-testid="admin-opportunities-filters"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Input
            id="admin-opportunities-q"
            label={t('shared.searchLabel')}
            placeholder={t('opportunities.searchPlaceholder')}
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              resetPage();
            }}
          />
          <Input
            id="admin-opportunities-status"
            label={t('opportunities.statusLabel')}
            placeholder={t('shared.all')}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              resetPage();
            }}
          />
          <Input
            id="admin-opportunities-organization"
            label={t('opportunities.organizationLabel')}
            placeholder={t('opportunities.organizationPlaceholder')}
            value={organizationId}
            onChange={(event) => {
              setOrganizationId(event.target.value);
              resetPage();
            }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            {t('shared.clearFilters')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="admin-opportunities-csv"
            disabled={csvMutation.isPending}
            onClick={onExportCsv}
          >
            {csvMutation.isPending ? t('shared.downloading') : t('shared.csvCta')}
          </Button>
        </div>
        {csvError ? (
          <p data-testid="admin-opportunities-csv-error" role="alert" className="mt-2 text-sm text-status-error">
            {t('shared.csvError')}
          </p>
        ) : null}
      </Card>
      {listQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
      {listQuery.isError ? (
        <SectionError testId="admin-opportunities-error" message={t('shared.loadError')} />
      ) : null}
      {listQuery.data ? (
        <p data-testid="admin-opportunities-count" className="text-sm text-ink-muted">
          {t('opportunities.count', { total: listQuery.data.total })}
        </p>
      ) : null}
      {listQuery.data && listQuery.data.items.length === 0 ? (
        <Empty title={t('opportunities.empty')} />
      ) : null}
      {(listQuery.data?.items ?? []).length > 0 ? (
        <Table
          columns={[
            {
              key: 'opportunity',
              header: t('opportunities.title'),
              render: (row: AdminOpportunityRow) => displayTitle(row),
            },
            {
              key: 'status',
              header: t('opportunities.statusLabel'),
              render: (row: AdminOpportunityRow) => (
                <Pill
                  tone={statusTone(
                    typeof row.status === 'string' ? row.status : undefined,
                  )}
                >
                  {typeof row.status === 'string' ? row.status : '—'}
                </Pill>
              ),
            },
            {
              key: 'actions',
              header: '',
              render: (row: AdminOpportunityRow) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid={`admin-opportunity-open-${rowId(row)}`}
                  onClick={() => setSelectedId(rowId(row))}
                >
                  {t('shared.details')}
                </Button>
              ),
            },
          ]}
          rows={listQuery.data?.items ?? []}
          keyOf={(row) => rowId(row)}
        />
      ) : null}
      {listQuery.data ? (
        <div className="flex items-center gap-2">
          {cursorHistory.length > 0 || cursor ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="admin-opportunities-back"
              onClick={goBack}
            >
              {t('shared.prevPage')}
            </Button>
          ) : null}
          {listQuery.data.nextCursor ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="admin-opportunities-next"
              onClick={goNext}
            >
              {t('shared.nextPage')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {selected ? (
        <OpportunityDetail row={selected} onChanged={() => void listQuery.refetch()} />
      ) : null}
    </div>
  );
}
