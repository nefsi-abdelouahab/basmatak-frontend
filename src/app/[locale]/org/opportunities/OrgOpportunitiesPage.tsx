'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  CircleCheck,
  Copy,
  ExternalLink,
  Info,
  LayoutGrid,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { ForbiddenScreen } from '@/components/system/ForbiddenScreen';
import { SessionExpiredScreen } from '@/components/system/SessionExpiredScreen';
import { errorStateFor, mapToApiError } from '@/lib/api/errors';
import { getLoginHref, useSessionQuery } from '@/hooks/useSession';
import { useAccountMediaQuery } from '@/hooks/useOrgAccount';
import { useOrgExperiencesQuery } from '@/hooks/useOrgRecords';
import { useMyOrganizationQuery } from '@/hooks/useOrgStats';
import { accountMediaUrlOf } from '@/lib/api/orgAccount';
import {
  lifecycleAvailability,
  opportunityIdOf,
  opportunityRefOf,
  opportunityStatusOf,
  type OwnerOpportunity,
  type OwnerPosition,
  type PublishGateStatus,
} from '@/lib/api/orgOpps';
import {
  isOrgNotVerifiedError,
  isPublishGateLockedError,
  isPublishingDisabledError,
  useDeleteDraftOpportunityMutation,
  useDuplicateOpportunityMutation,
  useLifecycleActionMutation,
  useOwnOpportunitiesQuery,
  useOwnOrgGateQuery,
  usePublishGateQuery,
} from '@/hooks/useOrgOpps';

// My Opportunities rebuild from
// `design/Basmatak Tatatoua - My Opportunities/` (code.html + screen.png):
// breadcrumb + title + subtitle, 4-counter stat row, status tabs with real
// counts + search + sort, "Create opportunity" (real route
// /org/opportunities/new), one editorial card per opportunity (real cover,
// dot status + sub-status, title, description, dates/location/category meta,
// position breakdown, applications/participants links, status-specific
// actions), real cursor pagination with numbered pages.
//
// Standing rules applied (docs/DESIGN_BACKEND_RECONCILIATION_V2.md §B#10):
// - Deleted, never rephrased: the "Civic Charter Verified" sidebar note (the
//   shell renders a neutral "Verified Organization" badge only when
//   verificationStatus is verified — untouched here), "4 verified experiences
//   minted" (neutral "N verified experiences" from GET
//   /organizations/me/experiences?opportunityId=), "100% NGO audit complete"
//   (no backing feature), "All volunteer credentials issued and signed by
//   association president." (fabricated claim), the "Report (PDF)" button (no
//   opportunity-PDF endpoint — only experience attestation streams).
// - Every number/row is real API data. Missing text is omitted, a missing
//   number renders 0, a missing list renders the i18n empty state.
// - Cover images resolve per-card: coverMediaId → GET /media/:mediaId →
//   signed URL via useAccountMediaQuery (query key includes the mediaId, so
//   two opportunities never share a URL). No cover (or an unresolvable one)
//   renders a neutral block — never a shared/default/broken image.
// - The list response (embedFull) carries categoryName + locationLabels +
//   per-position applicationCount/assigned. Top-level applicationCount /
//   participantCount are absent server-side, so the card derives applications
//   from the embedded per-position counts (falling back to the raw fields
//   only when the embeds carry none) and participants from embedded assigned
//   names (falling back to filledCount, then the raw field).
// - code.html decorates every position/category with its own illustration
//   icon (photo_camera, mic, view_in_ar, edit_note, translate,
//   record_voice_over, domain, water_drop, school). The backend exposes no
//   position/category taxonomy to key that mapping off, so all positions
//   share one neutral Briefcase icon and all categories share one neutral
//   LayoutGrid icon (see the icon-mapping note at the bottom of the review).
// - Shell (sidebar → bottom bar, Container gutters) is untouched: this file
//   owns the screen content only and adds no ad-hoc page padding.

// Guest guard (decision 10): unauthenticated visits redirect to Login.
export function RequireOrgOpps({
  locale,
  next,
  children,
}: {
  locale: string;
  next: string;
  children: ReactNode;
}) {
  const t = useTranslations('orgOpportunities');
  const session = useSessionQuery();
  const router = useRouter();

  useEffect(() => {
    if (session.isError) router.replace(getLoginHref(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isError, router, locale]);

  if (session.isPending) return <Loader label={t('list.loading')} />;
  if (session.isError) return null;
  return <>{children}</>;
}

export function OppSectionError({ message, testId }: { message: string; testId: string }) {
  return (
    <p data-testid={testId} role="alert" className="text-sm text-status-error">
      {message}
    </p>
  );
}

const STATUS_TONE: Record<string, PillTone> = {
  draft: 'neutral',
  published: 'success',
  in_progress: 'pending',
  completed: 'success',
  closed: 'neutral',
  cancelled: 'error',
};

export function OppStatusPill({ status }: { status: string }) {
  return <Pill tone={STATUS_TONE[status] ?? 'neutral'}>{status}</Pill>;
}

function PublishLockNote({
  verificationStatus,
  gate,
}: {
  verificationStatus: string | undefined;
  gate: PublishGateStatus | undefined;
}) {
  const t = useTranslations('orgOpportunities');
  const availability = lifecycleAvailability('draft', verificationStatus, gate?.locked);
  if (availability.publishLockedReason === null) return null;
  if (availability.publishLockedReason === 'unverified') {
    return (
      <p data-testid="publish-locked-unverified" className="text-sm text-status-pending">
        {t('list.publishLockedUnverifiedTitle')}: {t('list.publishLockedUnverifiedDescription')}
      </p>
    );
  }
  return (
    <p data-testid="publish-locked-gate" className="text-sm text-status-pending">
      {t('list.publishLockedGateTitle')}:{' '}
      {t('list.publishLockedGateDescription', {
        pendingCount: gate?.pendingCount ?? 0,
        threshold: gate?.threshold ?? 0,
      })}
    </p>
  );
}

function formatLongDate(value: string | null | undefined, locale: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function labelText(value: unknown, locale: string): string | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as { nameAr?: unknown; nameFr?: unknown };
  const clean = (entry: unknown) =>
    typeof entry === 'string' && entry.trim() !== '' ? entry : null;
  const primary = locale === 'ar' ? clean(row.nameAr) : clean(row.nameFr);
  if (primary) return primary;
  return locale === 'ar' ? clean(row.nameFr) : clean(row.nameAr);
}

function categoryNameOf(opp: OwnerOpportunity, locale: string): string | null {
  return labelText((opp as unknown as { categoryName?: unknown }).categoryName, locale);
}

function locationTextOf(opp: OwnerOpportunity, locale: string): string | null {
  const raw = opp as unknown as {
    locationLabels?: { wilaya?: unknown; municipality?: unknown };
    location?: { address?: unknown };
  };
  const parts = [
    labelText(raw.locationLabels?.municipality, locale),
    labelText(raw.locationLabels?.wilaya, locale),
  ].filter((part): part is string => part !== null);
  const address =
    typeof raw.location?.address === 'string' && raw.location.address.trim() !== ''
      ? raw.location.address.trim()
      : null;
  const labels =
    address && !parts.some((part) => address.includes(part)) ? [...parts, address] : parts;
  const all = labels.length > 0 ? labels : address ? [address] : [];
  if (all.length === 0) return null;
  return all.join(locale === 'ar' ? '، ' : ', ');
}

function positionApplicationCount(position: OwnerPosition): number | null {
  const value = (position as unknown as { applicationCount?: unknown }).applicationCount;
  return typeof value === 'number' ? value : null;
}

function positionAssignedCount(position: OwnerPosition): number | null {
  const value = (position as unknown as { assigned?: unknown }).assigned;
  return Array.isArray(value) ? value.length : null;
}

function positionsOf(opp: OwnerOpportunity): OwnerPosition[] {
  return Array.isArray(opp.positions) ? opp.positions : [];
}

// Applications received: sum of the embedded per-position counts (the
// list response carries no top-level count). The raw field is only a
// fallback for payloads without embeds.
function applicationsOf(opp: OwnerOpportunity): number {
  const embedded = positionsOf(opp)
    .map(positionApplicationCount)
    .filter((count): count is number => count !== null);
  if (embedded.length > 0) return embedded.reduce((sum, count) => sum + count, 0);
  return opp.applicationCount ?? 0;
}

// Active participants: embedded assigned names first, then filled seats,
// then the raw field. A missing number renders 0.
function participantsOf(opp: OwnerOpportunity): number {
  const positions = positionsOf(opp);
  const assigned = positions
    .map(positionAssignedCount)
    .filter((count): count is number => count !== null);
  if (assigned.length > 0) return assigned.reduce((sum, count) => sum + count, 0);
  const filled = positions
    .map((position) => (typeof position.filledCount === 'number' ? position.filledCount : null))
    .filter((count): count is number => count !== null);
  if (filled.length > 0) return filled.reduce((sum, count) => sum + count, 0);
  return opp.participantCount ?? 0;
}

// Open seats across all positions; null when no position states a capacity.
function openSeatsOf(opp: OwnerOpportunity): number | null {
  const positions = positionsOf(opp);
  if (positions.length === 0) return null;
  let capacity: number | null = null;
  let filled = 0;
  for (const position of positions) {
    if (typeof position.requiredCount === 'number') {
      capacity = (capacity ?? 0) + position.requiredCount;
    }
    if (typeof position.filledCount === 'number') {
      filled += position.filledCount;
    } else {
      filled += positionAssignedCount(position) ?? 0;
    }
  }
  if (capacity === null) return null;
  return Math.max(0, capacity - filled);
}

function dateTextOf(
  opp: OwnerOpportunity,
  status: string,
  locale: string,
  t: ReturnType<typeof useTranslations>,
): { text: string | null; concluded: boolean } {
  const start = formatLongDate(opp.startDate, locale);
  const end = formatLongDate(opp.endDate, locale);
  if (start && end) {
    return { text: start === end ? start : `${start} – ${end}`, concluded: false };
  }
  if (start) {
    if (status === 'draft') return { text: start, concluded: false };
    return { text: t('list.startsOn', { date: start }), concluded: false };
  }
  if (end) {
    if (status === 'completed') return { text: t('list.concludedOn', { date: end }), concluded: true };
    return { text: end, concluded: false };
  }
  return { text: null, concluded: false };
}

const PAGE_SIZE = 4;

type TabKey = 'all' | 'published' | 'draft' | 'completed';

const TABS: TabKey[] = ['all', 'published', 'draft', 'completed'];

const TAB_STATUS: Record<TabKey, string | undefined> = {
  all: undefined,
  published: 'published',
  draft: 'draft',
  completed: 'completed',
};

const TAB_LABEL_KEY: Record<TabKey, string> = {
  all: 'tabAll',
  published: 'tabPublished',
  draft: 'tabDrafts',
  completed: 'tabCompleted',
};

const STATUS_LABEL_KEY: Record<string, string> = {
  draft: 'statusDraft',
  published: 'statusPublished',
  completed: 'statusCompleted',
  in_progress: 'statusInProgress',
  closed: 'statusClosed',
  cancelled: 'statusCancelled',
};

// Per-card cover: resolves THIS card's coverMediaId to its own signed URL
// (the media query key contains the mediaId, so two opportunities with
// different covers can never share a URL). No cover — or an unresolvable
// one — renders a neutral block, never a shared/default/broken image.
function OppCover({
  mediaId,
  title,
  draft,
  testId,
}: {
  mediaId: string | null;
  title: string;
  draft: boolean;
  testId: string;
}) {
  const [failed, setFailed] = useState(false);
  const mediaQuery = useAccountMediaQuery(mediaId);
  const url = accountMediaUrlOf(mediaQuery.data);
  const frame =
    'h-52 w-full shrink-0 overflow-hidden rounded-lg bg-surface-muted xl:h-auto xl:w-72 xl:self-stretch';
  if (!mediaId || failed || (!mediaQuery.isPending && !url)) {
    return <div data-testid={testId} aria-hidden="true" className={frame} />;
  }
  if (mediaQuery.isPending || !url) {
    return (
      <div data-testid={`${testId}-loading`} aria-hidden="true" className={`${frame} animate-pulse`} />
    );
  }
  return (
    <div data-testid={testId} className={frame}>
      {/* eslint-disable-next-line @next/next/no-img-element -- per-card resolved cover URL with neutral-block fallback */}
      <img
        src={url}
        alt={title}
        loading="lazy"
        data-testid={`${testId}-img`}
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover ${draft ? 'grayscale-[25%]' : ''}`}
      />
    </div>
  );
}

// Completed-card impact line: neutral verified-experiences count from GET
// /organizations/me/experiences?opportunityId=. Missing → 0; a failed read
// omits the line instead of inventing a number.
function VerifiedExperiences({ opportunityId }: { opportunityId: string }) {
  const t = useTranslations('orgOpportunities');
  const query = useOrgExperiencesQuery({ opportunityId, limit: 1 });
  if (query.isPending || query.isError) return null;
  const total = query.data?.total ?? 0;
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-ink">
      <BadgeCheck size={16} aria-hidden="true" className="shrink-0 text-status-success" />
      <span>
        {total === 1 ? t('list.verifiedExperienceOne') : t('list.verifiedExperiences', { count: total })}
      </span>
    </span>
  );
}

const ACTION_PRIMARY =
  'inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3.5 text-title-sm font-medium text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50';
const ACTION_BORDERED =
  'inline-flex h-9 items-center justify-center rounded-lg border border-border bg-surface px-3.5 text-title-sm font-medium text-ink transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50';
const ACTION_GHOST =
  'inline-flex h-9 items-center gap-1 rounded-lg px-3 text-title-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50';
const ACTION_ICON =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50';
const ACTION_ICON_DANGER =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-status-error disabled:cursor-not-allowed disabled:opacity-50';

function OppCard({
  locale,
  opp,
  gate,
  verificationStatus,
  onChanged,
}: {
  locale: string;
  opp: OwnerOpportunity;
  gate: PublishGateStatus | undefined;
  verificationStatus: string | undefined;
  onChanged: (message: string) => void;
}) {
  const t = useTranslations('orgOpportunities');
  const router = useRouter();
  const id = opportunityIdOf(opp);
  const status = opportunityStatusOf(opp);
  const ref = opportunityRefOf(opp);
  const isDraft = status === 'draft';
  const isPublished = status === 'published';
  const isCompleted = status === 'completed';
  const availability = lifecycleAvailability(status, verificationStatus, gate?.locked);
  const duplicateMutation = useDuplicateOpportunityMutation();
  const deleteMutation = useDeleteDraftOpportunityMutation();
  const lifecycleMutation = useLifecycleActionMutation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-menu-root="opp-more"]')) return;
      setMoreOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [moreOpen]);

  const duplicate = async () => {
    setActionError(null);
    try {
      const copy = await duplicateMutation.mutateAsync(id);
      onChanged(t('list.duplicated'));
      const copyId = opportunityIdOf(copy);
      // NOTE: next-intl useRouter prefixes the active locale itself — passing
      // a locale-prefixed path here would double it (/{locale}/{locale}/…).
      if (copyId) router.push(`/org/opportunities/${copyId}`);
    } catch {
      setActionError(t('list.genericError'));
    }
  };

  const remove = async () => {
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(id);
      setConfirmingDelete(false);
      onChanged(t('list.deleted'));
    } catch {
      setActionError(t('list.genericError'));
    }
  };

  const runPublish = async () => {
    setActionError(null);
    try {
      await lifecycleMutation.mutateAsync({ opportunityId: id, action: 'publish' });
      setConfirmingPublish(false);
      onChanged(t('list.published'));
    } catch (err) {
      if (isOrgNotVerifiedError(err)) setActionError(t('create.notVerifiedError'));
      else if (isPublishGateLockedError(err)) setActionError(t('create.gateLockedError'));
      else if (isPublishingDisabledError(err)) setActionError(t('create.publishingDisabledError'));
      else setActionError(t('list.genericError'));
      setConfirmingPublish(false);
    }
  };

  // LOCALE-LESS: Link from @/i18n/navigation auto-prefixes the locale, so
  // hrefs must not embed `/${locale}/` (that rendered /en/en/... -> 404).
  const editorHref = `/org/opportunities/${id}`;
  const publicHref =
    typeof opp.slug === 'string' && opp.slug !== ''
      ? `/opportunities/${opp.slug}`
      : `/opportunities/${id}`;

  const openSeats = isPublished ? openSeatsOf(opp) : null;
  const subStatus = isPublished
    ? openSeats !== null && openSeats > 0
      ? openSeats === 1
        ? t('list.subOpenOne')
        : t('list.subOpen', { count: openSeats })
      : t('list.subAccepting')
    : isDraft
      ? t('list.subDraft')
      : isCompleted
        ? (() => {
            const end = formatLongDate(opp.endDate, locale);
            return end ? t('list.subArchived', { date: end }) : null;
          })()
        : null;

  const date = dateTextOf(opp, status, locale, t);
  const location = locationTextOf(opp, locale);
  const category = categoryNameOf(opp, locale);
  const meta: { Icon: typeof MapPin; text: string }[] = [];
  if (date.text) meta.push({ Icon: date.concluded ? CircleCheck : CalendarDays, text: date.text });
  if (location) meta.push({ Icon: MapPin, text: location });
  if (category) meta.push({ Icon: LayoutGrid, text: category });

  const shownPositions = positionsOf(opp).filter(
    (position) => typeof position.title === 'string' && position.title.trim() !== '',
  );

  const positionState = (position: OwnerPosition): string | null => {
    const required = typeof position.requiredCount === 'number' ? position.requiredCount : null;
    if (required === null) return null;
    if (isDraft) {
      const configured =
        required === 1 ? t('list.seatsConfiguredOne') : t('list.seatsConfigured', { count: required });
      return `(${configured})`;
    }
    const base = required === 1 ? t('list.seatsPositionOne') : t('list.seatsPositions', { count: required });
    const filled =
      typeof position.filledCount === 'number'
        ? position.filledCount
        : (positionAssignedCount(position) ?? 0);
    const open = Math.max(0, required - filled);
    const state =
      open > 0 ? t('list.seatsOpen', { count: open }) : t('list.seatsFilled', { count: filled });
    return `(${base} · ${state})`;
  };

  const applications = applicationsOf(opp);
  const participants = participantsOf(opp);
  const applicationsLabel =
    applications === 1 ? t('list.appsReceivedOne') : t('list.appsReceived', { count: applications });
  const participantsLabel =
    participants === 1
      ? t('list.activeParticipantsOne')
      : t('list.activeParticipants', { count: participants });

  return (
    <article data-testid="opportunity-row" className="flex flex-col gap-4 p-4 md:p-6 xl:flex-row">
      <OppCover
        mediaId={opp.coverMediaId ?? null}
        title={opp.title}
        draft={isDraft}
        testId={`opp-cover-${id}`}
      />
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label-sm">
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${isPublished ? 'bg-status-success' : 'bg-ink-muted'}`}
            />
            <span className={`text-title-sm font-medium ${isDraft ? 'text-ink-muted' : 'text-ink'}`}>
              {t(`list.${STATUS_LABEL_KEY[status] ?? 'statusDraft'}`)}
            </span>
            {subStatus ? (
              <Fragment>
                <span aria-hidden="true" className="text-ink-muted">
                  ·
                </span>
                <span className="text-ink-muted">{subStatus}</span>
              </Fragment>
            ) : null}
          </div>
          <h2 className="text-headline-md font-semibold tracking-tight text-ink">{opp.title}</h2>
          {ref ? (
            <p className="text-xs text-ink-muted">
              {t('list.refLabel')}: {ref}
            </p>
          ) : null}
          {opp.description ? (
            <p className="max-w-3xl text-body-md leading-relaxed text-ink-muted">{opp.description}</p>
          ) : null}
          {meta.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-body-sm text-ink-muted">
              {meta.map((item, index) => (
                <Fragment key={`${item.text}-${index}`}>
                  {index > 0 ? (
                    <span aria-hidden="true" className="text-ink-muted">
                      ·
                    </span>
                  ) : null}
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <item.Icon size={16} aria-hidden="true" className="shrink-0" />
                    <span className="min-w-0">{item.text}</span>
                  </span>
                </Fragment>
              ))}
            </div>
          ) : null}
          {shownPositions.length > 0 ? (
            <div className="mt-2 flex flex-col gap-y-2 gap-x-6 border-t border-border-muted pt-3 text-body-sm sm:flex-row sm:flex-wrap sm:items-center">
              {shownPositions.map((position, index) => {
                const state = positionState(position);
                const key =
                  (position.id ?? position._id ?? '').length > 0
                    ? (position.id ?? position._id) as string
                    : `pos-${index}`;
                return (
                  <Fragment key={key}>
                    {index > 0 ? (
                      <span aria-hidden="true" className="hidden text-ink-muted sm:inline">
                        ·
                      </span>
                    ) : null}
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Briefcase size={16} aria-hidden="true" className="shrink-0 text-ink" />
                      <span className="min-w-0 truncate font-medium text-ink">{position.title}</span>
                      {state ? <span className="shrink-0 text-ink-muted">{state}</span> : null}
                    </span>
                  </Fragment>
                );
              })}
            </div>
          ) : null}
          {isCompleted ? (
            <div className="mt-2 border-t border-border-muted pt-3 text-body-sm text-ink-muted">
              <VerifiedExperiences opportunityId={id} />
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 border-t border-border-muted pt-3 md:flex-row md:items-center md:justify-between">
          {isDraft ? (
            <p className="inline-flex items-center gap-1.5 text-body-sm text-ink-muted">
              <Info size={16} aria-hidden="true" className="shrink-0" />
              <span>{t('list.draftInProgress')}</span>
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-body-sm">
              <Link
                href="/org/applications"
                data-testid={`apps-opp-${id}`}
                className="group inline-flex items-center gap-1.5"
              >
                <span className="font-medium text-ink">{applications}</span>
                <span className="text-ink-muted group-hover:text-gold-strong">{applicationsLabel}</span>
                <ArrowRight
                  size={14}
                  aria-hidden="true"
                  className="text-ink-muted transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
                />
              </Link>
              <span aria-hidden="true" className="text-ink-muted">
                ·
              </span>
              <Link
                href="/org/participants"
                data-testid={`parts-opp-${id}`}
                className="group inline-flex items-center gap-1.5"
              >
                <span className="font-medium text-ink">{participants}</span>
                <span className="text-ink-muted group-hover:text-gold-strong">{participantsLabel}</span>
                <ArrowRight
                  size={14}
                  aria-hidden="true"
                  className="text-ink-muted transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
                />
              </Link>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {isPublished ? (
              <Fragment>
                <Link
                  href={editorHref}
                  data-testid={`manage-opp-${id}`}
                  className={ACTION_BORDERED}
                >
                  {t('list.manage')}
                </Link>
                <Link
                  href={publicHref}
                  data-testid={`public-opp-${id}`}
                  className={ACTION_GHOST}
                >
                  <span>{t('list.viewPublic')}</span>
                  <ExternalLink size={14} aria-hidden="true" />
                </Link>
                <div className="relative" ref={moreRef} data-menu-root="opp-more">
                  <button
                    type="button"
                    aria-label={t('list.moreOptions')}
                    aria-expanded={moreOpen}
                    aria-haspopup="menu"
                    data-testid={`more-opp-${id}`}
                    onClick={() => setMoreOpen((open) => !open)}
                    className={ACTION_ICON}
                  >
                    <MoreHorizontal size={18} aria-hidden="true" />
                  </button>
                  {moreOpen ? (
                    <div
                      role="menu"
                      aria-label={t('list.moreOptions')}
                      className="absolute end-0 top-full z-10 mt-1 min-w-[10rem] rounded-lg border border-border bg-surface p-1 shadow-raised"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        data-testid={`duplicate-opp-${id}`}
                        disabled={duplicateMutation.isPending}
                        onClick={() => {
                          setMoreOpen(false);
                          void duplicate();
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-title-sm text-ink transition-colors hover:bg-surface-muted disabled:opacity-50"
                      >
                        <Copy size={14} aria-hidden="true" className="shrink-0" />
                        <span>{t('list.duplicate')}</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </Fragment>
            ) : isDraft ? (
              <Fragment>
                <Link href={editorHref} data-testid={`edit-opp-${id}`} className={ACTION_PRIMARY}>
                  {t('list.continueEditing')}
                </Link>
                {confirmingPublish ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      data-testid={`publish-opp-confirm-${id}`}
                      disabled={lifecycleMutation.isPending}
                      onClick={() => void runPublish()}
                    >
                      {lifecycleMutation.isPending ? t('list.publishing') : t('create.confirmAction')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingPublish(false)}
                    >
                      {t('create.cancelAction')}
                    </Button>
                  </span>
                ) : availability.canPublish ? (
                  <button
                    type="button"
                    data-testid={`publish-opp-${id}`}
                    onClick={() => {
                      setActionError(null);
                      setConfirmingPublish(true);
                    }}
                    className={ACTION_BORDERED}
                  >
                    {t('list.publish')}
                  </button>
                ) : null}
                <button
                  type="button"
                  data-testid={`duplicate-opp-${id}`}
                  disabled={duplicateMutation.isPending}
                  onClick={() => void duplicate()}
                  className={ACTION_GHOST}
                >
                  <Copy size={14} aria-hidden="true" />
                  <span>{t('list.duplicate')}</span>
                </button>
                {confirmingDelete ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      data-testid={`delete-opp-confirm-${id}`}
                      disabled={deleteMutation.isPending}
                      onClick={() => void remove()}
                    >
                      {t('list.deleteConfirm')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingDelete(false)}
                    >
                      {t('list.deleteCancel')}
                    </Button>
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label={t('list.delete')}
                    title={t('list.delete')}
                    data-testid={`delete-opp-${id}`}
                    onClick={() => setConfirmingDelete(true)}
                    className={ACTION_ICON_DANGER}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                )}
              </Fragment>
            ) : (
              <Fragment>
                <Link
                  href={editorHref}
                  data-testid={`record-opp-${id}`}
                  className={ACTION_BORDERED}
                >
                  {isCompleted ? t('list.viewRecord') : t('list.manage')}
                </Link>
                <button
                  type="button"
                  data-testid={`duplicate-opp-${id}`}
                  disabled={duplicateMutation.isPending}
                  onClick={() => void duplicate()}
                  className={ACTION_GHOST}
                >
                  <Copy size={14} aria-hidden="true" />
                  <span>{t('list.duplicate')}</span>
                </button>
              </Fragment>
            )}
          </div>
          {isDraft && !availability.canPublish && !confirmingPublish ? (
            <PublishLockNote verificationStatus={verificationStatus} gate={gate} />
          ) : null}
          {actionError ? (
            <p role="alert" className="text-sm text-status-error md:basis-full">
              {actionError}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function pageWindow(current: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const wanted = new Set(
    [1, totalPages, current - 1, current, current + 1].filter(
      (page) => page >= 1 && page <= totalPages,
    ),
  );
  const ordered = [...wanted].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  ordered.forEach((page, index) => {
    if (index > 0 && page - ordered[index - 1] > 1) out.push('gap');
    out.push(page);
  });
  return out;
}

function initialQueryOf(
  initialSearch: Record<string, string | string[] | undefined> | undefined,
): string {
  const raw = initialSearch?.q;
  const first = Array.isArray(raw) ? raw[0] : raw;
  return typeof first === 'string' ? first.trim() : '';
}

export function OrgOpportunitiesPage({
  locale,
  initialSearch,
}: {
  locale: string;
  initialSearch?: Record<string, string | string[] | undefined>;
}) {
  const t = useTranslations('orgOpportunities');
  const [tab, setTab] = useState<TabKey>('all');
  // Seeded from ?q= so the navbar search lands here (mirrors the volunteer
  // opportunities page's initialSearch wiring); the in-page search box owns
  // subsequent edits via draftQ/apply.
  const [draftQ, setDraftQ] = useState(() => initialQueryOf(initialSearch));
  const [appliedQ, setAppliedQ] = useState(() => initialQueryOf(initialSearch));
  const [sort, setSort] = useState('');
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [pageIdx, setPageIdx] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const status = TAB_STATUS[tab];
  const filters = useMemo(
    () => ({
      q: appliedQ === '' ? undefined : appliedQ,
      sort: sort === '' ? undefined : sort,
      status,
      cursor: cursors[pageIdx],
      limit: PAGE_SIZE,
    }),
    [appliedQ, sort, status, cursors, pageIdx],
  );
  const listQuery = useOwnOpportunitiesQuery(filters);
  // Stat + tab totals read the real list endpoint with limit=1 (only the
  // cursor `total` is used). A missing total renders 0 — never invented.
  const totalQuery = useOwnOpportunitiesQuery({ limit: 1 });
  const publishedQuery = useOwnOpportunitiesQuery({ status: 'published', limit: 1 });
  const draftsQuery = useOwnOpportunitiesQuery({ status: 'draft', limit: 1 });
  const completedQuery = useOwnOpportunitiesQuery({ status: 'completed', limit: 1 });
  const gateQuery = usePublishGateQuery();
  const orgGateQuery = useOwnOrgGateQuery();
  const orgQuery = useMyOrganizationQuery();

  const resetPage = () => {
    setCursors([undefined]);
    setPageIdx(0);
  };

  const applySearch = () => {
    setAppliedQ(draftQ.trim());
    resetPage();
  };

  const applySort = (value: string) => {
    setSort(value);
    resetPage();
  };

  const selectTab = (key: TabKey) => {
    setTab(key);
    resetPage();
  };

  const totals: Record<TabKey, number> = {
    all: totalQuery.data?.total ?? 0,
    published: publishedQuery.data?.total ?? 0,
    draft: draftsQuery.data?.total ?? 0,
    completed: completedQuery.data?.total ?? 0,
  };

  const orgName = (() => {
    const org = orgQuery.data;
    if (!org) return '';
    return locale === 'ar' ? (org.nameAr ?? org.nameFr ?? '') : (org.nameFr ?? org.nameAr ?? '');
  })();

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const page = listQuery.data?.page ?? pageIdx + 1;
  const pages = Math.max(listQuery.data?.pages ?? pageIdx + 1, 1);
  const from = total === 0 || items.length === 0 ? 0 : pageIdx * PAGE_SIZE + 1;
  const to = pageIdx * PAGE_SIZE + items.length;
  const hasNext = Boolean(listQuery.data?.nextCursor) || page < pages;

  const onPage = (target: number) => {
    if (target < 1 || target === pageIdx + 1) return;
    if (target - 1 < cursors.length) {
      setPageIdx(target - 1);
      return;
    }
    if (target === pageIdx + 2 && listQuery.data?.nextCursor) {
      setCursors((current) => [...current, listQuery.data?.nextCursor ?? undefined]);
      setPageIdx(target - 1);
    }
  };

  const renderForbidden = (error: unknown) =>
    errorStateFor(mapToApiError(error)) === 'forbidden';

  return (
    <RequireOrgOpps locale={locale} next={`/org/opportunities`}>
      <div data-testid="org-opportunities" className="flex min-w-0 flex-col gap-6">
        <section className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-label-xs font-medium uppercase tracking-wider text-ink-muted">
              <span>{t('list.breadcrumbWorkspace')}</span>
              <span aria-hidden="true"> / </span>
              <span className="text-ink">{t('list.breadcrumbSection')}</span>
            </p>
            <h1 className="text-display-lg font-semibold tracking-tight text-ink">
              {t('list.title')}
            </h1>
            <p className="max-w-2xl text-body-lg text-ink-muted">
              {orgName ? t('list.subtitle', { name: orgName }) : t('list.subtitleFallback')}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-body-sm text-ink-muted">
              <p>
                <span data-testid="stat-total" className="font-semibold text-ink">
                  {totals.all}
                </span>{' '}
                <span>{t('list.statsTotal')}</span>
              </p>
              <span aria-hidden="true">·</span>
              <p>
                <span data-testid="stat-published" className="font-semibold text-ink">
                  {totals.published}
                </span>{' '}
                <span>{t('list.statsPublished')}</span>
              </p>
              <span aria-hidden="true">·</span>
              <p>
                <span data-testid="stat-drafts" className="font-semibold text-ink">
                  {totals.draft}
                </span>{' '}
                <span>{t('list.statsDrafts')}</span>
              </p>
              <span aria-hidden="true">·</span>
              <p>
                <span data-testid="stat-completed" className="font-semibold text-ink">
                  {totals.completed}
                </span>{' '}
                <span>{t('list.statsCompleted')}</span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              data-testid="create-opportunity-link"
              href="/org/opportunities/new"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-title-sm font-medium text-on-primary shadow-sm transition-colors hover:bg-primary-hover"
            >
              <Plus size={18} aria-hidden="true" className="shrink-0" />
              <span>{t('list.createCta')}</span>
            </Link>
          </div>
        </section>

        <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div
            role="group"
            aria-label={t('list.tabsLabel')}
            className="flex items-center gap-5 overflow-x-auto whitespace-nowrap border-b border-border"
          >
            {TABS.map((key) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  data-testid={`tab-${key}`}
                  onClick={() => selectTab(key)}
                  className={`flex shrink-0 items-center gap-1.5 border-b-2 pb-3 text-title-sm transition-colors ${
                    active
                      ? 'border-gold-strong font-medium text-ink'
                      : 'border-transparent text-ink-muted hover:text-ink'
                  }`}
                >
                  <span>{t(`list.${TAB_LABEL_KEY[key]}`)}</span>
                  <span className="text-body-sm text-ink-muted">{totals[key]}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <label htmlFor="opp-search" className="sr-only">
                {t('list.searchLabel')}
              </label>
              <input
                id="opp-search"
                type="text"
                value={draftQ}
                placeholder={t('list.searchPlaceholder')}
                onChange={(event) => setDraftQ(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applySearch();
                }}
                className="h-10 w-full rounded-lg border border-border bg-surface py-2 pe-3 ps-9 text-body-sm text-ink placeholder:text-ink-muted focus:border-gold-strong focus:outline-none"
              />
            </div>
            <div className="w-full sm:w-44">
              <label htmlFor="opp-sort" className="sr-only">
                {t('list.sortLabel')}
              </label>
              <select
                id="opp-sort"
                value={sort}
                onChange={(event) => applySort(event.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-body-sm text-ink focus:border-gold-strong focus:outline-none"
              >
                <option value="">{t('list.sortNewest')}</option>
                <option value="newest">{t('list.sortNewest')}</option>
                <option value="oldest">{t('list.sortOldest')}</option>
              </select>
            </div>
            <Button
              type="button"
              variant="secondary"
              data-testid="opp-search-apply"
              onClick={applySearch}
              className="shrink-0"
            >
              {t('list.searchLabel')}
            </Button>
          </div>
        </section>

        {notice ? (
          <p data-testid="opp-notice" role="status" className="text-sm text-ink">
            {notice}
          </p>
        ) : null}

        {listQuery.isPending ? (
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <div data-testid="org-opportunities-loading" className="p-6">
              <Loader label={t('list.loading')} />
            </div>
          </div>
        ) : listQuery.isError ? (
          (() => {
            const state = errorStateFor(mapToApiError(listQuery.error));
            if (state === 'session-expired') return <SessionExpiredScreen />;
            if (renderForbidden(listQuery.error)) return <ForbiddenScreen />;
            return (
              <div className="overflow-hidden rounded-xl border border-border bg-surface p-6 shadow-sm">
                <OppSectionError message={t('list.genericError')} testId="org-opportunities-error" />
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void listQuery.refetch()}
                  >
                    {t('list.retry')}
                  </Button>
                </div>
              </div>
            );
          })()
        ) : items.length === 0 ? (
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <Empty
              title={t('list.empty')}
              description={t('list.emptyDescription')}
              action={
                <Link
                  href="/org/opportunities/new"
                  className="text-sm font-medium text-gold-strong hover:underline"
                >
                  {t('list.createCta')}
                </Link>
              }
            />
          </div>
        ) : (
          <section className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            {items.map((opp) => (
              <OppCard
                key={opportunityIdOf(opp)}
                locale={locale}
                opp={opp}
                gate={gateQuery.data}
                verificationStatus={orgGateQuery.data?.verificationStatus}
                onChanged={setNotice}
              />
            ))}
          </section>
        )}

        {!listQuery.isPending && !listQuery.isError && items.length > 0 ? (
          <footer className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p data-testid="org-opportunities-count" className="text-body-sm text-ink-muted">
              {t('list.showing', { from, to, total })}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPage(page - 1)}
                className="h-9 rounded-lg border border-border bg-surface px-3 text-title-sm font-medium text-ink transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface"
              >
                {t('list.previous')}
              </button>
              {pageWindow(page, pages).map((entry, index) =>
                entry === 'gap' ? (
                  <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-ink-muted">
                    …
                  </span>
                ) : (
                  <button
                    key={entry}
                    type="button"
                    aria-current={entry === page ? 'page' : undefined}
                    aria-label={`${entry}`}
                    disabled={
                      entry !== page && !(entry - 1 < cursors.length) && !(entry === pageIdx + 2)
                    }
                    onClick={() => onPage(entry)}
                    className={`h-9 w-9 rounded-lg text-title-sm font-medium transition-colors ${
                      entry === page
                        ? 'bg-primary text-on-primary'
                        : 'text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50'
                    }`}
                  >
                    {entry}
                  </button>
                ),
              )}
              <button
                type="button"
                disabled={!hasNext}
                onClick={() => onPage(page + 1)}
                className="h-9 rounded-lg border border-border bg-surface px-3 text-title-sm font-medium text-ink transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface"
              >
                {t('list.next')}
              </button>
            </div>
          </footer>
        ) : null}
      </div>
    </RequireOrgOpps>
  );
}
