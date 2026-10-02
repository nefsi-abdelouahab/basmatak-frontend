'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  Bookmark,
  Building2,
  CalendarDays,
  Check,
  CircleCheck,
  Clock,
  Hourglass,
  MapPin,
  Share2,
  Users,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { useSessionQuery, getLoginHref } from '@/hooks/useSession';
import { useToggleOpportunityFavoriteMutation, isAuthError } from '@/hooks/useFavorites';
import { isOrgVerified, opportunityRef, orgDisplayName } from '@/hooks/useFeed';
import type {
  FeedLabel,
  FeedPosition,
  OpportunityCard as OpportunityCardData,
} from '@/lib/api/feed';

function SaveOpportunityButton({
  id,
  favorited,
  next,
  testId,
}: {
  id: string;
  favorited: boolean;
  next: string;
  testId: string;
}) {
  const t = useTranslations('volunteerHome');
  const session = useSessionQuery();
  const router = useRouter();
  const toggle = useToggleOpportunityFavoriteMutation();
  const goLogin = () => router.replace(getLoginHref(next));
  return (
    <button
      type="button"
      aria-pressed={favorited}
      data-testid={`${testId}`}
      disabled={toggle.isPending}
      onClick={() => {
        if (!session.data) {
          goLogin();
          return;
        }
        toggle.mutate(
          { id, favorited },
          { onError: (err) => { if (isAuthError(err)) goLogin(); } },
        );
      }}
      className="inline-flex items-center gap-1.5 rounded-lg bg-surface-muted px-3.5 py-2 text-label-sm text-ink-muted transition-colors hover:bg-border-muted hover:text-ink disabled:opacity-50"
    >
      <Bookmark size={17} aria-hidden="true" className={favorited ? 'fill-current' : ''} />
      <span>{favorited ? t('opportunities.unsaveLabel') : t('opportunities.saveLabel')}</span>
    </button>
  );
}

function ShareOpportunityButton({ title, detailHref }: { title: string; detailHref: string }) {
  const t = useTranslations('volunteerHome');
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={async () => {
          const url = `${window.location.origin}${detailHref}`;
          if (typeof navigator.share === 'function') {
            try {
              await navigator.share({ title, url });
              return;
            } catch {
              return;
            }
          }
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 2500);
          } catch {
            setCopied(false);
          }
        }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-surface-muted px-3.5 py-2 text-label-sm text-ink-muted transition-colors hover:bg-border-muted hover:text-ink"
      >
        {copied ? (
          <Check size={17} aria-hidden="true" className="text-status-success" />
        ) : (
          <Share2 size={17} aria-hidden="true" />
        )}
        <span>{copied ? t('opportunities.shareCopied') : t('opportunities.shareLabel')}</span>
      </button>
    </span>
  );
}

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '';
  return new Date(iso).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const time = date.getTime();
  if (!Number.isFinite(time)) return '';
  if (date.getHours() === 0 && date.getMinutes() === 0) return '';
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

// Posted recency from the real `createdAt` stamp (the list payload carries it
// outside the card schema, so it arrives via the passthrough). Missing or
// unparsable stamps render nothing — never a placeholder.
function postedAgo(createdAt: unknown, locale: string): string | null {
  if (typeof createdAt !== 'string' || createdAt === '') return null;
  const time = new Date(createdAt).getTime();
  if (!Number.isFinite(time)) return null;
  const diffSeconds = Math.floor((Date.now() - time) / 1000);
  if (diffSeconds < 0) return null;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (diffSeconds < 60) return format.format(-diffSeconds, 'second');
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return format.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return format.format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 7) return format.format(-days, 'day');
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return format.format(-weeks, 'week');
  const months = Math.floor(days / 30);
  if (months < 12) return format.format(-months, 'month');
  return format.format(-Math.floor(days / 365), 'year');
}

function labelFor(label: FeedLabel | null | undefined, locale: string): string {
  if (!label) return '';
  if (locale === 'ar') return label.nameAr ?? label.nameFr ?? '';
  return label.nameFr ?? label.nameAr ?? '';
}

function seatTotals(positions: FeedPosition[] | null | undefined): {
  required: number;
  filled: number;
  known: boolean;
} {
  const list = positions ?? [];
  let required = 0;
  let filled = 0;
  let known = false;
  for (const position of list) {
    if (typeof position.requiredCount === 'number' && typeof position.filledCount === 'number') {
      required += position.requiredCount;
      filled += Math.min(position.filledCount, position.requiredCount);
      known = true;
    }
  }
  return { required, filled, known };
}

function hoursValue(durationMinutes: number | null | undefined): number | null {
  if (typeof durationMinutes !== 'number' || !Number.isFinite(durationMinutes)) return null;
  const hours = durationMinutes / 60;
  return Number.isInteger(hours) ? hours : Math.round(hours * 10) / 10;
}

// Skill pills assemble only real labels: per-position skill names plus the
// category name, de-duplicated in first-seen order. Nothing renders when the
// payload carries no skill or category labels.
function skillPills(
  positions: FeedPosition[] | null | undefined,
  categoryName: string,
  locale: string,
): string[] {
  const pills: string[] = [];
  const seen = new Set<string>();
  const push = (label: string) => {
    const trimmed = label.trim();
    if (trimmed !== '' && !seen.has(trimmed)) {
      seen.add(trimmed);
      pills.push(trimmed);
    }
  };
  for (const position of positions ?? []) {
    for (const skill of position.skillNames ?? []) {
      if (!skill) continue;
      push(locale === 'ar' ? (skill.nameAr ?? skill.nameFr ?? '') : (skill.nameFr ?? skill.nameAr ?? ''));
    }
  }
  push(categoryName);
  return pills;
}

// Design card port (code.html opportunity feed): neutral org-icon block with
// the verified mark inline, title link, metadata strip with the real deadline,
// the full open-positions breakdown, real skill pills, and the Save / Share /
// View actions. Embed-only (no N+1): the list payload carries no logo URL, so
// the mark stays a neutral icon block — never derived initials or imagery.
// The header options control from the design has no backend action and stays
// out; the integrity footnote from the design carries excluded copy and the
// perks family of fields were cut upstream, so neither renders here.
//
// `interactive` (default true) keeps the volunteer-feed behavior. The Create
// Opportunity live preview reuses this same component with
// `interactive={false}` so the unpublished draft renders through the real
// card markup: the title is plain text and the Save / Share / View footer
// (all meaningless pre-publish — no id exists to favorite, share, or open)
// is omitted instead of being faked with a separate hardcoded preview.
export function OpportunityCard({
  item,
  locale,
  favorited,
  next,
  saveTestIdPrefix = 'save-opp',
  detailsBasePath = '/volunteer/opportunities',
  interactive = true,
}: {
  item: OpportunityCardData;
  locale: string;
  favorited: boolean;
  // Kept for caller compatibility (dashboard + opportunities pass the lookup
  // count); the design card shows no count badge, so it stays unread here.
  favoriteCount?: number | null;
  next: string;
  saveTestIdPrefix?: string;
  detailsBasePath?: string;
  interactive?: boolean;
}) {
  const t = useTranslations('volunteerHome');
  const id = item.id ?? item._id ?? '';
  const detailId = item.slug ?? item.idOrSlug ?? id;
  const detailHref = `${detailsBasePath}/${detailId}`;
  const ref = opportunityRef(item.registryId ?? null);
  const hours = hoursValue(item.durationMinutes ?? null);
  const orgName = orgDisplayName(item.organization, locale);
  const verified = isOrgVerified(item.organization);
  const categoryName = labelFor(item.categoryName, locale);
  const wilayaName = labelFor(item.locationLabels?.wilaya, locale);
  const municipalityName = labelFor(item.locationLabels?.municipality, locale);
  const placeName = [municipalityName, wilayaName].filter(Boolean).join(', ');
  const startLabel = formatDate(item.startDate, locale);
  const startTime = formatTime(item.startDate, locale);
  const dateLabel = [startLabel, startTime].filter(Boolean).join(' · ');
  const deadlineLabel = formatDate(item.applicationDeadline, locale);
  const posted = postedAgo((item as { createdAt?: unknown }).createdAt, locale);
  const subline = [posted, categoryName].filter(Boolean).join(' · ');
  const positions = item.positions ?? [];
  const seats = seatTotals(positions);
  const pills = skillPills(positions, categoryName, locale);
  const title = item.title ?? detailId;

  return (
    <article
      data-testid="opportunity-card"
      className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-primary"
        >
          <Building2 size={20} />
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="flex min-w-0 items-center gap-1.5">
            {orgName ? (
              <span data-testid="opportunity-org" className="truncate text-title-sm font-semibold text-ink">
                {orgName}
              </span>
            ) : null}
            {verified ? (
              <span className="inline-flex shrink-0 items-center text-status-success" title={t('opportunities.verifiedBadge')}>
                <CircleCheck size={15} aria-hidden="true" />
              </span>
            ) : null}
          </div>
          {subline !== '' ? (
            <span className="truncate text-label-xs text-ink-muted">{subline}</span>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        {interactive ? (
          <Link
            href={detailHref}
            className="text-title-lg font-semibold tracking-tight text-ink transition-colors hover:text-primary"
          >
            {title}
          </Link>
        ) : (
          <p data-testid="opportunity-title-preview" className="text-title-lg font-semibold tracking-tight text-ink">
            {title}
          </p>
        )}
        {item.description ? (
          <p className="text-body-md leading-relaxed text-ink-muted">{item.description}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-surface-muted px-3 py-2 text-label-xs text-ink-muted">
        {placeName !== '' ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <MapPin size={16} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{placeName}</span>
          </span>
        ) : null}
        {dateLabel !== '' ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <CalendarDays size={16} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{dateLabel}</span>
          </span>
        ) : null}
        {hours !== null ? (
          <span data-testid="opportunity-hours" className="inline-flex min-w-0 items-center gap-1.5">
            <Clock size={16} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{t('opportunities.hoursSuffix', { hours })}</span>
          </span>
        ) : null}
        {seats.known && seats.required > 0 ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Users size={16} aria-hidden="true" className="shrink-0 text-status-success" />
            <span className="truncate">
              {t('opportunities.positionsFilled', { filled: seats.filled, total: seats.required })}
            </span>
          </span>
        ) : null}
        {deadlineLabel !== '' ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 font-medium ms-auto">
            <Hourglass size={16} aria-hidden="true" className="shrink-0 text-status-pending" />
            <span className="truncate">{t('opportunities.deadlineLabel', { date: deadlineLabel })}</span>
          </span>
        ) : null}
      </div>

      {positions.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-2 pt-1">
          <span className="text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
            {t('opportunities.openPositions')}
          </span>
          <div className="flex min-w-0 flex-col gap-2.5">
            {positions.map((position, index) => {
              const key = position._id ?? position.id ?? position.title ?? `position-${index}`;
              const positionSkills = (position.skillNames ?? [])
                .map((skill) =>
                  locale === 'ar'
                    ? (skill?.nameAr ?? skill?.nameFr ?? '')
                    : (skill?.nameFr ?? skill?.nameAr ?? ''),
                )
                .filter((label): label is string => label.trim() !== '');
              const meta = [
                typeof position.requiredCount === 'number'
                  ? t('opportunities.positionsLine', {
                      required: position.requiredCount,
                      open:
                        typeof position.filledCount === 'number'
                          ? Math.max(0, position.requiredCount - position.filledCount)
                          : position.requiredCount,
                    })
                  : null,
                positionSkills.length > 0
                  ? t('opportunities.positionSkills', { skills: positionSkills.join(', ') })
                  : null,
              ].filter((part): part is string => part !== null);
              return (
                <div key={key}>
                  {index > 0 ? <div className="mb-2.5 h-px w-full bg-border-muted" aria-hidden="true" /> : null}
                  <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="truncate text-body-sm font-medium text-ink">{position.title}</span>
                    </div>
                    {meta.length > 0 ? (
                      <span className="truncate text-label-xs text-ink-muted sm:shrink-0">
                        {meta.join(' · ')}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {pills.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {pills.map((pill) => (
            <span
              key={pill}
              className="rounded-md bg-surface-muted px-2.5 py-1 text-label-xs text-ink-muted"
            >
              {pill}
            </span>
          ))}
        </div>
      ) : null}

      {ref ? (
        <p data-testid="opportunity-ref" className="text-label-xs text-ink-muted">
          {t('opportunities.refLabel', { ref })}
        </p>
      ) : null}

      {interactive ? (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            {id !== '' ? (
              <SaveOpportunityButton id={id} favorited={favorited} next={next} testId={`${saveTestIdPrefix}-${id}`} />
            ) : null}
            <ShareOpportunityButton title={title} detailHref={detailHref} />
          </div>
          <Link
            href={detailHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-label-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-hover"
          >
            <span>{t('opportunities.viewOpportunity')}</span>
            <ArrowRight size={16} aria-hidden="true" className="rtl:rotate-180" />
          </Link>
        </div>
      ) : null}
    </article>
  );
}
