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
  isAdminUserStatus,
  type AdminOrganizationRow,
} from '@/lib/api/adminLists';
import {
  useAdminOrganizationStatusMutation,
  useAdminOrganizationsCsvMutation,
  useAdminOrganizationsQuery,
  useAdminStatusHistoriesQuery,
} from '@/hooks/useAdminLists';
import { AdminDialog } from '../AdminDialog';

function rowId(row: AdminOrganizationRow): string {
  if (typeof row.id === 'string' && row.id !== '') return row.id;
  if (typeof row._id === 'string') return row._id;
  return '';
}

function displayName(row: AdminOrganizationRow): string {
  if (typeof row.name === 'string' && row.name !== '') return row.name;
  if (typeof row.nameFr === 'string' && row.nameFr !== '') return row.nameFr;
  if (typeof row.nameAr === 'string' && row.nameAr !== '') return row.nameAr;
  if (typeof row.slug === 'string' && row.slug !== '') return row.slug;
  return rowId(row);
}

function statusTone(status: string | null | undefined): PillTone {
  if (status === 'suspended') return 'error';
  return 'neutral';
}

function verificationTone(status: string | null | undefined): PillTone {
  if (status === 'verified') return 'success';
  if (status === 'pending') return 'pending';
  if (status === 'rejected') return 'error';
  return 'neutral';
}

function SectionError({ message, testId }: { message: string; testId: string }) {
  return (
    <p data-testid={testId} role="alert" className="text-sm text-status-error">
      {message}
    </p>
  );
}

function OrganizationDetail({
  row,
  onChanged,
}: {
  row: AdminOrganizationRow;
  onChanged: () => void;
}) {
  const t = useTranslations('adminManage');
  const id = rowId(row);
  const [statusOpen, setStatusOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const historiesQuery = useAdminStatusHistoriesQuery(
    historyOpen ? 'organization' : undefined,
    historyOpen ? id : undefined,
  );
  const statusMutation = useAdminOrganizationStatusMutation();

  const currentStatus = typeof row.status === 'string' ? row.status : '';
  const canChangeStatus =
    currentStatus !== '' &&
    currentStatus !== 'deleted' &&
    isAdminUserStatus(currentStatus);
  const targetStatus = currentStatus === 'suspended' ? 'active' : 'suspended';

  const confirmStatus = () => {
    setFeedback(null);
    statusMutation.mutate(
      { organizationId: id, change: { status: targetStatus, reason, notes } },
      {
        onSuccess: () => {
          setStatusOpen(false);
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
    <Card title={t('organizations.detailTitle')}>
      <div data-testid="admin-organization-detail" className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-ink">{displayName(row)}</p>
        <p className="text-sm text-ink-muted">
          <Pill tone={statusTone(currentStatus)}>{currentStatus}</Pill>{' '}
          <Pill
            tone={verificationTone(
              typeof row.verificationStatus === 'string'
                ? row.verificationStatus
                : undefined,
            )}
          >
            {typeof row.verificationStatus === 'string' ? row.verificationStatus : '—'}
          </Pill>
          {typeof row.registryId === 'string' && row.registryId !== ''
            ? ` · ${row.registryId}`
            : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {canChangeStatus ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="admin-organization-status-open"
              onClick={() => setStatusOpen(true)}
            >
              {targetStatus === 'suspended'
                ? t('organizations.suspendCta')
                : t('organizations.reinstateCta')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="admin-organization-history-toggle"
            onClick={() => setHistoryOpen((open) => !open)}
          >
            {t('organizations.historyCta')}
          </Button>
        </div>
        {feedback ? (
          <p data-testid="admin-organization-feedback" className="text-sm text-ink-muted">
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
                testId="admin-organization-history-error"
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
                  data-testid="admin-organization-history-row"
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
      {statusOpen ? (
        <AdminDialog
          testId="admin-organization-status-dialog"
          title={
            targetStatus === 'suspended'
              ? t('organizations.suspendCta')
              : t('organizations.reinstateCta')
          }
          onClose={() => setStatusOpen(false)}
        >
          <div className="flex flex-col gap-3">
            <Input
              id="admin-organization-reason"
              label={t('shared.reasonLabel')}
              placeholder={t('shared.reasonPlaceholder')}
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
            />
            <Input
              id="admin-organization-notes"
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
              data-testid="admin-organization-status-confirm"
              disabled={statusMutation.isPending}
              onClick={confirmStatus}
            >
              {t('shared.confirm')}
            </Button>
          </div>
        </AdminDialog>
      ) : null}
    </Card>
  );
}

// F15-owned Manage Organizations route: real query power (q/type/location/
// verification/status/sort), totals banners, CSV parity, suspend with
// {reason, notes}, histories. No seal or civic copy.
export function AdminOrganizationsPage() {
  const t = useTranslations('adminManage');
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [wilayaId, setWilayaId] = useState('');
  const [municipalityId, setMunicipalityId] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [status, setStatus] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [csvError, setCsvError] = useState(false);

  const listQuery = useAdminOrganizationsQuery({
    q: q === '' ? undefined : q,
    type: type === '' ? undefined : type,
    wilayaId: wilayaId === '' ? undefined : wilayaId,
    municipalityId: municipalityId === '' ? undefined : municipalityId,
    verificationStatus: verificationStatus === '' ? undefined : verificationStatus,
    status: status === '' ? undefined : status,
    cursor,
  });
  const csvMutation = useAdminOrganizationsCsvMutation();

  const resetPage = () => {
    setCursor(undefined);
    setCursorHistory([]);
  };

  const clearFilters = () => {
    setQ('');
    setType('');
    setWilayaId('');
    setMunicipalityId('');
    setVerificationStatus('');
    setStatus('');
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
        type: type === '' ? undefined : type,
        wilayaId: wilayaId === '' ? undefined : wilayaId,
        municipalityId: municipalityId === '' ? undefined : municipalityId,
        verificationStatus: verificationStatus === '' ? undefined : verificationStatus,
        status: status === '' ? undefined : status,
      },
      { onError: () => setCsvError(true) },
    );
  };

  const selected = (listQuery.data?.items ?? []).find(
    (row) => rowId(row) === selectedId,
  );

  return (
    <div data-testid="admin-organizations" className="flex min-w-0 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t('organizations.title')}</h1>
        <p className="text-sm text-ink-muted">{t('organizations.subtitle')}</p>
      </div>
      <Card title={t('organizations.filtersTitle')}>
        <div
          data-testid="admin-organizations-filters"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Input
            id="admin-organizations-q"
            label={t('shared.searchLabel')}
            placeholder={t('organizations.searchPlaceholder')}
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              resetPage();
            }}
          />
          <Input
            id="admin-organizations-type"
            label={t('organizations.typeLabel')}
            placeholder={t('organizations.typePlaceholder')}
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              resetPage();
            }}
          />
          <Input
            id="admin-organizations-wilaya"
            label={t('organizations.wilayaLabel')}
            value={wilayaId}
            onChange={(event) => {
              setWilayaId(event.target.value);
              resetPage();
            }}
          />
          <Input
            id="admin-organizations-municipality"
            label={t('organizations.municipalityLabel')}
            value={municipalityId}
            onChange={(event) => {
              setMunicipalityId(event.target.value);
              resetPage();
            }}
          />
          <Select
            id="admin-organizations-verification"
            label={t('organizations.verificationLabel')}
            value={verificationStatus}
            onChange={(event) => {
              setVerificationStatus(event.target.value);
              resetPage();
            }}
            options={[
              { value: '', label: t('shared.all') },
              { value: 'pending', label: t('verifications.statusPending') },
              { value: 'verified', label: t('verifications.statusVerified') },
              { value: 'rejected', label: t('verifications.statusRejected') },
            ]}
          />
          <Select
            id="admin-organizations-status"
            label={t('organizations.statusLabel')}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              resetPage();
            }}
            options={[
              { value: '', label: t('shared.all') },
              { value: 'active', label: 'active' },
              { value: 'suspended', label: 'suspended' },
              { value: 'deleted', label: 'deleted' },
            ]}
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
            data-testid="admin-organizations-csv"
            disabled={csvMutation.isPending}
            onClick={onExportCsv}
          >
            {csvMutation.isPending ? t('shared.downloading') : t('shared.csvCta')}
          </Button>
        </div>
        {csvError ? (
          <p data-testid="admin-organizations-csv-error" role="alert" className="mt-2 text-sm text-status-error">
            {t('shared.csvError')}
          </p>
        ) : null}
      </Card>
      {listQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
      {listQuery.isError ? (
        <SectionError testId="admin-organizations-error" message={t('shared.loadError')} />
      ) : null}
      {listQuery.data ? (
        <p data-testid="admin-organizations-count" className="text-sm text-ink-muted">
          {t('organizations.count', { total: listQuery.data.total })}
        </p>
      ) : null}
      {listQuery.data && listQuery.data.items.length === 0 ? (
        <Empty title={t('organizations.empty')} />
      ) : null}
      {(listQuery.data?.items ?? []).length > 0 ? (
        <Table
          columns={[
            {
              key: 'organization',
              header: t('organizations.title'),
              render: (row: AdminOrganizationRow) => displayName(row),
            },
            {
              key: 'verification',
              header: t('organizations.verificationLabel'),
              render: (row: AdminOrganizationRow) => (
                <Pill
                  tone={verificationTone(
                    typeof row.verificationStatus === 'string'
                      ? row.verificationStatus
                      : undefined,
                  )}
                >
                  {typeof row.verificationStatus === 'string'
                    ? row.verificationStatus
                    : '—'}
                </Pill>
              ),
            },
            {
              key: 'status',
              header: t('organizations.statusLabel'),
              render: (row: AdminOrganizationRow) => (
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
              render: (row: AdminOrganizationRow) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid={`admin-organization-open-${rowId(row)}`}
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
              data-testid="admin-organizations-back"
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
              data-testid="admin-organizations-next"
              onClick={goNext}
            >
              {t('shared.nextPage')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {selected ? (
        <OrganizationDetail row={selected} onChanged={() => void listQuery.refetch()} />
      ) : null}
    </div>
  );
}
