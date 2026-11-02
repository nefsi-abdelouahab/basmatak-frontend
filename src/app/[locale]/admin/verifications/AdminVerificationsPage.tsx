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
import type { AdminVerificationRow } from '@/lib/api/adminLists';
import {
  useAdminDossierMediaQuery,
  useAdminLatestDossierQuery,
  useAdminVerificationApproveMutation,
  useAdminVerificationAssignMutation,
  useAdminVerificationRejectMutation,
  useAdminVerificationsQuery,
} from '@/hooks/useAdminLists';
import { AdminDialog } from '../AdminDialog';

function rowId(row: AdminVerificationRow): string {
  if (typeof row.id === 'string' && row.id !== '') return row.id;
  if (typeof row._id === 'string') return row._id;
  if (typeof row.rowId === 'string') return row.rowId;
  return '';
}

function organizationId(row: AdminVerificationRow): string {
  const org = row.organization;
  if (org && typeof org === 'object') {
    if (typeof (org as { id?: unknown }).id === 'string')
      return (org as { id: string }).id;
    if (typeof (org as { _id?: unknown })._id === 'string')
      return (org as { _id: string })._id;
  }
  return '';
}

function organizationName(row: AdminVerificationRow): string {
  const org = row.organization;
  if (org && typeof org === 'object') {
    const named = org as { name?: unknown; nameFr?: unknown; nameAr?: unknown; slug?: unknown };
    if (typeof named.name === 'string' && named.name !== '') return named.name;
    if (typeof named.nameFr === 'string' && named.nameFr !== '') return named.nameFr;
    if (typeof named.nameAr === 'string' && named.nameAr !== '') return named.nameAr;
    if (typeof named.slug === 'string' && named.slug !== '') return named.slug;
  }
  return rowId(row);
}

function queueTone(status: string | null | undefined): PillTone {
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

function DossierDocument({ mediaId }: { mediaId: string }) {
  const t = useTranslations('adminManage');
  const mediaQuery = useAdminDossierMediaQuery(mediaId);
  if (mediaQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (mediaQuery.isError) return null;
  const url = typeof mediaQuery.data?.url === 'string' ? mediaQuery.data.url : '';
  if (url === '') return null;
  return (
    <a
      data-testid={`admin-verification-document-${mediaId}`}
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-sm text-gold-strong hover:underline"
    >
      {t('verifications.documentLink')}
    </a>
  );
}

function VerificationDetail({
  row,
  onChanged,
}: {
  row: AdminVerificationRow;
  onChanged: () => void;
}) {
  const t = useTranslations('adminManage');
  const id = rowId(row);
  const orgId = organizationId(row);
  const [assignOpen, setAssignOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [assignedAdminId, setAssignedAdminId] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const dossierQuery = useAdminLatestDossierQuery(orgId === '' ? undefined : orgId);
  const assignMutation = useAdminVerificationAssignMutation();
  const approveMutation = useAdminVerificationApproveMutation();
  const rejectMutation = useAdminVerificationRejectMutation();

  const isPending = row.status === 'pending';
  const documents = Array.isArray(dossierQuery.data?.documents)
    ? (dossierQuery.data.documents as unknown[]).filter(
        (doc): doc is string => typeof doc === 'string' && doc !== '',
      )
    : [];

  const confirmAssign = () => {
    if (assignedAdminId.trim() === '') return;
    setFeedback(null);
    assignMutation.mutate(
      { rowId: id, assignedAdminId: assignedAdminId.trim() },
      {
        onSuccess: () => {
          setAssignOpen(false);
          setAssignedAdminId('');
          setFeedback(t('shared.actionSuccess'));
          onChanged();
        },
        onError: () => setFeedback(t('shared.actionError')),
      },
    );
  };

  const confirmApprove = () => {
    setFeedback(null);
    approveMutation.mutate(orgId, {
      onSuccess: () => {
        setApproveOpen(false);
        setFeedback(t('verifications.approved'));
        onChanged();
        void dossierQuery.refetch();
      },
      onError: () => setFeedback(t('shared.actionError')),
    });
  };

  const confirmReject = () => {
    if (rejectionReason.trim() === '') return;
    setFeedback(null);
    rejectMutation.mutate(
      { organizationId: orgId, rejectionReason },
      {
        onSuccess: () => {
          setRejectOpen(false);
          setRejectionReason('');
          setFeedback(t('verifications.rejected'));
          onChanged();
          void dossierQuery.refetch();
        },
        onError: () => setFeedback(t('shared.actionError')),
      },
    );
  };

  return (
    <Card title={t('verifications.dossierTitle')}>
      <div data-testid="admin-verification-dossier" className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-ink">{organizationName(row)}</p>
        {dossierQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {dossierQuery.isError ? (
          <p
            data-testid="admin-verification-dossier-empty"
            className="text-sm text-ink-muted"
          >
            {t('verifications.dossierEmpty')}
          </p>
        ) : null}
        {dossierQuery.data ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-ink-muted">
              {t('verifications.documentsLabel')}: {documents.length}
            </p>
            {documents.map((mediaId) => (
              <DossierDocument key={mediaId} mediaId={mediaId} />
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="admin-verification-assign-open"
            onClick={() => setAssignOpen(true)}
          >
            {t('verifications.assignCta')}
          </Button>
          {isPending ? (
            <>
              <Button
                type="button"
                variant="primary"
                size="sm"
                data-testid="admin-verification-approve-open"
                onClick={() => setApproveOpen(true)}
              >
                {t('verifications.approveCta')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                data-testid="admin-verification-reject-open"
                onClick={() => setRejectOpen(true)}
              >
                {t('verifications.rejectCta')}
              </Button>
            </>
          ) : null}
        </div>
        {feedback ? (
          <p data-testid="admin-verification-feedback" className="text-sm text-ink-muted">
            {feedback}
          </p>
        ) : null}
      </div>
      {assignOpen ? (
        <AdminDialog
          testId="admin-verification-assign-dialog"
          title={t('verifications.assignTitle')}
          onClose={() => setAssignOpen(false)}
        >
          <div className="flex flex-col gap-3">
            <Input
              id="admin-verification-assign-admin"
              label={t('verifications.assignLabel')}
              placeholder={t('verifications.assignPlaceholder')}
              value={assignedAdminId}
              onChange={(event) => setAssignedAdminId(event.target.value)}
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              data-testid="admin-verification-assign-confirm"
              disabled={assignMutation.isPending || assignedAdminId.trim() === ''}
              onClick={confirmAssign}
            >
              {t('shared.confirm')}
            </Button>
          </div>
        </AdminDialog>
      ) : null}
      {approveOpen ? (
        <AdminDialog
          testId="admin-verification-approve-dialog"
          title={t('verifications.approveTitle')}
          onClose={() => setApproveOpen(false)}
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-muted">{t('verifications.approveBody')}</p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              data-testid="admin-verification-approve-confirm"
              disabled={approveMutation.isPending}
              onClick={confirmApprove}
            >
              {t('shared.confirm')}
            </Button>
          </div>
        </AdminDialog>
      ) : null}
      {rejectOpen ? (
        <AdminDialog
          testId="admin-verification-reject-dialog"
          title={t('verifications.rejectTitle')}
          onClose={() => setRejectOpen(false)}
        >
          <div className="flex flex-col gap-3">
            <Input
              id="admin-verification-reject-reason"
              label={t('verifications.rejectReasonLabel')}
              placeholder={t('verifications.rejectReasonPlaceholder')}
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              error={
                rejectionReason.trim() === ''
                  ? t('verifications.rejectRequired')
                  : undefined
              }
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              data-testid="admin-verification-reject-confirm"
              disabled={rejectMutation.isPending || rejectionReason.trim() === ''}
              onClick={confirmReject}
            >
              {t('shared.confirm')}
            </Button>
          </div>
        </AdminDialog>
      ) : null}
    </Card>
  );
}

// F15-owned Verification Triage route: pending-first FIFO queue, officer
// assignment, latest-dossier read, neutral approve / reject-with-reason.
// "Request Info" and "Grant Law 12-06 Seal" stay deleted.
export function AdminVerificationsPage() {
  const t = useTranslations('adminManage');
  const [status, setStatus] = useState('pending');
  const [assignedAdminId, setAssignedAdminId] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const listQuery = useAdminVerificationsQuery({
    status: status === '' ? 'pending' : status,
    assignedAdminId: assignedAdminId === '' ? undefined : assignedAdminId,
    cursor,
  });

  const resetPage = () => {
    setCursor(undefined);
    setCursorHistory([]);
  };

  const clearFilters = () => {
    setStatus('pending');
    setAssignedAdminId('');
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

  const selected = (listQuery.data?.items ?? []).find(
    (row) => rowId(row) === selectedId,
  );

  return (
    <div data-testid="admin-verifications" className="flex min-w-0 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t('verifications.title')}</h1>
        <p className="text-sm text-ink-muted">{t('verifications.subtitle')}</p>
      </div>
      <Card title={t('verifications.filtersTitle')}>
        <div
          data-testid="admin-verifications-filters"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <Select
            id="admin-verifications-status"
            label={t('verifications.statusLabel')}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              resetPage();
            }}
            options={[
              { value: 'pending', label: t('verifications.statusPending') },
              { value: 'verified', label: t('verifications.statusVerified') },
              { value: 'rejected', label: t('verifications.statusRejected') },
            ]}
          />
          <Input
            id="admin-verifications-assignee"
            label={t('verifications.assigneeLabel')}
            placeholder={t('verifications.assigneePlaceholder')}
            value={assignedAdminId}
            onChange={(event) => {
              setAssignedAdminId(event.target.value);
              resetPage();
            }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            {t('shared.clearFilters')}
          </Button>
        </div>
      </Card>
      {listQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
      {listQuery.isError ? (
        <SectionError testId="admin-verifications-error" message={t('shared.loadError')} />
      ) : null}
      {listQuery.data ? (
        <p data-testid="admin-verifications-count" className="text-sm text-ink-muted">
          {t('verifications.count', { total: listQuery.data.total })}
        </p>
      ) : null}
      {listQuery.data && listQuery.data.items.length === 0 ? (
        <Empty title={t('verifications.empty')} />
      ) : null}
      {(listQuery.data?.items ?? []).length > 0 ? (
        <Table
          columns={[
            {
              key: 'organization',
              header: t('organizations.title'),
              render: (row: AdminVerificationRow) => organizationName(row),
            },
            {
              key: 'status',
              header: t('verifications.statusLabel'),
              render: (row: AdminVerificationRow) => (
                <Pill
                  tone={queueTone(
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
              render: (row: AdminVerificationRow) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid={`admin-verification-open-${rowId(row)}`}
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
              data-testid="admin-verifications-back"
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
              data-testid="admin-verifications-next"
              onClick={goNext}
            >
              {t('shared.nextPage')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {selected ? (
        <VerificationDetail row={selected} onChanged={() => void listQuery.refetch()} />
      ) : null}
    </div>
  );
}
