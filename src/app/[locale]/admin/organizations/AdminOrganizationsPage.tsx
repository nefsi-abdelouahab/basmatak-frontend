'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  Building2,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Gavel,
  Hash,
  History,
  Image as ImageIcon,
  LocateFixed,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  UserCheck,
  X,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { ScrollFade } from '@/components/ui/ScrollFade';
import { Select } from '@/components/ui/Select';
import {
  isAdminUserStatus,
  type AdminOrganizationRow,
  type AdminVerificationRow,
} from '@/lib/api/adminLists';
import {
  useAdminDossierMediaQuery,
  useAdminLatestDossierQuery,
  useAdminOrganizationsCsvMutation,
  useAdminOrganizationsQuery,
  useAdminOrganizationStatusMutation,
  useAdminStatusHistoriesQuery,
  useAdminUserQuery,
  useAdminVerificationApproveMutation,
  useAdminVerificationAssignMutation,
  useAdminVerificationRejectMutation,
} from '@/hooks/useAdminLists';
import { AdminDialog } from '../AdminDialog';

// Manage Organizations master-detail screen. The Admin Workspace shell
// (sidebar with Organizations under Management) renders above this page, so
// only the workspace content lives here: breadcrumb, header with CSV export,
// four stat cards bound to real list totals, the filter bar, the org table,
// and the detail side panel (right-side fixed panel on xl screens, full
// overlay drawer below that). Every field traces to GET
// /admin/organizations, GET .../verification/latest, GET /media/:mediaId,
// GET /admin/users/:userId, or GET /admin/status-histories. Paging follows
// the real cursor contract (previous/next plus page/pages totals); the
// numbered pager from the mockup has no matching backend shape.

type RowExtras = Record<string, unknown>;

function extrasOf(row: AdminOrganizationRow): RowExtras {
  return row as unknown as RowExtras;
}

function rowId(row: AdminOrganizationRow): string {
  if (typeof row.id === 'string' && row.id !== '') return row.id;
  if (typeof row._id === 'string') return row._id;
  return '';
}

function dossierRowId(row: AdminVerificationRow): string {
  if (typeof row.id === 'string' && row.id !== '') return row.id;
  if (typeof row._id === 'string') return row._id;
  if (typeof row.rowId === 'string') return row.rowId;
  return '';
}

function textOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function displayName(row: AdminOrganizationRow): string {
  return (
    textOf(row.name) ??
    textOf(row.nameFr) ??
    textOf(row.nameAr) ??
    textOf(row.slug) ??
    rowId(row)
  );
}

function mediaIdOf(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (value !== null && typeof value === 'object') {
    const oid = (value as { $oid?: unknown }).$oid;
    if (typeof oid === 'string' && oid !== '') return oid;
  }
  return undefined;
}

function logoMediaIdOf(row: AdminOrganizationRow): string | undefined {
  const extras = extrasOf(row);
  return (
    mediaIdOf(extras.logoMediaId) ?? mediaIdOf(extras.coverMediaId) ?? undefined
  );
}

function locationOf(row: AdminOrganizationRow): string {
  const extras = extrasOf(row);
  const location =
    extras.location !== null && typeof extras.location === 'object'
      ? (extras.location as Record<string, unknown>)
      : {};
  const wilaya =
    textOf(row.wilayaName) ?? textOf(location.wilayaId) ?? undefined;
  const municipality =
    textOf(row.municipalityName) ?? textOf(location.municipalityId) ?? undefined;
  return [wilaya, municipality].filter((part) => part !== undefined).join(', ');
}

function contactOf(row: AdminOrganizationRow): { email?: string; phone?: string } {
  const extras = extrasOf(row);
  const contact =
    extras.contact !== null && typeof extras.contact === 'object'
      ? (extras.contact as Record<string, unknown>)
      : {};
  return { email: textOf(contact.email), phone: textOf(contact.phone) };
}

function adminDisplayName(value: unknown, fallback: string): string {
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const name = textOf(record.name);
    if (name) return name;
    const first = textOf(record.firstName);
    const last = textOf(record.lastName);
    if (first ?? last) return [first, last].filter(Boolean).join(' ');
    const email = textOf(record.email);
    if (email) return email;
  }
  if (typeof value === 'string' && value !== '') return value;
  return fallback;
}

function formatDate(value: unknown, locale: string): string {
  if (typeof value !== 'string' || value === '') return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatBytes(value: unknown): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function SectionError({ message, testId }: { message: string; testId: string }) {
  return (
    <p data-testid={testId} role="alert" className="text-sm text-status-error">
      {message}
    </p>
  );
}

function VerificationMark({ value }: { value: string }) {
  const t = useTranslations('adminManage');
  if (value === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-status-success">
        <BadgeCheck size={14} aria-hidden="true" className="shrink-0" />
        <span>{t('verifications.statusVerified')}</span>
      </span>
    );
  }
  if (value === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-status-error">
        <X size={14} aria-hidden="true" className="shrink-0" />
        <span>{t('verifications.statusRejected')}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm text-status-pending">
      <Clock size={14} aria-hidden="true" className="shrink-0" />
      <span>{t('verifications.statusPending')}</span>
    </span>
  );
}

function OrgAvatar({
  mediaId,
  large,
}: {
  mediaId?: string;
  large?: boolean;
}) {
  const mediaQuery = useAdminDossierMediaQuery(mediaId);
  const resolved =
    typeof mediaQuery.data?.url === 'string' && mediaQuery.data.url !== ''
      ? mediaQuery.data.url
      : '/org.png';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt=""
      aria-hidden="true"
      onError={(event) => {
        if (!event.currentTarget.src.endsWith('/org.png')) {
          event.currentTarget.src = '/org.png';
        }
      }}
      className={
        large
          ? 'h-12 w-12 shrink-0 rounded-xl bg-surface-muted object-cover'
          : 'h-8 w-8 shrink-0 rounded-lg bg-surface-muted object-cover'
      }
    />
  );
}

function StatCard({
  testId,
  icon,
  label,
  value,
  pending,
}: {
  testId: string;
  icon: ReactNode;
  label: string;
  value: number | undefined;
  pending: boolean;
}) {
  return (
    <div
      data-testid={testId}
      className="rounded-lg border border-border bg-surface p-4 shadow-sm"
    >
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
        <span>{label}</span>
      </p>
      <p className="mt-1 text-2xl font-bold text-ink">
        {pending ? '…' : (value ?? 0)}
      </p>
    </div>
  );
}

function FactTile({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-border-muted bg-surface p-2 text-start">
      <span className="flex items-center gap-1 text-xs text-ink-muted">
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </span>
      <span className="mt-0.5 truncate text-sm font-medium text-ink">
        {children}
      </span>
    </div>
  );
}

function DossierDocumentRow({ mediaId }: { mediaId: string }) {
  const t = useTranslations('adminManage');
  const mediaQuery = useAdminDossierMediaQuery(mediaId);
  if (mediaQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (mediaQuery.isError) return null;
  const media =
    mediaQuery.data?.media !== null && typeof mediaQuery.data?.media === 'object'
      ? (mediaQuery.data?.media as Record<string, unknown>)
      : {};
  const filename = textOf(media.filename) ?? mediaId;
  const size = formatBytes(media.size);
  const mime = textOf(media.mimeType) ?? '';
  const url =
    typeof mediaQuery.data?.url === 'string' ? mediaQuery.data.url : '';
  if (url === '') return null;
  const DocIcon = mime.startsWith('image/') ? ImageIcon : FileText;
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border-muted bg-surface p-2">
      <div className="flex min-w-0 items-center gap-2">
        <DocIcon size={20} aria-hidden="true" className="shrink-0 text-ink-muted" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-ink">{filename}</span>
          <span className="truncate text-xs text-ink-muted">
            {size ? `${mime !== '' ? `${mime} · ` : ''}${size}` : (mime !== '' ? mime : t('organizations.documentsTitle'))}
          </span>
        </div>
      </div>
      <a
        data-testid={`admin-organization-document-${mediaId}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="ms-2 inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-gold-strong hover:underline"
      >
        {t('verifications.documentLink')}
        <Eye size={13} aria-hidden="true" />
      </a>
    </div>
  );
}

function OrganizationPanel({
  row,
  onChanged,
  onClose,
}: {
  row: AdminOrganizationRow;
  onChanged: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('adminManage');
  const locale = useLocale();
  const id = rowId(row);
  const extras = extrasOf(row);
  const name = displayName(row);
  const registryId = textOf(row.registryId);
  const verificationStatus =
    typeof row.verificationStatus === 'string' ? row.verificationStatus : '';
  const accountStatus = typeof row.status === 'string' ? row.status : '';
  const slug = textOf(row.slug);
  const description = textOf(extras.description);
  const contact = contactOf(row);
  const website = textOf(extras.website);
  const foundedYear =
    typeof extras.foundedYear === 'number' ? String(extras.foundedYear) : undefined;
  const type = textOf(row.type);
  const place = locationOf(row);

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [assignedAdminId, setAssignedAdminId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const dossierQuery = useAdminLatestDossierQuery(id === '' ? undefined : id);
  const dossier = dossierQuery.data;
  const dossierStatus = typeof dossier?.status === 'string' ? dossier.status : '';
  const documents = Array.isArray(dossier?.documents)
    ? (dossier?.documents as unknown[]).filter(
        (doc): doc is string => typeof doc === 'string' && doc !== '',
      )
    : [];
  const dossierAssignee =
    typeof dossier?.assignedAdminId === 'string' && dossier.assignedAdminId !== ''
      ? dossier.assignedAdminId
      : undefined;
  const assigneeQuery = useAdminUserQuery(dossierAssignee);
  const historiesQuery = useAdminStatusHistoriesQuery(
    historyOpen ? 'organization' : undefined,
    historyOpen ? id : undefined,
  );
  const approveMutation = useAdminVerificationApproveMutation();
  const rejectMutation = useAdminVerificationRejectMutation();
  const assignMutation = useAdminVerificationAssignMutation();
  const statusMutation = useAdminOrganizationStatusMutation();

  const canDecide = dossierStatus === 'pending';
  const currentStatus = accountStatus;
  const canChangeStatus =
    currentStatus !== '' &&
    currentStatus !== 'deleted' &&
    isAdminUserStatus(currentStatus);
  const targetStatus = currentStatus === 'suspended' ? 'active' : 'suspended';

  const reread = () => {
    onChanged();
    void dossierQuery.refetch();
  };

  const confirmApprove = () => {
    setFeedback(null);
    approveMutation.mutate(id, {
      onSuccess: () => {
        setApproveOpen(false);
        setFeedback(t('verifications.approved'));
        reread();
      },
      onError: () => setFeedback(t('shared.actionError')),
    });
  };

  const confirmReject = () => {
    if (rejectionReason.trim() === '') return;
    setFeedback(null);
    rejectMutation.mutate(
      { organizationId: id, rejectionReason },
      {
        onSuccess: () => {
          setRejectOpen(false);
          setRejectionReason('');
          setFeedback(t('verifications.rejected'));
          reread();
        },
        onError: () => setFeedback(t('shared.actionError')),
      },
    );
  };

  const confirmAssign = () => {
    if (assignedAdminId.trim() === '' || dossierRowId(dossier as AdminVerificationRow) === '') {
      return;
    }
    setFeedback(null);
    assignMutation.mutate(
      {
        rowId: dossier ? dossierRowId(dossier) : '',
        assignedAdminId: assignedAdminId.trim(),
      },
      {
        onSuccess: () => {
          setAssignOpen(false);
          setAssignedAdminId('');
          setFeedback(t('shared.actionSuccess'));
          reread();
        },
        onError: () => setFeedback(t('shared.actionError')),
      },
    );
  };

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
          reread();
        },
        onError: () => setFeedback(t('shared.actionError')),
      },
    );
  };

  return (
    <Card
      title={
        <span className="flex items-center justify-between gap-2">
          <span>{t('organizations.detailTitle')}</span>
          <button
            type="button"
            data-testid="admin-organization-detail-close"
            aria-label={t('organizations.detailClose')}
            onClick={onClose}
            className="rounded-md p-1 text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </span>
      }
    >
      <div data-testid="admin-organization-detail" className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3 border-b border-border-muted pb-3">
          <div className="flex min-w-0 items-start gap-3">
            <OrgAvatar mediaId={logoMediaIdOf(row)} large />
            <div className="flex min-w-0 flex-col">
              <h2 className="break-words text-lg font-semibold leading-tight text-ink">
                {name}
              </h2>
              <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-muted">
                <Hash size={12} aria-hidden="true" className="shrink-0" />
                <span className="truncate">
                  {[registryId ?? '—', place !== '' ? place : undefined]
                    .filter((part) => part !== undefined)
                    .join(' · ')}
                </span>
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
                <Calendar size={12} aria-hidden="true" className="shrink-0" />
                <span>
                  {t('organizations.submittedLabel')}:{' '}
                  {dossierQuery.isPending
                    ? '…'
                    : formatDate(
                        (dossier as unknown as Record<string, unknown> | undefined)
                          ?.submittedAt,
                        locale,
                      )}
                </span>
              </span>
            </div>
          </div>
          {slug ? (
            <Link
              href={`/orgs/${slug}`}
              data-testid="admin-organization-profile-link"
              className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-gold-strong hover:underline"
            >
              {t('organizations.profileCta')}
              <ExternalLink size={13} aria-hidden="true" />
            </Link>
          ) : null}
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-border-muted bg-surface-muted p-3">
          {verificationStatus === 'verified' ? (
            <BadgeCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-status-success" />
          ) : verificationStatus === 'rejected' ? (
            <X size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-status-error" />
          ) : (
            <Gavel size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-status-pending" />
          )}
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold text-ink">
              {verificationStatus === 'verified'
                ? t('organizations.bannerVerifiedTitle')
                : verificationStatus === 'rejected'
                  ? t('organizations.bannerRejectedTitle')
                  : t('organizations.bannerPendingTitle')}
            </span>
            <p className="mt-0.5 text-sm leading-snug text-ink-muted">
              {verificationStatus === 'verified'
                ? t('organizations.bannerVerifiedBody')
                : verificationStatus === 'rejected'
                  ? (textOf(
                      (dossier as unknown as Record<string, unknown> | undefined)
                        ?.rejectionReason,
                    ) ?? t('organizations.bannerRejectedTitle'))
                  : t('organizations.bannerPendingBody')}
            </p>
          </div>
        </div>

        <div className="flex flex-col">
          <span className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-muted">
            {t('organizations.mandateTitle')}
          </span>
          <p className="rounded-lg border border-border-muted bg-surface p-2.5 text-sm leading-relaxed text-ink">
            {description ?? t('organizations.noDescription')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-start">
          <FactTile icon={<Hash size={13} />} label={t('organizations.registryLabel')}>
            {registryId ?? '—'}
          </FactTile>
          <FactTile icon={<Tag size={13} />} label={t('organizations.typeLabel')}>
            {type ?? '—'}
          </FactTile>
          <FactTile icon={<MapPin size={13} />} label={t('organizations.locationLabel')}>
            {place !== '' ? place : '—'}
          </FactTile>
          <FactTile icon={<ShieldCheck size={13} />} label={t('organizations.accountStatusLabel')}>
            {accountStatus !== '' ? accountStatus : '—'}
          </FactTile>
          <FactTile icon={<Mail size={13} />} label={t('organizations.emailLabel')}>
            {contact.email ? (
              <a href={`mailto:${contact.email}`} className="text-gold-strong hover:underline">
                {contact.email}
              </a>
            ) : (
              '—'
            )}
          </FactTile>
          <FactTile icon={<Phone size={13} />} label={t('organizations.phoneLabel')}>
            {contact.phone ?? '—'}
          </FactTile>
          <FactTile icon={<ExternalLink size={13} />} label={t('organizations.websiteLabel')}>
            {website ? (
              <a
                href={website}
                target="_blank"
                rel="noreferrer"
                className="text-gold-strong hover:underline"
              >
                {website}
              </a>
            ) : (
              '—'
            )}
          </FactTile>
          <FactTile icon={<Calendar size={13} />} label={t('organizations.foundedLabel')}>
            {foundedYear ?? '—'}
          </FactTile>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-muted pt-3">
          <span className="flex min-w-0 items-center gap-1.5 text-sm text-ink-muted">
            <UserCheck size={14} aria-hidden="true" className="shrink-0" />
            {dossierAssignee ? (
              assigneeQuery.isPending ? (
                <span>…</span>
              ) : (
                <span className="truncate">
                  {adminDisplayName(assigneeQuery.data, dossierAssignee)}
                </span>
              )
            ) : (
              <span>{t('organizations.unassigned')}</span>
            )}
          </span>
          {dossier ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="admin-organization-assign-open"
              onClick={() => setAssignOpen(true)}
            >
              {t('verifications.assignCta')}
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
              {t('organizations.documentsTitle')}
              {dossier ? ` (${documents.length})` : ''}
            </span>
          </div>
          {dossierQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
          {dossierQuery.isError ? (
            <p className="text-sm text-ink-muted">{t('organizations.documentsEmpty')}</p>
          ) : null}
          {dossier && documents.length === 0 ? (
            <p className="text-sm text-ink-muted">{t('organizations.documentsEmpty')}</p>
          ) : null}
          {documents.map((mediaId) => (
            <DossierDocumentRow key={mediaId} mediaId={mediaId} />
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-border-muted pt-3">
          {canDecide ? (
            <>
              <Button
                type="button"
                variant="primary"
                size="sm"
                data-testid="admin-organization-approve-open"
                disabled={approveMutation.isPending}
                onClick={() => setApproveOpen(true)}
                className="w-full"
              >
                <Check size={16} aria-hidden="true" />
                {t('verifications.approveCta')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                data-testid="admin-organization-reject-open"
                disabled={rejectMutation.isPending}
                onClick={() => setRejectOpen(true)}
                className="w-full"
              >
                <Ban size={16} aria-hidden="true" />
                {t('verifications.rejectCta')}
              </Button>
            </>
          ) : null}
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
              <History size={14} aria-hidden="true" />
              {t('organizations.historyCta')}
            </Button>
          </div>
          {approveMutation.isPending || rejectMutation.isPending ? (
            <Loader label={t('shared.loading')} />
          ) : null}
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
              <ul className="mt-2 flex flex-col gap-2">
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
      </div>
      {approveOpen ? (
        <AdminDialog
          testId="admin-organization-approve-dialog"
          title={t('verifications.approveTitle')}
          onClose={() => setApproveOpen(false)}
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-muted">{t('verifications.approveBody')}</p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              data-testid="admin-organization-approve-confirm"
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
          testId="admin-organization-reject-dialog"
          title={t('verifications.rejectTitle')}
          onClose={() => setRejectOpen(false)}
        >
          <div className="flex flex-col gap-3">
            <Input
              id="admin-organization-reject-reason"
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
              data-testid="admin-organization-reject-confirm"
              disabled={rejectMutation.isPending || rejectionReason.trim() === ''}
              onClick={confirmReject}
            >
              {t('shared.confirm')}
            </Button>
          </div>
        </AdminDialog>
      ) : null}
      {assignOpen && dossier ? (
        <AdminDialog
          testId="admin-organization-assign-dialog"
          title={t('verifications.assignTitle')}
          onClose={() => setAssignOpen(false)}
        >
          <div className="flex flex-col gap-3">
            <Input
              id="admin-organization-assign-admin"
              label={t('verifications.assignLabel')}
              placeholder={t('verifications.assignPlaceholder')}
              value={assignedAdminId}
              onChange={(event) => setAssignedAdminId(event.target.value)}
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              data-testid="admin-organization-assign-confirm"
              disabled={assignMutation.isPending || assignedAdminId.trim() === ''}
              onClick={confirmAssign}
            >
              {t('shared.confirm')}
            </Button>
          </div>
        </AdminDialog>
      ) : null}
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

// Manage Organizations workspace content: list plus detail side panel. Stat
// cards read real list totals (limit 1, only `total` is rendered) under the
// same search and location filters, so every number traces to the list
// endpoint. The `type` filter stays a bounded text input: the field is
// free-form text with no fixed set of values server-side, so a hardcoded
// option list would invent data.
export function AdminOrganizationsPage() {
  const t = useTranslations('adminManage');
  const locale = useLocale();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [wilayaId, setWilayaId] = useState('');
  const [municipalityId, setMunicipalityId] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [status, setStatus] = useState('');
  const [limit, setLimit] = useState(20);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [selectedSnapshot, setSelectedSnapshot] = useState<
    AdminOrganizationRow | undefined
  >(undefined);
  const [csvError, setCsvError] = useState(false);

  const baseFilters = {
    q: q === '' ? undefined : q,
    type: type === '' ? undefined : type,
    wilayaId: wilayaId === '' ? undefined : wilayaId,
    municipalityId: municipalityId === '' ? undefined : municipalityId,
  };
  const listQuery = useAdminOrganizationsQuery({
    ...baseFilters,
    verificationStatus: verificationStatus === '' ? undefined : verificationStatus,
    status: status === '' ? undefined : status,
    cursor,
    limit,
  });
  // Stat inputs share the search filters above; each card counts one slice.
  const totalQuery = useAdminOrganizationsQuery({ ...baseFilters, limit: 1 });
  const verifiedQuery = useAdminOrganizationsQuery({
    ...baseFilters,
    verificationStatus: 'verified',
    limit: 1,
  });
  const pendingQuery = useAdminOrganizationsQuery({
    ...baseFilters,
    verificationStatus: 'pending',
    limit: 1,
  });
  const suspendedQuery = useAdminOrganizationsQuery({
    ...baseFilters,
    status: 'suspended',
    limit: 1,
  });
  const csvMutation = useAdminOrganizationsCsvMutation();

  const resetPage = () => {
    setCursor(undefined);
    setCursorHistory([]);
  };

  const refetchAll = () => {
    void listQuery.refetch();
    void totalQuery.refetch();
    void verifiedQuery.refetch();
    void pendingQuery.refetch();
    void suspendedQuery.refetch();
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
        ...baseFilters,
        verificationStatus: verificationStatus === '' ? undefined : verificationStatus,
        status: status === '' ? undefined : status,
      },
      { onError: () => setCsvError(true) },
    );
  };

  const selectRow = (row: AdminOrganizationRow) => {
    setSelectedId(rowId(row));
    setSelectedSnapshot(row);
  };

  const items = listQuery.data?.items ?? [];
  const selectedRow =
    items.find((row) => rowId(row) === selectedId) ??
    (selectedSnapshot && rowId(selectedSnapshot) === selectedId
      ? selectedSnapshot
      : undefined);
  const page = listQuery.data?.page;
  const pages = listQuery.data?.pages;
  const total = listQuery.data?.total;

  return (
    <div data-testid="admin-organizations" className="flex min-w-0 flex-col gap-6">
      <nav aria-label={t('organizations.title')} className="flex items-center gap-1 text-sm text-ink-muted">
        <span>{t('organizations.crumbAdmin')}</span>
        <ChevronRight size={14} aria-hidden="true" className="shrink-0" />
        <span>{t('organizations.crumbManagement')}</span>
        <ChevronRight size={14} aria-hidden="true" className="shrink-0" />
        <span aria-current="page" className="font-medium text-ink">
          {t('organizations.title')}
        </span>
      </nav>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('organizations.title')}</h1>
          <p className="text-sm text-ink-muted">{t('organizations.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="admin-organizations-csv"
            disabled={csvMutation.isPending}
            onClick={onExportCsv}
          >
            <Download size={16} aria-hidden="true" />
            {csvMutation.isPending ? t('shared.downloading') : t('organizations.exportCta')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="admin-organizations-refresh"
            aria-label={t('shared.refreshCta')}
            disabled={listQuery.isPending}
            onClick={refetchAll}
            className="px-2.5"
          >
            <RefreshCw size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>
      {csvError ? (
        <p data-testid="admin-organizations-csv-error" role="alert" className="text-sm text-status-error">
          {t('shared.csvError')}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          testId="admin-organizations-stat-total"
          icon={<Building2 size={14} aria-hidden="true" />}
          label={t('organizations.statsTotal')}
          value={totalQuery.data?.total}
          pending={totalQuery.isPending}
        />
        <StatCard
          testId="admin-organizations-stat-verified"
          icon={<BadgeCheck size={14} aria-hidden="true" />}
          label={t('organizations.statsVerified')}
          value={verifiedQuery.data?.total}
          pending={verifiedQuery.isPending}
        />
        <StatCard
          testId="admin-organizations-stat-pending"
          icon={<Clock size={14} aria-hidden="true" />}
          label={t('organizations.statsPending')}
          value={pendingQuery.data?.total}
          pending={pendingQuery.isPending}
        />
        <StatCard
          testId="admin-organizations-stat-suspended"
          icon={<Ban size={14} aria-hidden="true" />}
          label={t('organizations.statsSuspended')}
          value={suspendedQuery.data?.total}
          pending={suspendedQuery.isPending}
        />
      </div>

      <Card title={t('organizations.filtersTitle')}>
        <div
          data-testid="admin-organizations-filters"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div className="flex items-end gap-2">
            <Search size={16} aria-hidden="true" className="mb-3 shrink-0 text-ink-muted" />
            <div className="min-w-0 flex-1">
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
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Tag size={16} aria-hidden="true" className="mb-3 shrink-0 text-ink-muted" />
            <div className="min-w-0 flex-1">
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
            </div>
          </div>
          <div className="flex items-end gap-2">
            <MapPin size={16} aria-hidden="true" className="mb-3 shrink-0 text-ink-muted" />
            <div className="min-w-0 flex-1">
              <Input
                id="admin-organizations-wilaya"
                label={t('organizations.wilayaLabel')}
                value={wilayaId}
                onChange={(event) => {
                  setWilayaId(event.target.value);
                  resetPage();
                }}
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <LocateFixed size={16} aria-hidden="true" className="mb-3 shrink-0 text-ink-muted" />
            <div className="min-w-0 flex-1">
              <Input
                id="admin-organizations-municipality"
                label={t('organizations.municipalityLabel')}
                value={municipalityId}
                onChange={(event) => {
                  setMunicipalityId(event.target.value);
                  resetPage();
                }}
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <BadgeCheck size={16} aria-hidden="true" className="mb-3 shrink-0 text-ink-muted" />
            <div className="min-w-0 flex-1">
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
            </div>
          </div>
          <div className="flex items-end gap-2">
            <ShieldCheck size={16} aria-hidden="true" className="mb-3 shrink-0 text-ink-muted" />
            <div className="min-w-0 flex-1">
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
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            <Filter size={14} aria-hidden="true" />
            {t('shared.clearFilters')}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <section aria-label={t('organizations.title')} className="min-w-0 xl:col-span-7">
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
            <div className="overflow-x-auto" tabIndex={0}>
              <table className="w-full border-collapse text-start">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-xs font-medium uppercase tracking-wider text-ink-muted">
                    <th scope="col" className="px-3 py-2.5 text-start font-medium">
                      {t('organizations.title')}
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-start font-medium">
                      {t('organizations.typeLabel')}
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-start font-medium">
                      {t('organizations.locationLabel')}
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-start font-medium">
                      {t('organizations.verificationLabel')}
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-start font-medium">
                      {t('organizations.registeredLabel')}
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-end font-medium">
                      <span className="sr-only">{t('organizations.reviewCta')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-muted text-sm text-ink">
                  {items.map((row) => {
                    const id = rowId(row);
                    const name = displayName(row);
                    const registryId = textOf(row.registryId);
                    const place = locationOf(row);
                    const verification =
                      typeof row.verificationStatus === 'string'
                        ? row.verificationStatus
                        : '';
                    const createdAt = textOf(extrasOf(row).createdAt);
                    const active = id !== '' && id === selectedId;
                    return (
                      <tr
                        key={id}
                        data-testid={`admin-organization-row-${id}`}
                        aria-selected={active}
                        className={
                          active
                            ? 'bg-gold-soft/40'
                            : 'transition-colors hover:bg-surface-muted'
                        }
                      >
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            data-testid={`admin-organization-open-${id}`}
                            onClick={() => selectRow(row)}
                            className="flex min-w-0 items-center gap-2.5 text-start"
                          >
                            <OrgAvatar mediaId={logoMediaIdOf(row)} />
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate text-sm font-semibold text-ink">
                                {name}
                              </span>
                              <span className="truncate text-xs text-ink-muted">
                                {[registryId ?? undefined, place !== '' ? place : undefined]
                                  .filter((part) => part !== undefined)
                                  .join(' · ')}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-ink-muted">
                          {textOf(row.type) ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-ink-muted">
                          {place !== '' ? place : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          {verification !== '' ? (
                            <VerificationMark value={verification} />
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-muted">
                          {createdAt ? formatDate(createdAt, locale) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-end">
                          <button
                            type="button"
                            onClick={() => selectRow(row)}
                            className="inline-flex items-center justify-end gap-0.5 text-xs font-medium text-gold-strong hover:underline"
                          >
                            {t('organizations.reviewCta')}
                            <ArrowRight size={14} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {listQuery.isPending ? (
              <div className="p-4">
                <Loader label={t('shared.loading')} />
              </div>
            ) : null}
            {listQuery.isError ? (
              <div className="p-4">
                <SectionError testId="admin-organizations-error" message={t('shared.loadError')} />
              </div>
            ) : null}
            {listQuery.data && listQuery.data.items.length === 0 && !listQuery.isPending ? (
              <div className="p-4">
                <Empty title={t('organizations.empty')} />
              </div>
            ) : null}
            {listQuery.data ? (
              <div className="flex flex-col gap-2 border-t border-border-muted p-3 sm:flex-row sm:items-center sm:justify-between">
                <p data-testid="admin-organizations-count" className="text-xs text-ink-muted">
                  {page !== undefined && pages !== undefined && total !== undefined
                    ? t('shared.pageStatus', { page, pages, total })
                    : t('organizations.count', { total: total ?? 0 })}
                </p>
                <div className="flex flex-wrap items-center gap-2">
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
                  <label htmlFor="admin-organizations-limit" className="text-xs text-ink-muted">
                    {t('shared.perPage')}
                  </label>
                  <select
                    id="admin-organizations-limit"
                    value={String(limit)}
                    onChange={(event) => {
                      setLimit(Number(event.target.value) === 50 ? 50 : 20);
                      resetPage();
                    }}
                    className="h-7 rounded border border-border bg-surface px-1 text-xs text-ink"
                  >
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <div
          data-testid="admin-organization-panel-wrap"
          className={`min-w-0 xl:col-span-5 ${selectedRow ? '' : 'hidden xl:block'}`}
        >
          {selectedRow ? (
            <div className="fixed inset-0 z-50 xl:static xl:z-auto">
              <button
                type="button"
                aria-label={t('organizations.detailClose')}
                onClick={() => setSelectedId(undefined)}
                className="absolute inset-0 h-full w-full cursor-default bg-overlay/40 xl:hidden"
              />
              <ScrollFade
                className="absolute inset-y-0 end-0 w-full max-w-md bg-surface p-4 shadow-raised xl:static xl:max-w-none xl:bg-transparent xl:p-0 xl:shadow-none"
                viewportClassName="overflow-y-auto xl:overflow-visible"
              >
                <ScrollFade
                  className="xl:sticky xl:top-20"
                  viewportClassName="xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto"
                >
                  <OrganizationPanel
                    row={selectedRow}
                    onChanged={refetchAll}
                    onClose={() => setSelectedId(undefined)}
                  />
                </ScrollFade>
              </ScrollFade>
            </div>
          ) : (
            <Card>
              <Empty title={t('organizations.selectPrompt')} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
