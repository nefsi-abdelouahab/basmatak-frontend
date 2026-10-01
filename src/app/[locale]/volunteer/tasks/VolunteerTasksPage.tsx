'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarX,
  CheckCheck,
  ChevronDown,
  Download,
  Eye,
  FileText,
  Hourglass,
  Info,
  LayoutGrid,
  ListChecks,
  MapPin,
  Search,
  Upload,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import {
  evidenceMediaIdsOf,
  submissionParticipantIdOf,
  submissionStatusOf,
} from '@/lib/api/submissions';
import {
  rowId,
  type ParticipationRow,
  type ParticipationStatus,
} from '@/lib/api/tasks';
import { useMyExperiencesQuery } from '@/hooks/useExperiences';
import { useMySubmissionsQuery } from '@/hooks/useSubmissions';
import {
  useDownloadAttestationMutation,
  useMyParticipationsQuery,
} from '@/hooks/useTasks';
import {
  RequireTasks,
  SectionError,
  joinName,
} from '../applications/components';
import { ParticipationDetail } from './ParticipationDetail';

// My Participations rebuild from `design/Basmatak Tatatoua - My
// Participations/` (code.html + screen.png): header card (title, search,
// status tabs with real counts), rich participation cards per status, and a
// right rail (Participation Overview, Next Immediate Action, Civic Flow
// Principle). Same underlying data as the old My Tasks page
// (`GET /participations/me` + `GET /submissions/me` for real review state);
// new structure and copy per the design, cleaned per standing rules:
//
// - Deleted, never rephrased: "Verified Civic Org" (neutral "Verified" only,
//   and only when the API proves verification), the "Law 12-06 Compliant
//   Civic Charter" line, the fabricated "Record #GHT-CIVIC-4401" code (EXP-
//   codes render only from a real experience registryId — the participations
//   endpoint carries none, so no code renders), the "Archival Status / minted
//   attestation / National Registry" block (replaced only by a neutral
//   verified line backed by a real approved submission), coordinator-contact
//   buttons, and the footer civic/institutional links (Shell's minimal legal
//   footer is reused, untouched).
// - Missing field -> omitted, never invented: org logo/verification (the
//   join carries id/slug/names only), position seat counts, start briefings,
//   civic hours, review actor names.
// - e2e contract preserved where the redesign allows: `volunteer-tasks`,
//   `participation-tabs`, `tab-{value}` (values stay the real backend
//   statuses), `participations-count`, `participations-error`,
//   `participation-row`, `expand-task-{id}`, `load-more-tasks`, and the
//   expanded `ParticipationDetail` (deliverable/submit/attestation/leave
//   testids) are unchanged.
type BoardTab = 'all' | ParticipationStatus;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function formatDate(value: string | null, locale: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function formatDateTime(value: string | null, locale: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const date = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
  return `${date} · ${time}`;
}

function opportunityHref(row: ParticipationRow): string | null {
  const join = asRecord(row.opportunity);
  const raw =
    asString(row.opportunityId) ??
    asString(join?.slug) ??
    asString(join?.id) ??
    asString(join?._id) ??
    '';
  const target = raw.trim();
  return target === '' ? null : `/volunteer/opportunities/${encodeURIComponent(target)}`;
}

// The participations join selects id/slug/names only (backend
// enrichParticipations), so verification/logo rarely arrive. Both render ONLY
// from real payload fields: verificationStatus === 'verified', or a real
// http(s)/absolute-path logo URL. Otherwise the org renders as plain text
// with a neutral Building2 fallback block — never invented.
function isOrganizationVerified(row: ParticipationRow): boolean {
  return asRecord(row.organization)?.verificationStatus === 'verified';
}

function organizationLogoUrl(row: ParticipationRow): string | null {
  const organization = asRecord(row.organization);
  const candidates = [
    organization?.logoUrl,
    organization?.logo,
    organization?.avatarUrl,
    organization?.image,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const url = candidate.trim();
      if (url !== '' && (/^https?:\/\//.test(url) || url.startsWith('/'))) return url;
    }
  }
  return null;
}

function positionStartAt(row: ParticipationRow): string | null {
  return asString(asRecord(row.position)?.startAt);
}

function scheduleOf(row: ParticipationRow): { startDate: string | null; endDate: string | null } {
  const schedule = asRecord(row.schedule);
  const opportunity = asRecord(row.opportunity);
  return {
    startDate:
      asString(schedule?.startDate) ??
      asString(schedule?.startAt) ??
      asString(opportunity?.startDate) ??
      positionStartAt(row),
    endDate: asString(schedule?.endDate) ?? asString(opportunity?.endDate),
  };
}

function locationOf(row: ParticipationRow, locale: string): string | null {
  const labels = asRecord(row.locationLabels);
  if (!labels) {
    // Back-compat: older rows/tests join a flat { nameFr/nameAr } label.
    const flat = joinName(
      row.locationLabels as {
        nameFr?: string | null;
        nameAr?: string | null;
        name?: string | null;
        title?: string | null;
        slug?: string | null;
      } | null | undefined,
      locale,
    );
    return flat === '—' ? null : flat;
  }
  const parts = [
    joinName(
      asRecord(labels.municipality) as {
        nameFr?: string | null;
        nameAr?: string | null;
      } | null,
      locale,
    ),
    joinName(
      asRecord(labels.wilaya) as {
        nameFr?: string | null;
        nameAr?: string | null;
      } | null,
      locale,
    ),
  ].filter((part) => part !== '—' && part !== '');
  return parts.length > 0 ? parts.join(' · ') : null;
}

function deliverablesOf(row: ParticipationRow): string[] {
  const raw = asRecord(row.position)?.deliverables;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

function experienceIdOf(row: ParticipationRow): string | null {
  return asString(asRecord(row)?.experienceId);
}

// Design-faithful status filter tabs: square boxes (rounded-md, h-8) with a
// per-status icon and a real count badge, horizontally scrollable on narrow
// screens. Same contract as the shared TabBar: `participation-tabs` /
// `tab-{value}` testIDs, tablist/tab roles and aria-selected are preserved
// for the existing e2e suite. Values stay the exact backend participant
// statuses (labels follow the design: Upcoming = accepted,
// In Progress = active).
function ParticipationFilterTabs({
  tabs,
  active,
  counts,
  onTab,
}: {
  tabs: { value: BoardTab; label: string; Icon: LucideIcon }[];
  active: BoardTab;
  counts?: Record<string, number | undefined>;
  onTab: (value: BoardTab) => void;
}) {
  return (
    <div
      data-testid="participation-tabs"
      role="tablist"
      aria-label="participation-tabs"
      className="flex items-center gap-2 overflow-x-auto pb-1"
    >
      {tabs.map((tab) => {
        const selected = active === tab.value;
        const count = counts?.[tab.value];
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            data-testid={`tab-${tab.value}`}
            onClick={() => onTab(tab.value)}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-label-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              selected
                ? 'bg-primary text-white'
                : 'bg-surface-muted text-ink-muted hover:bg-border-muted hover:text-ink'
            }`}
          >
            <tab.Icon size={16} aria-hidden="true" className="shrink-0" />
            <span>{tab.label}</span>
            {typeof count === 'number' ? (
              <span
                className={`rounded px-1.5 py-0.5 text-label-xs font-medium ${
                  selected ? 'bg-white/20 text-white' : 'bg-border-muted text-ink-muted'
                }`}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

interface SubmissionInfo {
  status: string;
  evidenceCount: number;
}

function OrgLogo({ row }: { row: ParticipationRow }) {
  const logoUrl = organizationLogoUrl(row);
  const [src, setSrc] = useState<string | null>(logoUrl);
  useEffect(() => setSrc(organizationLogoUrl(row)), [row]);
  if (src) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setSrc(null)}
        className="h-12 w-12 shrink-0 rounded-lg bg-surface-muted object-cover"
      />
    );
  }
  // Neutral fallback block — never a letter avatar, never hidden.
  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-muted"
    >
      <Building2 size={22} aria-hidden="true" />
    </span>
  );
}

// Per-card certificate download. Renders ONLY when the participation row
// carries a real experienceId (attestation streams from the real
// `GET /experiences/:experienceId/attestation` blob endpoint). The
// participations list endpoint currently joins no experience reference, so
// this button omits itself rather than faking a download (reported gap);
// the expanded detail keeps the same conditional behavior.
function CertificateDownload({ experienceId }: { experienceId: string }) {
  const t = useTranslations('volunteerTasks');
  const attestation = useDownloadAttestationMutation();
  const [downloaded, setDownloaded] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {attestation.isError ? (
        <SectionError testId="certificate-error" message={t('participations.attestationError')} />
      ) : null}
      {downloaded ? (
        <p data-testid="certificate-success" role="status" className="text-sm text-status-success">
          {t('participations.attestationDownloaded')}
        </p>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-testid="certificate-download"
        disabled={attestation.isPending}
        onClick={() =>
          attestation.mutate(experienceId, { onSuccess: () => setDownloaded(true) })
        }
      >
        <Download size={16} aria-hidden="true" />
        {attestation.isPending
          ? t('participations.attestationDownloading')
          : t('board.downloadCertificate')}
      </Button>
    </div>
  );
}

function ParticipationCard({
  row,
  locale,
  submission,
  expanded,
  onToggle,
  onLeft,
}: {
  row: ParticipationRow;
  locale: string;
  submission: SubmissionInfo | null;
  expanded: boolean;
  onToggle: () => void;
  onLeft: () => void;
}) {
  const t = useTranslations('volunteerTasks');
  const id = rowId(row);
  const organizationName = joinName(row.organization, locale);
  const opportunityName = joinName(row.opportunity, locale);
  const positionName = joinName(row.position, locale);
  const verified = isOrganizationVerified(row);
  const href = opportunityHref(row);
  const { startDate, endDate } = scheduleOf(row);
  const location = locationOf(row, locale);
  const deliverables = deliverablesOf(row);
  const experienceId = experienceIdOf(row);
  const reason = asString(row.reason);
  const subStatus = submission?.status ?? null;

  const startLabel = formatDateTime(startDate, locale);
  const endLabel = formatDate(endDate, locale);

  const statusMeta = (() => {
    if (row.status === 'accepted')
      return { label: t('tabs.upcoming'), Icon: CalendarCheck, tone: 'text-primary' };
    if (row.status === 'active')
      return { label: t('tabs.in_progress'), Icon: Hourglass, tone: 'text-status-pending' };
    if (row.status === 'completed')
      return { label: t('tabs.completed'), Icon: CheckCheck, tone: 'text-status-success' };
    if (row.status === 'removed')
      return { label: t('tabs.removed'), Icon: XCircle, tone: 'text-ink-muted' };
    return { label: t('tabs.withdrawn'), Icon: Ban, tone: 'text-ink-muted' };
  })();

  return (
    <li
      data-testid="participation-row"
      className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="flex min-w-0 items-start gap-3">
        <OrgLogo row={row} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="break-words text-title-md font-semibold text-ink">
              {organizationName}
            </span>
            {verified ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-label-sm font-medium text-status-success">
                <BadgeCheck size={14} aria-hidden="true" />
                <span>{t('applications.verifiedBadge')}</span>
              </span>
            ) : null}
          </div>
          <h2 className="mt-0.5 break-words text-title-lg font-semibold text-ink">
            {opportunityName}
          </h2>
          {positionName !== '—' ? (
            <p className="mt-1 flex items-center gap-1.5 text-label-md text-ink-muted">
              <Briefcase size={14} aria-hidden="true" className="shrink-0" />
              <span className="truncate">
                {t('board.roleLabel')}
                {': '}
                <span className="font-medium text-primary">{positionName}</span>
              </span>
            </p>
          ) : null}
        </div>
        <p className={`flex shrink-0 items-center gap-1.5 text-label-md font-semibold ${statusMeta.tone}`}>
          <statusMeta.Icon size={16} aria-hidden="true" className="shrink-0" />
          <span className="hidden sm:inline">{statusMeta.label}</span>
        </p>
      </div>

      {startLabel || location ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-surface-muted p-3 text-body-sm text-ink-muted">
          {startLabel ? (
            <span className="inline-flex min-w-0 items-center gap-2">
              <CalendarDays size={16} aria-hidden="true" className="shrink-0" />
              <span className="truncate">
                {row.status === 'completed' && endLabel
                  ? t('board.completedOn', { date: endLabel })
                  : startLabel}
                {row.status !== 'completed' && endLabel ? ` – ${endLabel}` : null}
              </span>
            </span>
          ) : null}
          {location ? (
            <span className="inline-flex min-w-0 items-center gap-2">
              <MapPin size={16} aria-hidden="true" className="shrink-0" />
              <span className="truncate">{location}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {deliverables.length > 0 ? (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-title-sm font-semibold text-ink">
            <ListChecks size={16} aria-hidden="true" className="shrink-0 text-primary" />
            <span>{t('board.deliverablesTitle')}</span>
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {deliverables.map((item, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-body-md text-ink-muted"
              >
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-muted" />
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {row.status === 'active' ? (
        <ActiveBlock
          subStatus={subStatus}
          evidenceCount={submission?.evidenceCount ?? 0}
        />
      ) : null}

      {row.status === 'completed' ? (
        <CompletedBlock
          subStatus={subStatus}
          evidenceCount={submission?.evidenceCount ?? 0}
          experienceId={experienceId}
        />
      ) : null}

      {row.status === 'withdrawn' || row.status === 'removed' ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface-muted p-3">
          <CalendarX size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
          <p className="text-body-md leading-relaxed text-ink-muted">
            {reason ??
              (row.status === 'removed' ? t('timeline.removedNote') : t('timeline.withdrawnNote'))}
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border-muted pt-3">
        <button
          type="button"
          data-testid={`expand-task-${id}`}
          aria-expanded={expanded}
          onClick={onToggle}
          className="inline-flex items-center gap-1 text-label-md font-medium text-primary hover:text-primary-hover"
        >
          <Eye size={16} aria-hidden="true" />
          <span>{expanded ? t('board.hideDetails') : t('board.viewDetails')}</span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {(row.status === 'withdrawn' || row.status === 'removed') && !expanded ? (
            <Link
              href="/volunteer/opportunities"
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-surface-muted px-4 text-label-md font-medium text-ink hover:bg-border-muted"
            >
              <Search size={16} aria-hidden="true" />
              <span>{t('board.browseSimilar')}</span>
            </Link>
          ) : null}
          {row.status === 'active' ? (
            <Link
              data-testid={`submit-participation-${id}`}
              href={`/volunteer/tasks/${id}/submit`}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-label-md font-medium text-white hover:bg-primary-hover"
            >
              <Upload size={16} aria-hidden="true" />
              <span>{t('board.submitContribution')}</span>
            </Link>
          ) : null}
          {row.status === 'accepted' ? (
            href ? (
              <Link
                data-testid={`open-participation-${id}`}
                href={href}
                className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-label-md font-medium text-white hover:bg-primary-hover"
              >
                <Eye size={16} aria-hidden="true" />
                <span>{t('board.openOpportunity')}</span>
              </Link>
            ) : null
          ) : null}
          {(row.status === 'completed' || row.status === 'withdrawn' || row.status === 'removed') && href ? (
            <Link
              data-testid={`open-participation-${id}`}
              href={href}
              className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-label-md font-medium text-ink hover:bg-surface-muted"
            >
              {t('board.viewOpportunity')}
            </Link>
          ) : null}
          {row.status === 'active' && href ? (
            <Link
              data-testid={`open-participation-${id}`}
              href={href}
              className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-label-md font-medium text-ink hover:bg-surface-muted"
            >
              {t('board.viewOpportunity')}
            </Link>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="mt-3">
          <ParticipationDetail participationId={id} locale={locale} onLeft={onLeft} />
        </div>
      ) : null}
    </li>
  );
}

// In-progress (active) block: real submission state only. No submission,
// draft, or rejected -> neutral reminder + submit onward link (the actions
// row carries the primary Submit button). Submitted/under review -> review
// state + view-submission link. Approved -> neutral verified line (the only
// replacement allowed for the deleted archival/minted block).
function ActiveBlock({
  subStatus,
  evidenceCount,
}: {
  subStatus: string | null;
  evidenceCount: number;
}) {
  const t = useTranslations('volunteerTasks');
  if (subStatus === 'submitted' || subStatus === 'under_review') {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface-muted p-3">
        <Hourglass size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-status-pending" />
        <div className="min-w-0 text-body-md">
          <p className="font-medium text-ink">{t('board.submittedState')}</p>
          <p className="mt-0.5 text-ink-muted">
            {t('board.reviewStatusLabel')}
            {': '}
            {t('board.underReviewNote')}
            {evidenceCount > 0 ? ` · ${t('board.evidenceCount', { count: evidenceCount })}` : null}
          </p>
        </div>
      </div>
    );
  }
  if (subStatus === 'approved') {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-status-success/10 p-3">
        <BadgeCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-status-success" />
        <p className="text-body-md font-medium text-ink">{t('board.verifiedLine')}</p>
      </div>
    );
  }
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface-muted p-3">
      <Info size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
      <div className="min-w-0 text-body-md">
        <p className="font-medium text-ink">
          {subStatus === 'draft' ? t('board.draftSaved') : t('board.notSubmitted')}
        </p>
        <p className="mt-0.5 text-ink-muted">{t('board.actionReminder')}</p>
      </div>
    </div>
  );
}

// Completed block: under-review submissions show the real summary (evidence
// count) + review status; approved submissions show the neutral verified line
// + onward link to My Experiences (+ certificate download only with a real
// experienceId). No submission -> block omitted, never invented. No record
// codes, no archival/registry copy, no minted claims.
function CompletedBlock({
  subStatus,
  evidenceCount,
  experienceId,
}: {
  subStatus: string | null;
  evidenceCount: number;
  experienceId: string | null;
}) {
  const t = useTranslations('volunteerTasks');
  if (subStatus === 'approved') {
    return (
      <div className="mt-3 flex flex-col gap-3 rounded-lg bg-status-success/10 p-3">
        <div className="flex items-start gap-2">
          <BadgeCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-status-success" />
          <p className="text-body-md font-medium text-ink">{t('board.verifiedLine')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/volunteer/experiences"
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-label-md font-medium text-white hover:bg-primary-hover"
          >
            <Eye size={16} aria-hidden="true" />
            <span>{t('board.viewVerified')}</span>
          </Link>
          {experienceId ? <CertificateDownload experienceId={experienceId} /> : null}
        </div>
      </div>
    );
  }
  if (subStatus === 'submitted' || subStatus === 'under_review') {
    return (
      <div className="mt-3 flex flex-col gap-1.5 rounded-lg bg-surface-muted p-3 text-body-md">
        <p className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-medium text-ink">
            <FileText size={16} aria-hidden="true" className="shrink-0" />
            <span>{t('board.submittedLabel')}</span>
          </span>
          <span className="text-ink-muted">
            {evidenceCount > 0 ? t('board.evidenceCount', { count: evidenceCount }) : null}
          </span>
        </p>
        <p className="flex items-center justify-between gap-2">
          <span className="font-medium text-ink">{t('board.reviewStatusLabel')}</span>
          <span className="inline-flex items-center gap-1.5 font-medium text-status-pending">
            <Hourglass size={14} aria-hidden="true" className="shrink-0" />
            <span>{t('board.underReviewNote')}</span>
          </span>
        </p>
      </div>
    );
  }
  return null;
}

export function VolunteerTasksPage({ locale }: { locale: string }) {
  const t = useTranslations('volunteerTasks');
  const [tab, setTab] = useState<BoardTab>('accepted');
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<ParticipationRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);

  const listQuery = useMyParticipationsQuery({
    status: tab === 'all' ? undefined : tab === 'withdrawn' ? 'withdrawn' : tab,
    cursor,
  });
  // The design merges archive states into one Withdrawn tab; the backend
  // keeps `withdrawn` and `removed` distinct, so the tab merges both lists
  // (removed is a rare org action — first page only, appended after the
  // paginated withdrawn rows).
  const removedQuery = useMyParticipationsQuery({ status: 'removed' }, tab === 'withdrawn');

  // Per-status totals feed the tab badges and the overview rail. Each reads
  // the real list endpoint with limit=1 (only `total` is used), exactly like
  // the sidebar badges.
  const allCountQuery = useMyParticipationsQuery({ limit: 1 });
  const acceptedCountQuery = useMyParticipationsQuery({ status: 'accepted', limit: 1 });
  const activeCountQuery = useMyParticipationsQuery({ status: 'active', limit: 1 });
  const completedCountQuery = useMyParticipationsQuery({ status: 'completed', limit: 1 });
  const withdrawnCountQuery = useMyParticipationsQuery({ status: 'withdrawn', limit: 1 });
  const removedCountQuery = useMyParticipationsQuery({ status: 'removed', limit: 1 });

  // Pools for the Next Immediate Action card (small real pages, not counts).
  const activePoolQuery = useMyParticipationsQuery({ status: 'active', limit: 10 });
  const acceptedPoolQuery = useMyParticipationsQuery({ status: 'accepted', limit: 10 });

  // Real submission states keyed by participation id (backend link field is
  // `participantId`). A failing submissions read degrades to "no submission
  // info" — blocks omit themselves; the participations list still renders.
  const submissionsQuery = useMySubmissionsQuery();
  const submissionsByParticipation = useMemo(() => {
    const map = new Map<string, SubmissionInfo>();
    for (const entry of submissionsQuery.data ?? []) {
      const key = submissionParticipantIdOf(entry);
      if (key !== '') {
        map.set(key, {
          status: submissionStatusOf(entry),
          evidenceCount: evidenceMediaIdsOf(entry).length,
        });
      }
    }
    return map;
  }, [submissionsQuery.data]);

  // Verified-experiences total is real (`GET /experiences/me`, limit=1).
  const experiencesTotalQuery = useMyExperiencesQuery({ limit: 1 });

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
    { value: 'all' as const, label: t('tabs.all'), Icon: LayoutGrid },
    { value: 'accepted' as const, label: t('tabs.upcoming'), Icon: CalendarCheck },
    { value: 'active' as const, label: t('tabs.in_progress'), Icon: Hourglass },
    { value: 'completed' as const, label: t('tabs.completed'), Icon: CheckCheck },
    { value: 'withdrawn' as const, label: t('tabs.withdrawn'), Icon: Ban },
  ];

  const withdrawnTotal =
    (withdrawnCountQuery.data?.total ?? 0) + (removedCountQuery.data?.total ?? 0);
  const counts: Record<string, number | undefined> = {
    all: allCountQuery.data?.total,
    accepted: acceptedCountQuery.data?.total,
    active: activeCountQuery.data?.total,
    completed: completedCountQuery.data?.total,
    withdrawn: withdrawnCountQuery.data || removedCountQuery.data ? withdrawnTotal : undefined,
  };
  const listTotal =
    tab === 'withdrawn'
      ? (listQuery.data || removedQuery.data ? withdrawnTotal : undefined)
      : listQuery.data?.total;

  // The list endpoint has no text-search param, so the design's search box
  // filters the loaded page client-side without touching the server-side
  // status behavior.
  const visibleItems = useMemo(() => {
    const merged =
      tab === 'withdrawn' ? [...items, ...(removedQuery.data?.items ?? [])] : items;
    const query = search.trim().toLowerCase();
    if (query === '') return merged;
    return merged.filter((row) =>
      [joinName(row.opportunity, locale), joinName(row.organization, locale), joinName(row.position, locale)]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [items, removedQuery.data, search, locale, tab]);

  // Next Immediate Action: the first active participation still needing a
  // submission (none/draft/rejected), else the newest accepted one. Entirely
  // real rows; the card omits itself when neither exists.
  const nextAction = useMemo(() => {
    const needsSubmission = (row: ParticipationRow) => {
      const status = submissionsByParticipation.get(rowId(row))?.status ?? null;
      return status === null || status === 'draft' || status === 'rejected';
    };
    const urgent = (activePoolQuery.data?.items ?? []).find(needsSubmission) ?? null;
    if (urgent) return { row: urgent, kind: 'evidence' as const };
    const upcoming = (acceptedPoolQuery.data?.items ?? [])[0] ?? null;
    if (upcoming) return { row: upcoming, kind: 'accepted' as const };
    return null;
  }, [activePoolQuery.data, acceptedPoolQuery.data, submissionsByParticipation]);

  const flowSteps = [
    { title: t('board.flowStep1Title'), desc: t('board.flowStep1Desc') },
    { title: t('board.flowStep2Title'), desc: t('board.flowStep2Desc') },
    { title: t('board.flowStep3Title'), desc: t('board.flowStep3Desc') },
    { title: t('board.flowStep4Title'), desc: t('board.flowStep4Desc') },
    { title: t('board.flowStep5Title'), desc: t('board.flowStep5Desc') },
  ];

  return (
    <RequireTasks locale={locale} next={`/volunteer/tasks`}>
      <div data-testid="volunteer-tasks" className="min-w-0">
        {/* Three independent scroll columns on desktop: the grid is capped
            to the viewport below the navbar (same 7rem offset as the
            sidebar), and the center + right columns scroll internally with
            visually hidden scrollbars (the Shell sidebar is the first
            column and already scrolls independently). Below xl the layout
            collapses to a single column and the document scrolls normally. */}
        <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:h-[calc(100dvh-7rem)] xl:grid-cols-3 xl:items-stretch xl:overflow-hidden">
          <div className="flex min-w-0 flex-col gap-4 xl:col-span-2 xl:min-h-0 xl:overflow-y-auto xl:[-ms-overflow-style:none] xl:[scrollbar-width:none] xl:[&::-webkit-scrollbar]:hidden">
            <section className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
              <h1 className="break-words text-headline-lg text-ink">
                {t('participations.title')}
              </h1>
              <p className="mt-1 text-body-md text-ink-muted">{t('participations.subtitle')}</p>

              <div className="relative mt-4 min-w-0">
                <Search
                  size={18}
                  aria-hidden="true"
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
                />
                <label htmlFor="participations-search" className="sr-only">
                  {t('board.searchLabel')}
                </label>
                <input
                  id="participations-search"
                  data-testid="participations-search"
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('board.searchPlaceholder')}
                  className="h-10 w-full rounded-md border border-border bg-surface-muted pe-3 ps-9 text-body-md text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div className="mt-4">
                <ParticipationFilterTabs
                  tabs={tabs}
                  active={tab}
                  counts={counts}
                  onTab={(value) => {
                    setNotice(false);
                    setTab(value);
                  }}
                />
              </div>
            </section>

            {notice ? (
              <p
                data-testid="leave-success"
                role="status"
                className="text-sm text-status-success"
              >
                {t('participations.withdrawn')}
              </p>
            ) : null}

            {listQuery.isPending && items.length === 0 ? (
              <Loader label={t('shared.loading')} />
            ) : null}
            {listQuery.isError ? (
              <SectionError testId="participations-error" message={t('shared.loadError')} />
            ) : null}
            {typeof listTotal === 'number' ? (
              <p data-testid="participations-count" className="text-sm text-ink-muted">
                {t('participations.count', { total: listTotal })}
              </p>
            ) : null}
            {listQuery.data && visibleItems.length === 0 ? (
              <Empty title={t('board.empty')} />
            ) : null}
            <ul className="flex min-w-0 flex-col gap-4">
              {visibleItems.map((row) => {
                const id = rowId(row);
                return (
                  <ParticipationCard
                    key={`${row.status}-${id}`}
                    row={row}
                    locale={locale}
                    submission={submissionsByParticipation.get(id) ?? null}
                    expanded={expanded === id}
                    onToggle={() => setExpanded(expanded === id ? null : id)}
                    onLeft={() => {
                      setNotice(true);
                      setTab('withdrawn');
                    }}
                  />
                );
              })}
            </ul>
            {listQuery.isPending && items.length > 0 ? (
              <Loader label={t('shared.loading')} />
            ) : null}
            {listQuery.data?.nextCursor ? (
              <div>
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
          </div>

          <aside className="flex min-w-0 flex-col gap-4 xl:min-h-0 xl:overflow-y-auto xl:[-ms-overflow-style:none] xl:[scrollbar-width:none] xl:[&::-webkit-scrollbar]:hidden">
            <section
              aria-labelledby="participations-overview-title"
              data-testid="participation-overview"
              className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border-muted pb-3">
                <h2
                  id="participations-overview-title"
                  className="inline-flex items-center gap-2 text-title-md font-semibold text-ink"
                >
                  <ListChecks size={18} aria-hidden="true" className="shrink-0 text-primary" />
                  <span>{t('board.overviewTitle')}</span>
                </h2>
                <span className="text-headline-md font-semibold text-primary">
                  {allCountQuery.data ? allCountQuery.data.total : '—'}
                </span>
              </div>
              <ul className="divide-y divide-border-muted">
                <li className="flex items-center justify-between gap-2 py-2.5 text-body-md">
                  <span className="inline-flex min-w-0 items-center gap-2 text-ink">
                    <CalendarCheck size={16} aria-hidden="true" className="shrink-0 text-primary" />
                    <span className="truncate">{t('board.overviewUpcoming')}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-ink">
                    {acceptedCountQuery.data ? acceptedCountQuery.data.total : '—'}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2 py-2.5 text-body-md">
                  <span className="inline-flex min-w-0 items-center gap-2 text-ink">
                    <Hourglass size={16} aria-hidden="true" className="shrink-0 text-status-pending" />
                    <span className="truncate">{t('board.overviewInProgress')}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-status-pending">
                    {activeCountQuery.data ? activeCountQuery.data.total : '—'}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2 py-2.5 text-body-md">
                  <span className="inline-flex min-w-0 items-center gap-2 text-ink">
                    <CheckCheck size={16} aria-hidden="true" className="shrink-0 text-status-success" />
                    <span className="truncate">{t('board.overviewCompleted')}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-ink">
                    {completedCountQuery.data ? completedCountQuery.data.total : '—'}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2 py-2.5 text-body-md">
                  <span className="inline-flex min-w-0 items-center gap-2 text-ink">
                    <BadgeCheck size={16} aria-hidden="true" className="shrink-0 text-status-success" />
                    <span className="truncate">{t('board.overviewVerified')}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-status-success">
                    {experiencesTotalQuery.data ? experiencesTotalQuery.data.total : '—'}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2 py-2.5 text-body-md">
                  <span className="inline-flex min-w-0 items-center gap-2 text-ink">
                    <Ban size={16} aria-hidden="true" className="shrink-0 text-ink-muted" />
                    <span className="truncate">{t('board.overviewWithdrawn')}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-ink-muted">
                    {withdrawnCountQuery.data || removedCountQuery.data ? withdrawnTotal : '—'}
                  </span>
                </li>
              </ul>
            </section>

            {nextAction ? (
              <section
                aria-labelledby="participations-next-title"
                data-testid="next-action"
                className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-sm"
              >
                <h2
                  id="participations-next-title"
                  className="inline-flex items-center gap-2 text-title-md font-semibold text-ink"
                >
                  <Hourglass size={18} aria-hidden="true" className="shrink-0 text-status-pending" />
                  <span>{t('board.nextTitle')}</span>
                </h2>
                <div className="mt-3 flex min-w-0 flex-col gap-2 rounded-lg bg-surface-muted p-3">
                  <p className="text-label-xs font-semibold uppercase tracking-wider text-status-pending">
                    {t('board.nextActionRequired')}
                  </p>
                  <p className="truncate text-title-sm font-semibold text-ink">
                    {joinName(nextAction.row.opportunity, locale)}
                  </p>
                  <p className="flex items-center gap-1.5 truncate text-label-md text-ink-muted">
                    <Briefcase size={14} aria-hidden="true" className="shrink-0" />
                    <span className="truncate">{joinName(nextAction.row.position, locale)}</span>
                  </p>
                  <p className="text-body-sm text-ink-muted">
                    {nextAction.kind === 'evidence'
                      ? t('board.nextNeedsEvidence')
                      : t('board.nextAccepted')}
                  </p>
                  <Link
                    href={
                      nextAction.kind === 'evidence'
                        ? `/volunteer/tasks/${rowId(nextAction.row)}/submit`
                        : `/volunteer/tasks/${rowId(nextAction.row)}`
                    }
                    className="mt-1 inline-flex items-center gap-1 border-t border-border-muted pt-2 text-label-md font-semibold text-primary hover:text-primary-hover"
                  >
                    <span>
                      {nextAction.kind === 'evidence'
                        ? t('board.nextSubmitCta')
                        : t('board.viewDetails')}
                    </span>
                    <ArrowRight size={16} aria-hidden="true" className="shrink-0 rtl:rotate-180" />
                  </Link>
                </div>
              </section>
            ) : null}

            <section
              aria-labelledby="participations-flow-title"
              data-testid="flow-principle"
              className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <h2
                id="participations-flow-title"
                className="inline-flex items-center gap-2 text-title-md font-semibold text-ink"
              >
                <Info size={18} aria-hidden="true" className="shrink-0 text-primary" />
                <span>{t('board.flowTitle')}</span>
              </h2>
              <p className="mt-1 text-label-md text-ink-muted">{t('board.flowSubtitle')}</p>
              <ol className="mt-3 flex flex-col gap-3">
                {flowSteps.map((step, index) => {
                  const last = index === flowSteps.length - 1;
                  return (
                    <li key={step.title} className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-label-xs font-semibold ${
                          last ? 'bg-primary text-white' : 'bg-surface-muted text-ink'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-body-md font-semibold ${last ? 'text-primary' : 'text-ink'}`}>
                          {step.title}
                        </p>
                        <p className="text-body-sm text-ink-muted">{step.desc}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 rounded-lg bg-surface-muted p-3 text-body-sm leading-relaxed text-ink-muted">
                {t('board.flowNote')}
              </p>
            </section>
          </aside>
        </div>
      </div>
    </RequireTasks>
  );
}
