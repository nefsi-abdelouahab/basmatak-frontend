'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowUpDown,
  BadgeCheck,
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  History,
  ListChecks,
  Mail,
  MailWarning,
  MapPin,
  MapPinned,
  RotateCw,
  Search,
  Tag,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { ScrollFade } from '@/components/ui/ScrollFade';
import {
  isAdminUserStatus,
  type AdminVolunteerRow,
} from '@/lib/api/adminLists';
import { hoursFromMinutes } from '@/lib/api/publicTalent';
import {
  useAdminDossierMediaQuery,
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

function skillNamesOf(row: AdminVolunteerRow): string[] {
  if (Array.isArray(row.skillNames)) return row.skillNames.filter((s) => s !== '');
  if (Array.isArray(row.skills)) return row.skills.filter((s) => s !== '');
  return [];
}

function locationOf(row: AdminVolunteerRow): string {
  const parts = [row.municipalityName, row.wilayaName].filter(
    (part): part is string => typeof part === 'string' && part !== '',
  );
  return parts.length > 0 ? parts.join(', ') : '—';
}

function formatDate(value: string | null | undefined, locale: string): string {
  if (typeof value !== 'string' || value === '') return '—';
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '—';
  return new Date(value).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Experience `duration` is stored in minutes (opportunity durationMinutes
// snapshot). Render whole hours when exact, otherwise raw minutes — plain
// wording, no invented unit.
function formatMinutes(
  minutes: number | null | undefined,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0) return '—';
  if (minutes % 60 === 0) return t('volunteers.durationHours', { count: minutes / 60 });
  return t('volunteers.durationMinutes', { count: minutes });
}

function expRegistryOf(registryId: string | null | undefined): string {
  if (typeof registryId !== 'string' || registryId === '') return '—';
  return registryId.startsWith('EXP-') ? registryId : `EXP-${registryId}`;
}

function statusDot(status: string): string {
  if (status === 'active') return 'bg-status-success';
  if (status === 'suspended') return 'bg-status-error';
  return 'bg-ink-muted';
}

function SectionError({ message, testId }: { message: string; testId: string }) {
  return (
    <p data-testid={testId} role="alert" className="text-sm text-status-error">
      {message}
    </p>
  );
}

// Real avatar media via GET /media/:mediaId, public/user.jpg whenever the
// volunteer has no avatar media (or the read fails) — never initials-only.
function VolunteerAvatar({
  avatarId,
  name,
  size,
}: {
  avatarId: string | undefined;
  name: string;
  size: number;
}) {
  const mediaQuery = useAdminDossierMediaQuery(avatarId);
  const url =
    typeof mediaQuery.data?.url === 'string' && mediaQuery.data.url !== ''
      ? mediaQuery.data.url
      : '/user.jpg';
  return (
    <img
      src={url}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      onError={(event) => {
        if (!event.currentTarget.src.endsWith('/user.jpg')) {
          event.currentTarget.src = '/user.jpg';
        }
      }}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}

// Compact filter control with a leading icon (mockup control-bar style).
// Logical properties only so RTL mirrors automatically.
function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  Icon,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  Icon: typeof MapPin;
}) {
  return (
    <div className="relative min-w-[10rem] flex-1">
      <Icon
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
      <select
        id={id}
        aria-label={label}
        title={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-border bg-surface ps-9 pe-8 text-sm text-ink focus:border-gold-strong focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronRight
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 rotate-90 text-ink-muted"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  Icon,
  testId,
}: {
  label: string;
  value: string;
  sub: string;
  Icon: typeof Users;
  testId: string;
}) {
  return (
    <div data-testid={testId} className="flex min-w-0 flex-col gap-1 p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
        <Icon size={14} aria-hidden="true" className="shrink-0" />
        <span className="truncate">{label}</span>
      </p>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-xl font-semibold text-ink">{value}</span>
        <span className="text-xs text-ink-muted">{sub}</span>
      </p>
    </div>
  );
}

function VolunteerDetail({
  row,
  onChanged,
  onClose,
}: {
  row: AdminVolunteerRow;
  onChanged: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('adminManage');
  const locale = useLocale();
  const id = rowId(row);
  const userId = accountId(row);
  const avatarId = typeof row.avatar === 'string' && row.avatar !== '' ? row.avatar : undefined;
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
  const emailVerified =
    typeof row.emailVerifiedAt === 'string' && row.emailVerifiedAt !== '';
  const canChangeStatus =
    accountStatus !== '' &&
    accountStatus !== 'deleted' &&
    isAdminUserStatus(accountStatus);
  const targetStatus = accountStatus === 'suspended' ? 'active' : 'suspended';
  const latest = experiencesQuery.data?.items[0];
  const skills = skillNamesOf(row);
  const stats = row.stats ?? {};
  const completedTasks =
    typeof stats.completedTasks === 'number' ? stats.completedTasks : 0;
  const verifiedExperiences =
    typeof stats.verifiedExperiences === 'number' ? stats.verifiedExperiences : 0;
  // Stored in minutes; convert at display only.
  const volunteerHours =
    hoursFromMinutes(
      typeof stats.volunteerHours === 'number' ? stats.volunteerHours : 0,
    ) ?? '0';
  const latestOrg =
    latest && typeof latest === 'object' && 'organization' in latest
      ? (latest.organization as {
          nameFr?: string | null;
          nameAr?: string | null;
          slug?: string;
        } | null)
      : null;
  const latestOrgName = latestOrg
    ? (locale === 'ar'
        ? (latestOrg.nameAr ?? latestOrg.nameFr ?? latestOrg.slug ?? '')
        : (latestOrg.nameFr ?? latestOrg.nameAr ?? latestOrg.slug ?? ''))
    : '';
  const latestTitle =
    latest && typeof latest === 'object' && 'title' in latest && typeof latest.title === 'string'
      ? latest.title
      : '';
  const latestCode =
    latest && typeof latest === 'object' && 'verificationCode' in latest && typeof latest.verificationCode === 'string'
      ? latest.verificationCode
      : '';
  const latestRegistry =
    latest && typeof latest === 'object' && 'registryId' in latest && typeof latest.registryId === 'string'
      ? expRegistryOf(latest.registryId)
      : '—';
  const latestVerifiedAt =
    latest && typeof latest === 'object' && 'verifiedAt' in latest && typeof latest.verifiedAt === 'string'
      ? latest.verifiedAt
      : undefined;
  const latestDuration =
    latest && typeof latest === 'object' && 'duration' in latest && typeof latest.duration === 'number'
      ? latest.duration
      : undefined;

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
    <div data-testid="admin-volunteer-detail" className="flex min-w-0 flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <VolunteerAvatar avatarId={avatarId} name={displayName(row)} size={56} />
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-lg font-semibold text-ink">
              <span className="truncate">{displayName(row)}</span>
              {emailVerified ? (
                <CheckCircle2
                  size={16}
                  aria-hidden="true"
                  className="shrink-0 text-status-success"
                />
              ) : null}
            </h2>
            <p className="truncate text-sm text-ink-muted">
              {typeof row.username === 'string' && row.username !== ''
                ? `@${row.username}`
                : null}
              {typeof row.registryId === 'string' && row.registryId !== ''
                ? ` · ${row.registryId}`
                : null}
            </p>
            <p className="text-xs text-ink-muted">
              {t('volunteers.joinedLabel')} {formatDate(row.createdAt, locale)}
              {typeof row.lastActivityAt === 'string' && row.lastActivityAt !== ''
                ? ` · ${t('volunteers.lastActive', { date: formatDate(row.lastActivityAt, locale) })}`
                : null}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t('volunteers.closeDetail')}
          data-testid="admin-volunteer-detail-close"
          onClick={onClose}
        >
          <X size={16} aria-hidden="true" />
        </Button>
      </div>

      {/* Single account-status indicator + the ONE suspend toggle. The bottom
          duplicate button from the mockup is removed: both opened the same
          PATCH /admin/users/:userId/status, and no admin session-revoke
          endpoint exists (POST /auth/logout-others is caller-only). */}
      <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted p-3">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          <span
            aria-hidden="true"
            className={`h-2 w-2 shrink-0 rounded-full ${statusDot(accountStatus)}`}
          />
          {accountStatus === 'suspended'
            ? t('volunteers.accountSuspended')
            : t('volunteers.accountActive')}
        </p>
        {canChangeStatus ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="admin-volunteer-status-open"
            onClick={() => setStatusOpen(true)}
            className="text-status-error"
          >
            <Ban size={14} aria-hidden="true" />
            {targetStatus === 'suspended'
              ? t('volunteers.suspendCta')
              : t('volunteers.reinstateCta')}
          </Button>
        ) : null}
      </div>

      <dl className="flex flex-col gap-2 border-t border-border-muted pt-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-xs uppercase tracking-wider text-ink-muted">
            {t('volunteers.emailLabel')}
          </dt>
          <dd className="min-w-0 truncate font-medium text-ink">
            {typeof row.email === 'string' && row.email !== '' ? row.email : '—'}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-xs uppercase tracking-wider text-ink-muted">
            {t('volunteers.phoneLabel')}
          </dt>
          <dd className="font-medium text-ink">
            {typeof row.phone === 'string' && row.phone !== '' ? row.phone : '—'}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-xs uppercase tracking-wider text-ink-muted">
            {t('volunteers.locationLabel')}
          </dt>
          <dd className="font-medium text-ink">{locationOf(row)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-xs uppercase tracking-wider text-ink-muted">
            {t('volunteers.emailVerificationLabel')}
          </dt>
          <dd className="flex items-center gap-1 text-xs font-medium text-ink">
            {emailVerified ? (
              <CheckCircle2 size={14} aria-hidden="true" className="text-status-success" />
            ) : (
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ink-muted" />
            )}
            {emailVerified
              ? t('volunteers.emailVerified')
              : t('volunteers.emailUnverified')}
          </dd>
        </div>
        {skills.length > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs uppercase tracking-wider text-ink-muted">
              {t('volunteers.skillsLabel')}
            </dt>
            <dd className="min-w-0 truncate font-medium text-ink" title={skills.join(', ')}>
              {skills.join(', ')}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="flex flex-col gap-2 border-t border-border-muted pt-3">
        <p className="text-xs uppercase tracking-wider text-ink-muted">
          {t('volunteers.activitySummary')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-surface-muted p-2.5">
            <p className="flex items-center gap-1 text-xs text-ink-muted">
              <ListChecks size={13} aria-hidden="true" className="shrink-0" />
              {t('volunteers.completedTasks')}
            </p>
            <p className="mt-0.5 text-base font-semibold text-ink">{completedTasks}</p>
          </div>
          <div className="rounded-lg bg-surface-muted p-2.5">
            <p className="flex items-center gap-1 text-xs text-ink-muted">
              <BadgeCheck size={13} aria-hidden="true" className="shrink-0" />
              {t('volunteers.verifiedExperiences')}
            </p>
            <p className="mt-0.5 text-base font-semibold text-ink">{verifiedExperiences}</p>
          </div>
          <div className="col-span-2 rounded-lg bg-surface-muted p-2.5">
            <p className="flex items-center gap-1 text-xs text-ink-muted">
              <Clock3 size={13} aria-hidden="true" className="shrink-0" />
              {t('volunteers.volunteerHours')}
            </p>
            <p className="mt-0.5 text-base font-semibold text-ink">
              {t('volunteers.durationHours', { count: volunteerHours })}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border-muted pt-3">
        <p className="text-xs uppercase tracking-wider text-ink-muted">
          {t('volunteers.engagementTitle')}
        </p>
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
          <div
            data-testid="admin-volunteer-engagement"
            className="flex flex-col gap-1 rounded-lg bg-surface-muted p-3"
          >
            <p className="text-sm font-medium leading-snug text-ink">{latestTitle}</p>
            <p className="text-xs text-ink-muted">
              {latestOrgName !== '' ? `${latestOrgName} · ` : ''}{latestRegistry}
              {latestCode !== '' ? ` · ${latestCode}` : null}
            </p>
            <p className="mt-1 flex items-center justify-between gap-2 border-t border-border-muted pt-1.5 text-xs text-ink-muted">
              <span>
                {latestVerifiedAt
                  ? t('volunteers.completedOn', { date: formatDate(latestVerifiedAt, locale) })
                  : '—'}
              </span>
              <span className="font-medium text-gold-strong">
                {formatMinutes(latestDuration, (key, values) =>
                  t(key, values as Record<string, string | number>),
                )}
              </span>
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-border-muted pt-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="admin-volunteer-history-toggle"
          onClick={() => setHistoryOpen((open) => !open)}
        >
          <History size={14} aria-hidden="true" />
          {t('volunteers.historyCta')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="admin-volunteer-notice-open"
          onClick={() => setNoticeOpen(true)}
        >
          <Mail size={14} aria-hidden="true" />
          {t('volunteers.noticeCta')}
        </Button>
      </div>
      {feedback ? (
        <p data-testid="admin-volunteer-feedback" className="text-sm text-ink-muted">
          {feedback}
        </p>
      ) : null}
      {historyOpen ? (
        <div>
          <h3 className="text-sm font-semibold text-ink">{t('shared.historyTitle')}</h3>
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
          <ul className="mt-2 flex flex-col gap-2">
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
              variant={targetStatus === 'suspended' ? 'danger' : 'primary'}
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
    </div>
  );
}

// Manage Volunteers: master-detail over GET /admin/volunteers (q/wilaya/
// municipality/skill/from/to/sort, cursor limit/total/page/pages, CSV).
// No status filter exists on the endpoint, so none renders. Stat cards read
// the list response only: the platform total plus on-page window counts.
function initialQueryOf(
  initialSearch: Record<string, string | string[] | undefined> | undefined,
): string {
  const raw = initialSearch?.q;
  const first = Array.isArray(raw) ? raw[0] : raw;
  return typeof first === 'string' ? first.trim() : '';
}

export function AdminVolunteersPage({
  initialSearch,
}: {
  initialSearch?: Record<string, string | string[] | undefined>;
}) {
  const t = useTranslations('adminManage');
  const locale = useLocale();
  // Seeded from ?q= so the navbar admin search lands here (mirrors the
  // opportunities pages' initialSearch wiring); the header search box owns
  // subsequent edits.
  const [q, setQ] = useState(() => initialQueryOf(initialSearch));
  const [wilayaId, setWilayaId] = useState('');
  const [municipalityId, setMunicipalityId] = useState('');
  const [skillId, setSkillId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [limit, setLimit] = useState(25);
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
    sort: sort === '' ? undefined : sort,
    limit,
    cursor,
  };
  const listQuery = useAdminVolunteersQuery(filters);
  const csvMutation = useAdminVolunteersCsvMutation();

  const resetPage = () => {
    setCursor(undefined);
    setCursorHistory([]);
  };

  // Close the drawer on Escape.
  useEffect(() => {
    if (selectedId === undefined) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const clearFilters = () => {
    setQ('');
    setWilayaId('');
    setMunicipalityId('');
    setSkillId('');
    setFrom('');
    setTo('');
    setSort('newest');
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
        sort: sort === '' ? undefined : sort,
      },
      { onError: () => setCsvError(true) },
    );
  };

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const activeCount = items.filter((row) => row.status === 'active').length;
  const suspendedCount = items.filter((row) => row.status === 'suspended').length;
  const unverifiedCount = items.filter(
    (row) => !(typeof row.emailVerifiedAt === 'string' && row.emailVerifiedAt !== ''),
  ).length;
  const selected = items.find((row) => rowId(row) === selectedId);

  return (
    <Container testId="admin-volunteers" className="flex min-w-0 flex-col gap-6 py-6">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1 text-sm text-ink-muted"
      >
        <span>{t('volunteers.crumbsAdministration')}</span>
        <ChevronRight size={14} aria-hidden="true" className="shrink-0" />
        <span>{t('volunteers.crumbsManagement')}</span>
        <ChevronRight size={14} aria-hidden="true" className="shrink-0" />
        <span aria-current="page" className="font-medium text-ink">
          {t('volunteers.crumbsCurrent')}
        </span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">{t('volunteers.title')}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t('volunteers.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              id="admin-volunteers-q"
              type="search"
              value={q}
              placeholder={t('volunteers.headerSearchPlaceholder')}
              aria-label={t('shared.searchLabel')}
              onChange={(event) => {
                setQ(event.target.value);
                resetPage();
              }}
              className="h-10 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-muted focus:border-gold-strong focus:outline-none"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="admin-volunteers-csv"
            disabled={csvMutation.isPending}
            onClick={onExportCsv}
            className="h-10"
          >
            <Download size={14} aria-hidden="true" />
            {csvMutation.isPending ? t('shared.downloading') : t('volunteers.exportRegistry')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-label={t('volunteers.refreshRegistry')}
            title={t('volunteers.refreshRegistry')}
            disabled={listQuery.isFetching}
            onClick={() => void listQuery.refetch()}
            className="h-10 w-10"
          >
            <RotateCw size={14} aria-hidden="true" />
          </Button>
        </div>
      </div>
      {csvError ? (
        <p data-testid="admin-volunteers-csv-error" role="alert" className="text-sm text-status-error">
          {t('shared.csvError')}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border xl:grid-cols-4">
        <div className="bg-surface">
          <StatCard
            testId="admin-volunteers-stat-total"
            Icon={Users}
            label={t('volunteers.statsTotal')}
            value={String(total)}
            sub={t('volunteers.statsFilteredTotal')}
          />
        </div>
        <div className="bg-surface">
          <StatCard
            testId="admin-volunteers-stat-active"
            Icon={UserCheck}
            label={t('volunteers.statsActive')}
            value={String(activeCount)}
            sub={t('volunteers.statsOnPage')}
          />
        </div>
        <div className="bg-surface">
          <StatCard
            testId="admin-volunteers-stat-unverified"
            Icon={MailWarning}
            label={t('volunteers.statsUnverified')}
            value={String(unverifiedCount)}
            sub={t('volunteers.statsOnPage')}
          />
        </div>
        <div className="bg-surface">
          <StatCard
            testId="admin-volunteers-stat-suspended"
            Icon={Ban}
            label={t('volunteers.statsSuspended')}
            value={String(suspendedCount)}
            sub={t('volunteers.statsOnPage')}
          />
        </div>
      </div>

      <Card title={t('volunteers.filtersTitle')}>
        <div
          data-testid="admin-volunteers-filters"
          className="flex flex-wrap items-end gap-2"
        >
          <FilterSelect
            id="admin-volunteers-wilaya"
            label={t('volunteers.wilayaLabel')}
            value={wilayaId}
            onChange={(value) => {
              setWilayaId(value);
              resetPage();
            }}
            Icon={MapPin}
            options={[{ value: '', label: t('volunteers.wilayaLabel') }]}
          />
          <FilterSelect
            id="admin-volunteers-municipality"
            label={t('volunteers.municipalityLabel')}
            value={municipalityId}
            onChange={(value) => {
              setMunicipalityId(value);
              resetPage();
            }}
            Icon={MapPinned}
            options={[{ value: '', label: t('volunteers.municipalityLabel') }]}
          />
          <FilterSelect
            id="admin-volunteers-skill"
            label={t('volunteers.skillLabel')}
            value={skillId}
            onChange={(value) => {
              setSkillId(value);
              resetPage();
            }}
            Icon={Tag}
            options={[{ value: '', label: t('volunteers.skillLabel') }]}
          />
          <div className="relative min-w-[10rem] flex-1">
            <CalendarDays
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              id="admin-volunteers-from"
              type="date"
              aria-label={t('volunteers.fromLabel')}
              title={t('volunteers.fromLabel')}
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                resetPage();
              }}
              className="h-10 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-sm text-ink focus:border-gold-strong focus:outline-none"
            />
          </div>
          <div className="relative min-w-[10rem] flex-1">
            <CalendarDays
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              id="admin-volunteers-to"
              type="date"
              aria-label={t('volunteers.toLabel')}
              title={t('volunteers.toLabel')}
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                resetPage();
              }}
              className="h-10 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-sm text-ink focus:border-gold-strong focus:outline-none"
            />
          </div>
          <FilterSelect
            id="admin-volunteers-sort"
            label={t('volunteers.sortLabel')}
            value={sort}
            onChange={(value) => {
              setSort(value);
              resetPage();
            }}
            Icon={ArrowUpDown}
            options={[
              { value: 'newest', label: t('volunteers.sortNewest') },
              { value: 'oldest', label: t('volunteers.sortOldest') },
              { value: 'name', label: t('volunteers.sortName') },
            ]}
          />
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-10">
            {t('shared.clearFilters')}
          </Button>
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          {t('volunteers.wilayaPlaceholder')} · {t('volunteers.municipalityPlaceholder')} ·{' '}
          {t('volunteers.skillPlaceholder')}
        </p>
      </Card>

      {listQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
      {listQuery.isError ? (
        <SectionError testId="admin-volunteers-error" message={t('shared.loadError')} />
      ) : null}

      <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <Card className="min-w-0 p-0 xl:col-span-2">
          <div className="overflow-x-auto" tabIndex={0}>
            <table className="w-full text-start">
              <thead>
                <tr className="border-b border-border text-start text-xs uppercase tracking-wider text-ink-muted">
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t('volunteers.colVolunteer')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t('volunteers.colUsername')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t('volunteers.colLocation')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t('volunteers.colSkills')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t('volunteers.colJoined')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t('volunteers.colStatus')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-medium">
                    <span className="sr-only">{t('shared.details')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted text-sm">
                {items.map((row) => {
                  const selectedRow = rowId(row) === selectedId;
                  const status = typeof row.status === 'string' ? row.status : '';
                  const skills = skillNamesOf(row);
                  const avatarId =
                    typeof row.avatar === 'string' && row.avatar !== '' ? row.avatar : undefined;
                  return (
                    <tr
                      key={rowId(row)}
                      onClick={() => setSelectedId(rowId(row))}
                      aria-selected={selectedRow}
                      className={`cursor-pointer transition-colors hover:bg-surface-muted ${
                        selectedRow ? 'bg-gold-soft/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <VolunteerAvatar
                            avatarId={avatarId}
                            name={displayName(row)}
                            size={32}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{displayName(row)}</p>
                            <p className="truncate text-xs text-ink-muted">
                              {typeof row.registryId === 'string' && row.registryId !== ''
                                ? row.registryId
                                : '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                        {typeof row.username === 'string' && row.username !== ''
                          ? `@${row.username}`
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                        {locationOf(row)}
                      </td>
                      <td
                        className="max-w-[11rem] truncate px-4 py-3 text-ink-muted"
                        title={skills.join(', ')}
                      >
                        {skills.length > 0 ? skills.join(', ') : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                        {formatDate(row.createdAt, locale)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-ink">
                          <span
                            aria-hidden="true"
                            className={`h-1.5 w-1.5 rounded-full ${statusDot(status)}`}
                          />
                          {status !== '' ? status : '—'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          data-testid={`admin-volunteer-open-${rowId(row)}`}
                          aria-label={t('volunteers.inspect')}
                          title={t('volunteers.inspect')}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(rowId(row));
                          }}
                        >
                          <Eye size={16} aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {listQuery.data && items.length === 0 ? (
            <div className="p-4">
              <Empty title={t('volunteers.empty')} />
            </div>
          ) : null}
          {listQuery.data ? (
            <div className="flex flex-col gap-3 border-t border-border-muted px-4 py-3 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
              <p data-testid="admin-volunteers-count">
                {t('volunteers.showing', { shown: items.length, total })}
                {typeof listQuery.data.page === 'number' &&
                typeof listQuery.data.pages === 'number' &&
                listQuery.data.pages > 0
                  ? ` · ${t('volunteers.pageOf', {
                      page: listQuery.data.page,
                      pages: listQuery.data.pages,
                    })}`
                  : null}
              </p>
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
                <label
                  htmlFor="admin-volunteers-limit"
                  className="flex items-center gap-1.5 border-s border-border ps-3"
                >
                  {t('volunteers.showLabel')}
                  <select
                    id="admin-volunteers-limit"
                    value={String(limit)}
                    onChange={(event) => {
                      setLimit(Number(event.target.value) || 25);
                      resetPage();
                    }}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink focus:border-gold-strong focus:outline-none"
                  >
                    <option value="20">20</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                </label>
              </div>
            </div>
          ) : null}
        </Card>

        {selected ? (
          <>
            <div
              aria-hidden="true"
              onClick={() => setSelectedId(undefined)}
              className="fixed inset-0 z-30 bg-ink/40 xl:hidden"
            />
            <ScrollFade
              as="aside"
              role="region"
              aria-label={t('volunteers.detailTitle')}
              className="fixed inset-y-0 end-0 z-40 w-[min(92vw,26rem)] border-s border-border bg-surface p-4 shadow-modal xl:sticky xl:top-20 xl:z-auto xl:col-span-1 xl:w-auto xl:self-start xl:rounded-xl xl:border xl:p-4 xl:shadow-sm"
              viewportClassName="overflow-y-auto xl:overflow-visible"
            >
              <VolunteerDetail
                row={selected}
                onChanged={() => void listQuery.refetch()}
                onClose={() => setSelectedId(undefined)}
              />
            </ScrollFade>
          </>
        ) : null}
      </div>
    </Container>
  );
}
