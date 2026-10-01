'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { Table } from '@/components/ui/Table';
import {
  isAdminUserStatus,
  type AdminVolunteerRow,
} from '@/lib/api/adminLists';
import {
  useAdminNoticeMutation,
  useAdminStatusHistoriesQuery,
  useAdminUserQuery,
  useAdminUserStatusMutation,
  useAdminVolunteerExperiencesQuery,
  useAdminVolunteersCsvMutation,
  useAdminVolunteersQuery,
} from '@/hooks/useAdminLists';
import { AdminDialog } from '../AdminDialog';

function rowId(row: AdminVolunteerRow): string {
  if (typeof row.id === 'string' && row.id !== '') return row.id;
  if (typeof row._id === 'string') return row._id;
  return '';
}

function accountId(row: AdminVolunteerRow): string {
  if (typeof row.userId === 'string' && row.userId !== '') return row.userId;
  return rowId(row);
}

function displayName(row: AdminVolunteerRow): string {
  const parts = [row.firstName, row.lastName].filter(
    (part): part is string => typeof part === 'string' && part !== '',
  );
  if (parts.length > 0) return parts.join(' ');
  if (typeof row.username === 'string' && row.username !== '') return row.username;
  if (typeof row.email === 'string') return row.email;
  return rowId(row);
}

function statusTone(status: string | null | undefined): PillTone {
  if (status === 'suspended') return 'error';
  return 'neutral';
}

function SectionError({ message, testId }: { message: string; testId: string }) {
  return (
    <p data-testid={testId} role="alert" className="text-sm text-status-error">
      {message}
    </p>
  );
}

function VolunteerDetail({
  row,
  onChanged,
}: {
  row: AdminVolunteerRow;
  onChanged: () => void;
}) {
  const t = useTranslations('adminManage');
  const id = rowId(row);
  const userId = accountId(row);
  const [statusOpen, setStatusOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const accountQuery = useAdminUserQuery(userId === '' ? undefined : userId);
  const experiencesQuery = useAdminVolunteerExperiencesQuery(
    id === '' ? undefined : id,
  );
  const historiesQuery = useAdminStatusHistoriesQuery(
    historyOpen ? 'user' : undefined,
    historyOpen ? userId : undefined,
  );
  const statusMutation = useAdminUserStatusMutation();
  const noticeMutation = useAdminNoticeMutation();

  const accountStatus =
    typeof accountQuery.data?.status === 'string'
      ? accountQuery.data.status
      : typeof row.status === 'string'
        ? row.status
        : '';
  const canChangeStatus =
    accountStatus !== '' &&
    accountStatus !== 'deleted' &&
    isAdminUserStatus(accountStatus);
  const targetStatus = accountStatus === 'suspended' ? 'active' : 'suspended';
  const latest = experiencesQuery.data?.items[0];
  const skillNames = Array.isArray(row.skillNames)
    ? row.skillNames
    : Array.isArray(row.skills)
      ? row.skills
      : [];

  const confirmStatus = () => {
    setFeedback(null);
    statusMutation.mutate(
      { userId, change: { status: targetStatus, reason, notes } },
      {
        onSuccess: () => {
          setStatusOpen(false);
          setReason('');
          setNotes('');
          setFeedback(t('shared.actionSuccess'));
          onChanged();
          void accountQuery.refetch();
        },
        onError: () => setFeedback(t('shared.actionError')),
      },
    );
  };

  const confirmNotice = () => {
    if (message.trim() === '') return;
    setFeedback(null);
    noticeMutation.mutate(
      { userId, message },
      {
        onSuccess: () => {
          setNoticeOpen(false);
          setMessage('');
          setFeedback(t('volunteers.noticeSent'));
        },
        onError: () => setFeedback(t('shared.actionError')),
      },
    );
  };

  return (
    <Card title={t('volunteers.detailTitle')}>
      <div data-testid="admin-volunteer-detail" className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-ink">{displayName(row)}</p>
        <p className="text-sm text-ink-muted">
          {typeof row.email === 'string' ? row.email : null}
          {typeof row.registryId === 'string' && row.registryId !== ''
            ? ` · ${row.registryId}`
            : null}
        </p>
        <p className="text-sm text-ink-muted">
          <Pill tone={statusTone(accountStatus)}>{accountStatus}</Pill>{' '}
          {typeof row.emailVerifiedAt === 'string' && row.emailVerifiedAt !== ''
            ? t('volunteers.emailVerified')
            : t('volunteers.emailUnverified')}
        </p>
        {typeof row.lastActivityAt === 'string' && row.lastActivityAt !== '' ? (
          <p className="text-sm text-ink-muted">
            {t('volunteers.lastActive', { date: row.lastActivityAt })}
          </p>
        ) : null}
        {skillNames.length > 0 ? (
          <p className="text-sm text-ink-muted">
            {t('volunteers.skillsLabel')}: {skillNames.join(', ')}
          </p>
        ) : null}
        <div>
          <h3 className="text-sm font-semibold text-ink">
            {t('volunteers.engagementTitle')}
          </h3>
          {experiencesQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
          {experiencesQuery.isError ? (
            <SectionError
              testId="admin-volunteer-engagement-error"
              message={t('shared.loadError')}
            />
          ) : null}
          {experiencesQuery.data && !latest ? (
            <p
              data-testid="admin-volunteer-engagement-empty"
              className="text-sm text-ink-muted"
            >
              {t('volunteers.engagementEmpty')}
            </p>
          ) : null}
          {latest ? (
            <p data-testid="admin-volunteer-engagement" className="text-sm text-ink-muted">
              {typeof latest.title === 'string' ? latest.title : null}
              {typeof latest.registryId === 'string' && latest.registryId !== ''
                ? ` · ${latest.registryId}`
                : null}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canChangeStatus ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="admin-volunteer-status-open"
              onClick={() => setStatusOpen(true)}
            >
              {targetStatus === 'suspended'
                ? t('volunteers.suspendCta')
                : t('volunteers.reinstateCta')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="admin-volunteer-notice-open"
            onClick={() => setNoticeOpen(true)}
          >
            {t('volunteers.noticeCta')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="admin-volunteer-history-toggle"
            onClick={() => setHistoryOpen((open) => !open)}
          >
            {t('volunteers.historyCta')}
          </Button>
        </div>
        {feedback ? (
          <p data-testid="admin-volunteer-feedback" className="text-sm text-ink-muted">
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
                testId="admin-volunteer-history-error"
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
                  data-testid="admin-volunteer-history-row"
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
          testId="admin-volunteer-status-dialog"
          title={
            targetStatus === 'suspended'
              ? t('volunteers.suspendCta')
              : t('volunteers.reinstateCta')
          }
          onClose={() => setStatusOpen(false)}
        >
          <div className="flex flex-col gap-3">
            <Input
              id="admin-volunteer-reason"
              label={t('shared.reasonLabel')}
              placeholder={t('shared.reasonPlaceholder')}
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
            />
            <Input
              id="admin-volunteer-notes"
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
              data-testid="admin-volunteer-status-confirm"
              disabled={statusMutation.isPending}
              onClick={confirmStatus}
            >
              {t('shared.confirm')}
            </Button>
          </div>
        </AdminDialog>
      ) : null}
      {noticeOpen ? (
        <AdminDialog
          testId="admin-volunteer-notice-dialog"
          title={t('volunteers.noticeTitle')}
          onClose={() => setNoticeOpen(false)}
        >
          <div className="flex flex-col gap-3">
            <Input
              id="admin-volunteer-notice-message"
              label={t('volunteers.noticeLabel')}
              placeholder={t('volunteers.noticePlaceholder')}
              value={message}
              maxLength={1000}
              onChange={(event) => setMessage(event.target.value)}
              error={message.trim() === '' ? t('volunteers.noticeRequired') : undefined}
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              data-testid="admin-volunteer-notice-confirm"
              disabled={noticeMutation.isPending || message.trim() === ''}
              onClick={confirmNotice}
            >
              {t('shared.confirm')}
            </Button>
          </div>
        </AdminDialog>
      ) : null}
    </Card>
  );
}

// F15-owned Manage Volunteers route: real query power (q/location/skill/
// date window), totals banners, CSV parity, latest-engagement read, suspend
// with {reason, notes}, system notice, histories. Real vocabularies only
// (active|suspended|deleted) — no invented states.
export function AdminVolunteersPage() {
  const t = useTranslations('adminManage');
  const [q, setQ] = useState('');
  const [wilayaId, setWilayaId] = useState('');
  const [municipalityId, setMunicipalityId] = useState('');
  const [skillId, setSkillId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [csvError, setCsvError] = useState(false);

  const filters = {
    q: q === '' ? undefined : q,
    wilayaId: wilayaId === '' ? undefined : wilayaId,
    municipalityId: municipalityId === '' ? undefined : municipalityId,
    skillId: skillId === '' ? undefined : skillId,
    from: from === '' ? undefined : from,
    to: to === '' ? undefined : to,
    cursor,
  };
  const listQuery = useAdminVolunteersQuery(filters);
  const csvMutation = useAdminVolunteersCsvMutation();

  const resetPage = () => {
    setCursor(undefined);
    setCursorHistory([]);
  };

  const clearFilters = () => {
    setQ('');
    setWilayaId('');
    setMunicipalityId('');
    setSkillId('');
    setFrom('');
    setTo('');
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
        wilayaId: wilayaId === '' ? undefined : wilayaId,
        municipalityId: municipalityId === '' ? undefined : municipalityId,
        skillId: skillId === '' ? undefined : skillId,
        from: from === '' ? undefined : from,
        to: to === '' ? undefined : to,
      },
      { onError: () => setCsvError(true) },
    );
  };

  const selected = (listQuery.data?.items ?? []).find(
    (row) => rowId(row) === selectedId,
  );

  return (
    <div data-testid="admin-volunteers" className="flex min-w-0 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t('volunteers.title')}</h1>
        <p className="text-sm text-ink-muted">{t('volunteers.subtitle')}</p>
      </div>
      <Card title={t('volunteers.filtersTitle')}>
        <div
          data-testid="admin-volunteers-filters"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Input
            id="admin-volunteers-q"
            label={t('shared.searchLabel')}
            placeholder={t('volunteers.searchPlaceholder')}
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              resetPage();
            }}
          />
          <Input
            id="admin-volunteers-wilaya"
            label={t('volunteers.wilayaLabel')}
            placeholder={t('volunteers.wilayaPlaceholder')}
            value={wilayaId}
            onChange={(event) => {
              setWilayaId(event.target.value);
              resetPage();
            }}
          />
          <Input
            id="admin-volunteers-municipality"
            label={t('volunteers.municipalityLabel')}
            placeholder={t('volunteers.municipalityPlaceholder')}
            value={municipalityId}
            onChange={(event) => {
              setMunicipalityId(event.target.value);
              resetPage();
            }}
          />
          <Input
            id="admin-volunteers-skill"
            label={t('volunteers.skillLabel')}
            placeholder={t('volunteers.skillPlaceholder')}
            value={skillId}
            onChange={(event) => {
              setSkillId(event.target.value);
              resetPage();
            }}
          />
          <Input
            id="admin-volunteers-from"
            label={t('volunteers.fromLabel')}
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              resetPage();
            }}
          />
          <Input
            id="admin-volunteers-to"
            label={t('volunteers.toLabel')}
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
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
            data-testid="admin-volunteers-csv"
            disabled={csvMutation.isPending}
            onClick={onExportCsv}
          >
            {csvMutation.isPending ? t('shared.downloading') : t('shared.csvCta')}
          </Button>
        </div>
        {csvError ? (
          <p data-testid="admin-volunteers-csv-error" role="alert" className="mt-2 text-sm text-status-error">
            {t('shared.csvError')}
          </p>
        ) : null}
      </Card>
      {listQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
      {listQuery.isError ? (
        <SectionError testId="admin-volunteers-error" message={t('shared.loadError')} />
      ) : null}
      {listQuery.data ? (
        <p data-testid="admin-volunteers-count" className="text-sm text-ink-muted">
          {t('volunteers.count', { total: listQuery.data.total })}
        </p>
      ) : null}
      {listQuery.data && listQuery.data.items.length === 0 ? (
        <Empty title={t('volunteers.empty')} />
      ) : null}
      {(listQuery.data?.items ?? []).length > 0 ? (
        <Table
          columns={[
            {
              key: 'volunteer',
              header: t('volunteers.title'),
              render: (row: AdminVolunteerRow) => displayName(row),
            },
            {
              key: 'status',
              header: t('organizations.statusLabel'),
              render: (row: AdminVolunteerRow) => (
                <Pill tone={statusTone(typeof row.status === 'string' ? row.status : undefined)}>
                  {typeof row.status === 'string' ? row.status : '—'}
                </Pill>
              ),
            },
            {
              key: 'actions',
              header: '',
              render: (row: AdminVolunteerRow) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid={`admin-volunteer-open-${rowId(row)}`}
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
              data-testid="admin-volunteers-back"
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
              data-testid="admin-volunteers-next"
              onClick={goNext}
            >
              {t('shared.nextPage')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {selected ? (
        <VolunteerDetail row={selected} onChanged={() => void listQuery.refetch()} />
      ) : null}
    </div>
  );
}
