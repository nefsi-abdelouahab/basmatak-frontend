'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Archive,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarCheck,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleCheck,
  CircleDot,
  ClipboardCheck,
  Clock,
  Download,
  Eye,
  FileText,
  Hourglass,
  LayoutGrid,
  Search,
  Undo2,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { backendMessageOf, mapToApiError } from '@/lib/api/errors';
import {
  PARTICIPANT_STATUSES,
  canRemoveParticipation,
  rowId,
  type InboxParticipant,
  type ParticipantStatus,
} from '@/lib/api/orgInbox';
import {
  useApplicantProfileQuery,
  useEvidenceMediaQuery,
  useOrgParticipantsQuery,
  useRemoveParticipationMutation,
} from '@/hooks/useOrgInbox';
import { useAccountMediaQuery } from '@/hooks/useOrgAccount';
import { useOwnOpportunitiesQuery, useOwnOpportunityQuery } from '@/hooks/useOrgOpps';
import { useMyOrganizationQuery } from '@/hooks/useOrgStats';
import { accountMediaUrlOf } from '@/lib/api/orgAccount';
import { evidenceUrlOf } from '@/lib/api/orgInbox';
import { MasterDetail, ReasonDialog, RequireOrg, SectionError, StatusFilterTabs, StatusPill, joinName } from '../applications/components';

// Participants roster rebuilt from
// `design/Basmatak Tatatoua - Participants Organization-Dashboard/`
// (code.html + screen.png): workspace header, search + opportunity filter,
// status tabs, directory list (left) + selected-participant detail (right)
// with profile header, participation context, progress lifecycle,
// deliverables with real file previews, skills + past verified experience.
// Organization Workspace shell (sidebar/top navbar) lives in Shell — this
// file owns the content only, inside one shared Container.
//
// Neutral-copy rules applied throughout: every number and row is real API
// data; invented labels, codes, standards, and legal notes from code.html
// are deleted (see session diff table). No messaging UI exists anywhere
// (no backend route), so no message button renders. Sort has no backend
// param on this endpoint, so no sort control renders.

// ---------------------------------------------------------------------------
// Small real-data readers (all defensive: missing joins render nothing).
// ---------------------------------------------------------------------------

type RosterRecord = Record<string, unknown>;

function recordOf(value: unknown): RosterRecord {
  return value && typeof value === 'object' ? (value as RosterRecord) : {};
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function usernameOf(row: InboxParticipant): string | undefined {
  const volunteer = recordOf(row.volunteer);
  const username = textOf(volunteer.username);
  return username ?? undefined;
}

function opportunityIdOfRow(row: InboxParticipant): string | undefined {
  const opportunity = recordOf(row.opportunity);
  const id = textOf(opportunity.id) ?? textOf(opportunity._id) ?? textOf(row.opportunityId);
  return id ?? undefined;
}

function positionTitleOf(row: InboxParticipant): string | null {
  const position = recordOf(row.position);
  return textOf(position.title);
}

function opportunityTitleOf(row: InboxParticipant, locale: string): string {
  return joinName(row.opportunity, locale);
}

function volunteerNameOf(row: InboxParticipant, locale: string): string {
  return joinName(row.volunteer, locale);
}

function avatarMediaIdOf(row: InboxParticipant): string | null {
  const volunteer = recordOf(row.volunteer);
  const id = textOf(volunteer.avatarMediaId);
  return id;
}

function geographicBaseOf(row: InboxParticipant): string | null {
  const volunteer = recordOf(row.volunteer);
  return textOf(volunteer.geographicBase);
}

function createdAtOf(row: InboxParticipant): string | null {
  return textOf(row.createdAt);
}

// Roster submission join carries { state, mediaIds } (service enrichRoster).
// Older readers checked .status only — accept both, real vocab only.
export function submissionStateOf(row: InboxParticipant): string | null {
  const submission = recordOf(row.submission);
  if (Object.keys(submission).length === 0) return null;
  const state = textOf(submission.state) ?? textOf(submission.status);
  return state;
}

export function submissionMediaIdsOf(row: InboxParticipant): string[] {
  const submission = recordOf(row.submission);
  const raw = submission.mediaIds ?? submission.evidence;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => (typeof entry === 'string' ? entry : textOf((recordOf(entry)).mediaId)))
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

function shortId(id: string): string {
  const clean = id.trim();
  if (clean.length <= 8) return clean;
  return clean.slice(0, 8);
}

function formatDate(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(time));
}

function formatBytes(size: unknown): string | null {
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function skillName(skill: unknown): string {
  if (typeof skill === 'string') return skill;
  if (skill && typeof skill === 'object') {
    const record = skill as Record<string, unknown>;
    const nested = record.skill && typeof record.skill === 'object' ? (record.skill as Record<string, unknown>) : null;
    for (const key of ['nameFr', 'name', 'nameAr', 'title', 'slug']) {
      if (typeof record[key] === 'string' && (record[key] as string).length > 0) return record[key] as string;
      if (nested && typeof nested[key] === 'string' && (nested[key] as string).length > 0) return nested[key] as string;
    }
  }
  return '';
}

// EXP- display code (idempotent single prefix, mirrors publicTalent helper).
function expCodeOf(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const bare = raw.trim().startsWith('EXP-') ? raw.trim().slice(4) : raw.trim();
  return bare.length > 0 ? `EXP-${bare}` : null;
}

function profileText(profile: unknown, keys: string[]): string | null {
  const record = recordOf(profile);
  for (const key of keys) {
    const value = textOf(record[key]);
    if (value) return value;
  }
  return null;
}

// Directory status filter: 'all' (default, no status param sent) plus the
// exact backend participant vocabulary. Icons extend the mapping already
// established in applications/components (APPLICATION_STATUS_META) and the
// volunteer My Applications tabs: All→LayoutGrid and Accepted→CheckCircle2
// match both; Active→Clock matches the in-progress Clock; Completed→CheckCheck,
// Withdrawn→Undo2, Removed→XCircle complete the set.
export type ParticipantTab = ParticipantStatus | 'all';

const PARTICIPANT_TAB_ICONS: Record<ParticipantTab, LucideIcon> = {
  all: LayoutGrid,
  accepted: CheckCircle2,
  active: Clock,
  completed: CheckCheck,
  withdrawn: Undo2,
  removed: XCircle,
};

const PARTICIPANT_TABS: ParticipantTab[] = ['all', ...PARTICIPANT_STATUSES];

// ---------------------------------------------------------------------------
// Avatar (real media when resolvable, public/user.jpg otherwise).
// ---------------------------------------------------------------------------

function PersonAvatar({ mediaId, name, size }: { mediaId: string | null; name: string; size: number }) {
  const mediaQuery = useAccountMediaQuery(mediaId);
  const url = accountMediaUrlOf(mediaQuery.data);
  const src = url ?? '/user.jpg';
  return (
    // eslint-disable-next-line @next/next/no-img-element -- session-resolved media URL with local fallback
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      onError={(event) => {
        if (!event.currentTarget.src.endsWith('/user.jpg')) event.currentTarget.src = '/user.jpg';
      }}
      className="shrink-0 rounded-xl bg-surface-muted object-cover"
      style={{ width: size, height: size }}
    />
  );
}

// ---------------------------------------------------------------------------
// Directory row skills excerpt (real public skills, max 3, hidden-safe).
// ---------------------------------------------------------------------------

function RowSkillsExcerpt({ username }: { username: string | undefined }) {
  const t = useTranslations('orgReview');
  const profileQuery = useApplicantProfileQuery(username);
  if (!username || profileQuery.isPending || profileQuery.isError || !profileQuery.data) return null;
  const skills = Array.isArray(profileQuery.data.skills) ? profileQuery.data.skills : [];
  const names = skills.map(skillName).filter((name) => name.length > 0).slice(0, 3);
  if (names.length === 0) return null;
  return (
    <span className="mt-2 block truncate text-xs leading-relaxed text-ink-muted" aria-label={t('participants.skillsLabel')}>
      {names.join(' · ')}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Lifecycle: real stages only (participant + submission states, no invented
// actor or extra stage). Icons: lucide CircleCheck / CircleDot / Circle.
// ---------------------------------------------------------------------------

type LifecycleStage = { key: string; done: boolean; current: boolean; note: string | null };

function lifecycleOf(status: string, submissionState: string | null): LifecycleStage[] {
  const submitted = submissionState !== null && ['submitted', 'under_review', 'approved', 'verified'].includes(submissionState);
  const inReview = submissionState !== null && ['under_review', 'approved', 'verified'].includes(submissionState);
  const verified = submissionState !== null && ['approved', 'verified'].includes(submissionState);
  const activeOrDone = ['active', 'completed'].includes(status);
  const acceptedOrBeyond = ['accepted', 'active', 'completed'].includes(status);

  const acceptedDone = acceptedOrBeyond;
  const acceptedCurrent = status === 'accepted' && !activeOrDone;
  const activeDone = activeOrDone;
  const activeCurrent = status === 'accepted';
  const submittedDone = submitted;
  const submittedCurrent = !submitted && activeOrDone;
  const reviewDone = verified;
  const reviewCurrent = submitted && !verified && inReview;
  const verifiedDone = verified;
  const verifiedCurrent = inReview && !verified;

  return [
    { key: 'accepted', done: acceptedDone, current: acceptedCurrent && !acceptedDone, note: status },
    { key: 'active', done: activeDone, current: activeCurrent && !activeDone, note: activeOrDone ? status : null },
    { key: 'submitted', done: submittedDone, current: submittedCurrent && !submittedDone, note: submissionState },
    { key: 'review', done: reviewDone, current: (reviewCurrent || (submitted && !inReview)) && !reviewDone, note: submissionState },
    { key: 'verified', done: verifiedDone, current: verifiedCurrent && !verifiedDone, note: verified ? submissionState : null },
  ];
}

function Lifecycle({ status, submissionState }: { status: string; submissionState: string | null }) {
  const t = useTranslations('orgReview');
  const stages = lifecycleOf(status, submissionState);
  const labels: Record<string, string> = {
    accepted: t('participants.stageAccepted'),
    active: t('participants.stageActive'),
    submitted: t('participants.stageSubmitted'),
    review: t('participants.stageReview'),
    verified: t('participants.stageVerified'),
  };
  return (
    <div className="flex flex-col gap-4">
      {stages.map((stage) => {
        const Icon = stage.done ? CircleCheck : stage.current ? CircleDot : Circle;
        const stateLabel = stage.done ? t('participants.stageDone') : stage.current ? t('participants.stageCurrent') : t('participants.stageUpcoming');
        return (
          <div key={stage.key} data-testid={`lifecycle-${stage.key}`} className="relative flex items-start justify-between gap-2">
            <span className="flex items-start gap-2">
              <Icon
                size={18}
                aria-hidden="true"
                className={stage.done || stage.current ? 'mt-0.5 shrink-0 text-gold-strong' : 'mt-0.5 shrink-0 text-ink-muted'}
              />
              <span className="flex flex-col">
                <span className={`text-sm font-semibold ${stage.done || stage.current ? 'text-ink' : 'text-ink-muted'}`}>
                  {labels[stage.key]}
                </span>
                {stage.note ? <span className="text-xs text-ink-muted">{stage.note}</span> : null}
              </span>
            </span>
            <span className={`shrink-0 text-xs ${stage.current ? 'font-semibold text-gold-strong' : 'text-ink-muted'}`}>
              {stateLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deliverable file card (real filename/size/mime from media read; image
// thumbnails only — never invented technical metadata).
// ---------------------------------------------------------------------------

function DeliverableCard({ mediaId }: { mediaId: string }) {
  const t = useTranslations('orgReview');
  const mediaQuery = useEvidenceMediaQuery(mediaId);
  if (mediaQuery.isPending) return <Loader label={t('shared.loading')} />;
  const url = evidenceUrlOf(mediaQuery.data);
  if (mediaQuery.isError || !url) {
    return (
      <p data-testid={`deliverable-unavailable-${mediaId}`} className="text-sm text-ink-muted">
        {t('participants.fileUnavailable')}
      </p>
    );
  }
  const media = recordOf(mediaQuery.data?.media);
  const filename = textOf(media.filename) ?? mediaId;
  const size = formatBytes(media.size);
  const mime = textOf(media.mimeType) ?? textOf(media.type);
  const isImage = (typeof mime === 'string' && mime.startsWith('image/')) || /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(url);
  return (
    <div data-testid={`deliverable-${mediaId}`} className="flex flex-col gap-2 rounded-lg bg-surface-muted p-2">
      <div className="h-36 w-full overflow-hidden rounded bg-surface">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- owning-org evidence URL with neutral fallback
          <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-ink-muted">
            <FileText size={28} aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs font-medium text-ink" title={filename}>
          {filename}
        </span>
        <span className="truncate text-xs text-ink-muted">
          {[size, mime].filter(Boolean).join(' · ')}
        </span>
        <a href={url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-gold-strong underline">
          <Eye size={14} aria-hidden="true" />
          <span>{t('participants.inspectFiles')}</span>
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail panel (right pane): profile header, participation context,
// lifecycle, deliverables, skills + past experience, remove.
// ---------------------------------------------------------------------------

function ParticipantDetail({
  row,
  locale,
  testIdPrefix,
  onDecided,
}: {
  row: InboxParticipant;
  locale: string;
  testIdPrefix: string;
  onDecided?: (participationId: string) => void;
}) {
  const t = useTranslations('orgReview');
  const id = rowId(row);
  const username = usernameOf(row);
  const name = volunteerNameOf(row, locale);
  const positionTitle = positionTitleOf(row);
  const opportunityTitle = opportunityTitleOf(row, locale);
  const location = geographicBaseOf(row);
  const joinedAt = createdAtOf(row);
  const joinedLabel = joinedAt && formatDate(joinedAt, locale) ? t('participants.joinedOn', { date: formatDate(joinedAt, locale) as string }) : null;
  const submissionState = submissionStateOf(row);
  const mediaIds = submissionMediaIdsOf(row);
  const oppId = opportunityIdOfRow(row);

  const profileQuery = useApplicantProfileQuery(username);
  const opportunityQuery = useOwnOpportunityQuery(oppId);
  const [showRaw, setShowRaw] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [reason, setReason] = useState('');
  const remove = useRemoveParticipationMutation();

  const bio = profileQuery.data ? profileText(profileQuery.data, ['bio', 'headline']) : null;
  const skills = profileQuery.data && Array.isArray(profileQuery.data.skills) ? profileQuery.data.skills : [];
  const skillNames = skills.map(skillName).filter((entry) => entry.length > 0);
  const experiences = profileQuery.data && Array.isArray(profileQuery.data.experiences) ? (profileQuery.data.experiences as unknown[]) : [];

  const oppDetail = opportunityQuery.data;
  const startDate = textOf(recordOf(oppDetail)?.startDate);
  const endDate = textOf(recordOf(oppDetail)?.endDate);
  const dateRange =
    startDate && formatDate(startDate, locale) && endDate && formatDate(endDate, locale)
      ? `${formatDate(startDate, locale)} – ${formatDate(endDate, locale)}`
      : startDate && formatDate(startDate, locale)
        ? (formatDate(startDate, locale) as string)
        : null;

  return (
    <div data-testid={testIdPrefix} className="flex min-w-0 flex-col gap-6">
      {/* Profile header */}
      <section aria-label={name} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <PersonAvatar mediaId={avatarMediaIdOf(row)} name={name} size={80} />
            <div className="flex min-w-0 flex-col">
              <h2 className="text-xl font-semibold tracking-tight text-ink">{name}</h2>
              {location ? <span className="mt-0.5 text-sm text-ink-muted">{location}</span> : null}
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink">
                {profileQuery.isPending ? t('shared.loading') : bio ?? t('participants.bioHidden')}
              </p>
            </div>
          </div>
          {username ? (
            <Link
              href={`/org/volunteers/${username}`}
              data-testid={`${testIdPrefix}-public-profile`}
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-gold-strong hover:underline"
            >
              <span>{t('participants.viewPublicProfile')}</span>
              <ArrowUpRight size={14} aria-hidden="true" className="rtl:rotate-180" />
            </Link>
          ) : null}
        </div>

        {/* Participation context */}
        <div className="flex flex-col gap-3 rounded-lg bg-surface-muted p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-muted pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t('participants.contextTitle')}</span>
            <span className="text-xs text-ink-muted">{t('participants.contextRecord', { id: shortId(id) })}</span>
          </div>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-muted">{t('participants.contextOpportunity')}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-ink">{opportunityTitle}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">{t('participants.contextPosition')}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-ink">{positionTitle ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">{t('participants.contextDates')}</dt>
              <dd className="mt-0.5 text-sm text-ink">{dateRange ?? joinedLabel ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">{t('participants.contextStatus')}</dt>
              <dd className="mt-0.5 text-sm text-ink">{row.status}</dd>
            </div>
          </dl>
        </div>

        {/* Lifecycle */}
        <div className="flex flex-col gap-3 pt-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t('participants.lifecycleTitle')}</span>
          <Lifecycle status={row.status} submissionState={submissionState} />
        </div>
      </section>

      {/* Deliverables */}
      <section aria-label={t('participants.deliverablesTitle')} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-ink">{t('participants.deliverablesTitle')}</h3>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
            <Archive size={16} aria-hidden="true" />
            <span data-testid={`${testIdPrefix}-files-count`}>
              {mediaIds.length === 1 ? t('participants.deliverableOne') : t('participants.deliverablesCount', { count: mediaIds.length })}
            </span>
          </span>
        </div>
        {submissionState ? (
          <p data-testid={`${testIdPrefix}-submission`} className="text-sm text-ink-muted">
            {t('participants.submissionLabel')}: {submissionState}
          </p>
        ) : (
          <p data-testid={`${testIdPrefix}-deliverables-empty`} className="text-sm text-ink-muted">
            {t('participants.deliverablesEmpty')}
          </p>
        )}
        {submissionState && mediaIds.length === 0 ? (
          <p data-testid={`${testIdPrefix}-evidence-empty`} className="text-sm text-ink-muted">
            {t('participants.evidenceEmpty')}
          </p>
        ) : null}
        {mediaIds.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {mediaIds.map((mediaId) => (
              <DeliverableCard key={mediaId} mediaId={mediaId} />
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Link
            href="/org/contributions"
            data-testid={`${testIdPrefix}-review`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary shadow-sm transition-colors hover:bg-primary-hover"
          >
            <span>{t('participants.reviewContribution')}</span>
            <ArrowRight size={16} aria-hidden="true" className="rtl:rotate-180" />
          </Link>
          {mediaIds.length > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid={`${testIdPrefix}-inspect`}
              onClick={() => setShowRaw((value) => !value)}
            >
              <Download size={14} aria-hidden="true" />
              <span>{t('participants.inspectFiles')}</span>
            </Button>
          ) : null}
        </div>
        {showRaw && mediaIds.length > 0 ? (
          <ul className="flex flex-col gap-1 rounded-lg bg-surface-muted p-3">
            {mediaIds.map((mediaId) => (
              <RawFileRow key={mediaId} mediaId={mediaId} testIdPrefix={testIdPrefix} />
            ))}
          </ul>
        ) : null}
      </section>

      {/* Skills + past experience */}
      <section aria-label={t('participants.skillsTitle')} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6">
        <h3 className="text-base font-semibold text-ink">{t('participants.skillsTitle')}</h3>
        <div>
          <span className="mb-1 block text-xs text-ink-muted">{t('participants.skillsLabel')}</span>
          {profileQuery.isPending ? (
            <Loader label={t('shared.loading')} />
          ) : profileQuery.isError ? (
            <SectionError testId={`${testIdPrefix}-skills-error`} message={t('shared.loadError')} />
          ) : skillNames.length > 0 ? (
            <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink">
              {skillNames.slice(0, 12).map((entry, index) => (
                <li key={`${entry}-${index}`} data-testid={`${testIdPrefix}-skill`} className="inline-flex items-center gap-1">
                  <Check size={14} aria-hidden="true" className="text-ink-muted" />
                  <span>{entry}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p data-testid={`${testIdPrefix}-skills-empty`} className="text-sm text-ink-muted">
              {profileQuery.data && profileQuery.data.skills === null ? t('participants.skillsHidden') : t('participants.skillsEmpty')}
            </p>
          )}
        </div>
        <div>
          <span className="mb-1 block text-xs text-ink-muted">{t('participants.experienceLabel')}</span>
          {profileQuery.isPending ? (
            <Loader label={t('shared.loading')} />
          ) : experiences.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {experiences.slice(0, 3).map((experience, index) => (
                <PriorExperienceRow key={index} experience={experience} locale={locale} testIdPrefix={testIdPrefix} />
              ))}
            </ul>
          ) : (
            <p data-testid={`${testIdPrefix}-experience-empty`} className="text-sm text-ink-muted">
              {t('participants.experienceEmpty')}
            </p>
          )}
        </div>
        <p data-testid={`${testIdPrefix}-verify-note`} className="rounded-lg bg-surface-muted p-3 text-xs leading-relaxed text-ink-muted">
          {t('participants.verifyNote')}
        </p>
        {canRemoveParticipation(row.status) && !removeOpen ? (
          <div>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => {
                setReason('');
                setRemoveOpen(true);
              }}
              data-testid={`${testIdPrefix}-remove`}
            >
              {t('participants.remove')}
            </Button>
          </div>
        ) : null}
        {removeOpen ? (
          <ReasonDialog
            testId={`${testIdPrefix}-remove-dialog`}
            title={t('participants.removeTitle')}
            reasonLabel={t('participants.reasonLabel')}
            reasonPlaceholder={t('participants.reasonPlaceholder')}
            requiredMessage={t('participants.reasonRequired')}
            reason={reason}
            onReason={setReason}
            confirmLabel={t('participants.confirm')}
            cancelLabel={t('participants.cancel')}
            pending={remove.isPending}
            onConfirm={() =>
              remove.mutate(
                { participationId: id, reason: reason.trim() },
                {
                  onSuccess: () => {
                    setRemoveOpen(false);
                    onDecided?.(id);
                  },
                },
              )
            }
            onCancel={() => setRemoveOpen(false)}
          />
        ) : null}
        {remove.isError ? (
          <SectionError
            testId={`${testIdPrefix}-remove-error`}
            message={backendMessageOf(remove.error) ?? t('shared.actionError')}
          />
        ) : null}
      </section>
    </div>
  );
}

function RawFileRow({ mediaId, testIdPrefix }: { mediaId: string; testIdPrefix: string }) {
  const mediaQuery = useEvidenceMediaQuery(mediaId);
  const url = evidenceUrlOf(mediaQuery.data);
  if (mediaQuery.isPending || mediaQuery.isError || !url) return null;
  const media = recordOf(mediaQuery.data?.media);
  const filename = textOf(media.filename) ?? mediaId;
  return (
    <li data-testid={`${testIdPrefix}-raw-${mediaId}`} className="truncate text-xs">
      <a href={url} target="_blank" rel="noreferrer" className="font-medium text-gold-strong underline">
        {filename}
      </a>
    </li>
  );
}

function PriorExperienceRow({
  experience,
  locale,
  testIdPrefix,
}: {
  experience: unknown;
  locale: string;
  testIdPrefix: string;
}) {
  const t = useTranslations('orgReview');
  const record = recordOf(experience);
  const title = textOf(record.title) ?? '—';
  const code = expCodeOf(record.registryId);
  const verificationCode = textOf(record.verificationCode);
  const verifiedAt = textOf(record.verifiedAt) ?? textOf(record.createdAt);
  const verifiedLabel = verifiedAt && formatDate(verifiedAt, locale) ? t('participants.verifiedOn', { date: formatDate(verifiedAt, locale) as string }) : null;
  return (
    <li data-testid={`${testIdPrefix}-experience`} className="flex items-start gap-2 rounded-lg bg-surface-muted p-3">
      <BadgeCheck size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-gold-strong" />
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-ink">{title}</span>
        <span className="text-xs text-ink-muted">
          {[code ? `${t('participants.codeLabel')}: ${code}` : null, verificationCode, verifiedLabel].filter(Boolean).join(' · ')}
        </span>
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Page: header + filters + 2-pane directory/detail.
// ---------------------------------------------------------------------------

export function OrgParticipantsPage({
  locale,
  initialExpanded,
}: {
  locale: string;
  initialExpanded?: string;
}) {
  const t = useTranslations('orgReview');
  const [tab, setTab] = useState<ParticipantTab>('all');
  const [q, setQ] = useState('');
  const [opportunityId, setOpportunityId] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<InboxParticipant[]>([]);
  const [selected, setSelected] = useState<string | null>(initialExpanded ?? null);
  const rowCache = useRef(new Map<string, InboxParticipant>());
  const [outcome, setOutcome] = useState<{ id: string; status: string } | null>(null);

  const listQuery = useOrgParticipantsQuery({
    q: q || undefined,
    opportunityId: opportunityId || undefined,
    status: tab === 'all' ? undefined : tab,
    cursor,
  });
  const orgQuery = useMyOrganizationQuery();
  const oppsQuery = useOwnOpportunitiesQuery({ limit: 50 });

  const filterKey = `${tab}|${q}|${opportunityId}|${initialExpanded ?? ''}`;
  useEffect(() => {
    setCursor(undefined);
    setItems([]);
    setSelected(initialExpanded ?? null);
    setOutcome(null);
  }, [tab, q, opportunityId, initialExpanded]);

  useEffect(() => {
    if (listQuery.data) {
      const pageItems = listQuery.data.items as InboxParticipant[];
      for (const row of pageItems) rowCache.current.set(rowId(row), row);
      if (cursor === undefined) setItems(pageItems);
      else setItems((prev) => [...prev, ...pageItems]);
    }
  }, [listQuery.data, cursor]);

  // Auto-select the first row exactly once per filter set (same guard the
  // org Applications screen uses): a user-initiated deselect via the mobile
  // back control must stick instead of reselecting on every null.
  const autoSelectedFor = useRef<string | null>(null);
  useEffect(() => {
    if (items.length > 0 && autoSelectedFor.current !== filterKey) {
      autoSelectedFor.current = filterKey;
      setSelected((prev) => (prev === null ? rowId(items[0]) : prev));
    }
  }, [items, filterKey]);

  const tabs = PARTICIPANT_TABS.map((value) => ({
    value,
    label: value === 'all' ? t('tabs.all') : t(`tabs.${value}`),
    Icon: PARTICIPANT_TAB_ICONS[value],
  }));
  const statusLabels: Record<string, string> = Object.fromEntries(
    tabs.map((tabEntry) => [tabEntry.value, tabEntry.label]),
  );
  const forbidden =
    listQuery.isError && mapToApiError(listQuery.error).statusCode === 403;

  const selectedRow = useMemo(() => {
    if (selected === null) return undefined;
    const live = items.find((row) => rowId(row) === selected);
    if (live) {
      return outcome && outcome.id === selected ? { ...live, status: outcome.status } : live;
    }
    const cached = rowCache.current.get(selected);
    if (!cached) return undefined;
    return outcome && outcome.id === selected ? { ...cached, status: outcome.status } : cached;
  }, [items, selected, outcome]);

  const orgName = useMemo(() => {
    const org = orgQuery.data;
    if (!org) return '';
    return locale === 'ar' ? (org.nameAr ?? org.nameFr ?? '') : (org.nameFr ?? org.nameAr ?? '');
  }, [orgQuery.data, locale]);

  const opportunityOptions = useMemo(() => {
    const rows = (oppsQuery.data?.items ?? []) as { id?: string; _id?: string; title?: string }[];
    return rows.map((opp) => {
      const value = opp.id ?? opp._id ?? '';
      return { value, label: opp.title ?? value };
    });
  }, [oppsQuery.data]);

  const total = listQuery.data?.total ?? items.length;

  return (
    <RequireOrg locale={locale} next={`/org/participants`}>
      <Container testId="org-participants-container" className="flex min-w-0 flex-col gap-6 py-4">
        <div data-testid="org-participants" className="flex min-w-0 flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              {t('participants.workspace')}
              {orgName ? ` · ${orgName}` : ''}
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-ink">{t('participants.title')}</h1>
            <p className="text-sm text-ink-muted">{t('participants.subtitle')}</p>
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pt-1 text-sm text-ink-muted">
              <Users size={16} aria-hidden="true" className="text-gold-strong" />
              <span>{t('participants.count', { total })}</span>
            </p>
          </div>

          {/* Filters: label-above-input 2-column row + status boxes below */}
          <Card>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="participants-q" className="mb-1 block text-sm font-medium text-ink">
                  {t('shared.searchLabel')}
                </label>
                <div className="relative">
                  <Search
                    size={18}
                    aria-hidden="true"
                    className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
                  />
                  <input
                    id="participants-q"
                    type="search"
                    data-testid="participants-search"
                    placeholder={t('shared.searchPlaceholder')}
                    value={q}
                    onChange={(event) => setQ(event.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-surface py-2 pe-3 ps-9 text-sm text-ink placeholder:text-ink-muted focus:border-gold-strong focus:outline-none"
                  />
                </div>
              </div>
              <div className="min-w-0">
                <label htmlFor="participants-opportunity" className="mb-1 block text-sm font-medium text-ink">
                  {t('shared.opportunityLabel')}
                </label>
                <div className="relative">
                  <select
                    id="participants-opportunity"
                    data-testid="participants-opportunity"
                    value={opportunityId}
                    onChange={(event) => setOpportunityId(event.target.value)}
                    className="h-10 w-full appearance-none rounded-lg border border-border bg-surface px-3 pe-8 text-sm text-ink focus:border-gold-strong focus:outline-none"
                  >
                    <option value="">{t('shared.allOpportunities')}</option>
                    {opportunityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={18}
                    aria-hidden="true"
                    className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <StatusFilterTabs
                  tabs={tabs}
                  active={tab}
                  onTab={(value) => setTab(value as ParticipantTab)}
                  testId="participant-tabs"
                />
              </div>
              {q || opportunityId ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid="participants-clear"
                  onClick={() => {
                    setQ('');
                    setOpportunityId('');
                  }}
                >
                  {t('shared.clearFilters')}
                </Button>
              ) : null}
            </div>
          </Card>

          {/* 2-pane directory + detail */}
          {listQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
          {forbidden ? (
            <SectionError testId="participants-forbidden" message={t('shared.loadError')} />
          ) : listQuery.isError ? (
            <SectionError testId="participants-error" message={t('shared.loadError')} />
          ) : (
            <MasterDetail
              listLabel={t('participants.directory')}
              detailLabel={t('participants.title')}
              hasSelection={selectedRow !== undefined}
              onBack={() => setSelected(null)}
              backLabel={t('participants.backToList')}
              list={
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {t('participants.directory')}
                    </span>
                    <span className="text-xs text-ink-muted">{t('participants.showing', { shown: items.length, total })}</span>
                  </div>
                  {items.length === 0 ? (
                    <Empty title={t('shared.empty')} />
                  ) : (
                    <ul className="flex min-w-0 flex-col gap-3">
                    {items.map((row) => {
                      const id = rowId(row);
                      const isOpen = selected === id;
                      const name = volunteerNameOf(row, locale);
                      const role = positionTitleOf(row);
                      const oppTitle = opportunityTitleOf(row, locale);
                      const joined = createdAtOf(row);
                      const joinedLabel = joined && formatDate(joined, locale) ? formatDate(joined, locale) : null;
                      const submissionState = submissionStateOf(row);
                      return (
                        <li key={id} data-testid="participant-row">
                          <article
                            className={`relative rounded-xl border bg-surface p-4 shadow-sm transition-colors ${
                              isOpen ? 'border-gold-strong' : 'border-border hover:bg-surface-muted'
                            }`}
                          >
                            {isOpen ? (
                              <span aria-hidden="true" className="absolute inset-y-3 start-0 w-1 rounded-e bg-gold" />
                            ) : null}
                            <button
                              type="button"
                              data-testid={`participant-expand-${id}`}
                              aria-expanded={isOpen}
                              onClick={() => setSelected(isOpen ? null : id)}
                              className="flex w-full min-w-0 items-start gap-3 text-start"
                            >
                              <PersonAvatar mediaId={avatarMediaIdOf(row)} name={name} size={56} />
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="flex items-center justify-between gap-2">
                                  <span className="truncate text-base font-semibold text-ink">{name}</span>
                                  {isOpen ? (
                                    <span className="shrink-0 text-xs font-medium text-gold-strong">
                                      {t('participants.selected')}
                                    </span>
                                  ) : (
                                    <StatusPill status={row.status} label={statusLabels[row.status] ?? row.status} />
                                  )}
                                </span>
                                {role ? <span className="truncate text-sm font-medium text-ink">{role}</span> : null}
                                <span className="mt-0.5 truncate text-sm text-ink-muted">{oppTitle}</span>
                                <span className="mt-3 flex flex-col gap-1.5 rounded-lg bg-surface-muted p-2">
                                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                                    <CalendarCheck size={15} aria-hidden="true" />
                                    {joinedLabel ? <span>{t('participants.joinedOn', { date: joinedLabel })}</span> : null}
                                    {joinedLabel ? <span aria-hidden="true">·</span> : null}
                                    <span>{t('participants.participationId', { id: shortId(id) })}</span>
                                  </span>
                                  {submissionState ? (
                                    <span className="flex items-center gap-1.5 text-xs font-medium text-ink">
                                      {['approved', 'verified', 'completed'].includes(submissionState) ? (
                                        <BadgeCheck size={15} aria-hidden="true" className="text-gold-strong" />
                                      ) : ['submitted', 'under_review'].includes(submissionState) ? (
                                        <Hourglass size={15} aria-hidden="true" className="text-gold-strong" />
                                      ) : (
                                        <ClipboardCheck size={15} aria-hidden="true" className="text-ink-muted" />
                                      )}
                                      <span>
                                        {t('participants.submissionLabel')}: {submissionState}
                                      </span>
                                    </span>
                                  ) : null}
                                </span>
                                <RowSkillsExcerpt username={usernameOf(row)} />
                              </span>
                            </button>
                          </article>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="rounded-lg bg-surface-muted p-3 text-center text-sm text-ink-muted">
                  {t('participants.endOfResults')}
                </p>
                {listQuery.data?.nextCursor ? (
                  <div className="mt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={listQuery.isFetching}
                      onClick={() => setCursor(listQuery.data?.nextCursor ?? undefined)}
                      data-testid="participants-more"
                    >
                      {t('shared.next')}
                    </Button>
                  </div>
                ) : null}
                </div>
            }
            detail={
              <>
                <p data-testid="participants-count" className="sr-only">
                  {t('participants.count', { total })}
                </p>
                {selectedRow ? (
                  <ParticipantDetail
                    row={selectedRow}
                    locale={locale}
                    testIdPrefix="participant-detail"
                    onDecided={(decidedId) => setOutcome({ id: decidedId, status: 'removed' })}
                  />
                ) : (
                  <Card>
                    <Empty title={t('participants.detailEmpty')} />
                  </Card>
                )}
              </>
            }
          />
          )}
        </div>
      </Container>
    </RequireOrg>
  );
}

// Joined submission state/files on the roster row: real submission vocabulary
// only (the row carries the join — no extra endpoint is called).
// (submissionStateOf / submissionMediaIdsOf live above for the detail pane.)

export function ParticipantPanel({
  row,
  testIdPrefix,
  onDecided,
}: {
  row: InboxParticipant;
  testIdPrefix: string;
  onDecided?: (participationId: string) => void;
}) {
  const t = useTranslations('orgReview');
  const [removeOpen, setRemoveOpen] = useState(false);
  const [reason, setReason] = useState('');
  const remove = useRemoveParticipationMutation();
  const id = rowId(row);
  const submissionState = submissionStateOf(row);

  return (
    <div data-testid={testIdPrefix} className="flex flex-col gap-3">
      {submissionState ? (
        <p data-testid={`${testIdPrefix}-submission`} className="text-sm text-ink-muted">
          {t('participants.submissionLabel')}: {submissionState}
        </p>
      ) : null}
      {canRemoveParticipation(row.status) && !removeOpen ? (
        <div>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => {
              setReason('');
              setRemoveOpen(true);
            }}
            data-testid={`${testIdPrefix}-remove`}
          >
            {t('participants.remove')}
          </Button>
        </div>
      ) : null}
      {removeOpen ? (
        <ReasonDialog
          testId={`${testIdPrefix}-remove-dialog`}
          title={t('participants.removeTitle')}
          reasonLabel={t('participants.reasonLabel')}
          reasonPlaceholder={t('participants.reasonPlaceholder')}
          requiredMessage={t('participants.reasonRequired')}
          reason={reason}
          onReason={setReason}
          confirmLabel={t('participants.confirm')}
          cancelLabel={t('participants.cancel')}
          pending={remove.isPending}
          onConfirm={() =>
            remove.mutate(
              { participationId: id, reason: reason.trim() },
              {
                onSuccess: () => {
                  setRemoveOpen(false);
                  onDecided?.(id);
                },
              },
            )
          }
          onCancel={() => setRemoveOpen(false)}
        />
      ) : null}
      {remove.isError ? (
        <SectionError
          testId={`${testIdPrefix}-remove-error`}
          message={backendMessageOf(remove.error) ?? t('shared.actionError')}
        />
      ) : null}
    </div>
  );
}

// Icon mapping (code.html Material Symbols -> lucide-react). Only lucide
// icons render above. `gavel` was tied to the deleted legal note and `mail`
// to the omitted message action — both dropped, never reused.
export const PARTICIPANT_ICON_ATTESTATION = {
  architecture: 'dropped (fieldwork line renders as plain status text)',
  arrow_forward: 'ArrowRight',
  check: 'Check',
  check_circle: 'CircleCheck',
  download: 'Download',
  event_available: 'CalendarCheck',
  expand_more: 'dropped (no sort control: endpoint has no sort param)',
  fact_check: 'ClipboardCheck',
  folder_zip: 'Archive',
  gavel: 'dropped (deleted legal note)',
  group: 'Users',
  mail: 'dropped (no messaging endpoint)',
  north_east: 'ArrowUpRight',
  notifications: 'dropped (no notification bell in this content pane)',
  pending_actions: 'Hourglass',
  person: 'dropped (avatars are photos with user.jpg fallback, no glyph)',
  picture_as_pdf: 'FileText',
  radio_button_checked: 'CircleDot',
  radio_button_unchecked: 'Circle',
  search: 'Search',
  swap_vert: 'dropped (no sort control: endpoint has no sort param)',
  verified: 'BadgeCheck',
  verified_user: 'dropped (no volunteer identity badge in API)',
  visibility: 'Eye',
} as const;
