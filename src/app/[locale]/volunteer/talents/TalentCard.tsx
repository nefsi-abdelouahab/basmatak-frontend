'use client';

import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Link2,
  MapPin,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { usePublicMediaQuery, usePublicTalentProfileQuery } from '@/hooks/usePublicTalent';
import {
  isImageMedia,
  isLinkMedia,
  publicDisplayName,
  resolvePublicProfileSections,
  type PublicPortfolioItem,
  type WeeklySchedule,
} from '@/lib/api/publicTalent';
import type { TalentCard as TalentCardData } from '@/lib/api/feed';

// Real `GET /talents` card projection (backend `mapTalentCards`): username,
// firstName, bio, location{wilayaId}, skills[{skillId,nameFr,nameAr}],
// avatar (media id), stats{verifiedExperiences,volunteerHours}, isFavorited,
// favoriteCount. The card projection carries no headline, availability, or
// portfolio — those three render from the volunteer's real public profile
// (`GET /volunteers/:username`, same gated resolver the profile page uses)
// and each block is omitted entirely while loading, opted out, or empty.
// Nothing is fabricated when the server omits a value.

interface TalentStats {
  verifiedExperiences?: number;
  volunteerHours?: number;
}

interface TalentSkill {
  skillId: string;
  nameFr?: string | null;
  nameAr?: string | null;
}

function readStats(item: TalentCardData): TalentStats | null {
  const stats = (item as TalentCardData & { stats?: unknown }).stats;
  if (stats == null || typeof stats !== 'object') return null;
  const record = stats as Record<string, unknown>;
  const verified = record.verifiedExperiences;
  const hours = record.volunteerHours;
  return {
    verifiedExperiences: typeof verified === 'number' ? verified : undefined,
    volunteerHours: typeof hours === 'number' ? hours : undefined,
  };
}

function readSkills(item: TalentCardData): TalentSkill[] {
  const skills = (item as TalentCardData & { skills?: unknown }).skills;
  if (!Array.isArray(skills)) return [];
  return skills.filter(
    (s): s is TalentSkill =>
      typeof s === 'object' && s !== null && typeof (s as TalentSkill).skillId === 'string',
  );
}

function readExperienceCount(item: TalentCardData): number | null {
  const value = (item as TalentCardData & { experienceCount?: unknown }).experienceCount;
  return typeof value === 'number' ? value : null;
}

function skillLabel(skill: TalentSkill, locale: string): string {
  if (locale === 'ar') return skill.nameAr ?? skill.nameFr ?? skill.skillId;
  return skill.nameFr ?? skill.nameAr ?? skill.skillId;
}

function hasScheduleSlots(schedule: WeeklySchedule | null): boolean {
  if (!schedule) return false;
  return Object.values(schedule).some((day) => Array.isArray(day) && day.length > 0);
}

function TalentAvatar({ mediaId, name }: { mediaId: string | null; name: string }) {
  const query = usePublicMediaQuery(mediaId ?? '');
  const data = query.data as { url?: string | null; media?: { url?: string | null } } | undefined;
  const url = (mediaId ? (data?.url ?? data?.media?.url ?? null) : null) ?? '/user.jpg';
  return (
    // eslint-disable-next-line @next/next/no-img-element -- guest-resolved signed URL with local fallback
    <img
      src={url}
      alt={name}
      loading="lazy"
      onError={(event) => {
        if (!event.currentTarget.src.endsWith('/user.jpg')) event.currentTarget.src = '/user.jpg';
      }}
      className="h-14 w-14 shrink-0 rounded-full object-cover shadow-sm"
    />
  );
}

function PortfolioItemIcon({ item }: { item: PublicPortfolioItem }) {
  const first = item.media?.[0] ?? null;
  if (isImageMedia(first)) return <ImageIcon aria-hidden="true" size={14} className="shrink-0 text-ink-muted" />;
  if (isLinkMedia(first)) return <Link2 aria-hidden="true" size={14} className="shrink-0 text-ink-muted" />;
  return <FileText aria-hidden="true" size={14} className="shrink-0 text-ink-muted" />;
}

// Discover directory card (Discover Talents design): identity row, verified
// stats, bio, skill tags, public-portfolio preview, availability line, and the
// view-profile action. Only server-provided values render.
// `profileBase` keeps the card shell-agnostic: the volunteer list passes
// `/volunteer/talents` (default, preserves the existing route exactly) while
// the org workspace passes `/org/volunteers` — same content, only the
// wrapping shell/route differs.
export function TalentCard({
  item,
  locale,
  wilayaLabel,
  profileBase = '/volunteer/talents',
}: {
  item: TalentCardData;
  locale: string;
  wilayaLabel: string | null;
  profileBase?: string;
}) {
  const t = useTranslations('volunteerHome');
  const name = publicDisplayName(item.firstName ?? null, item.username);
  const stats = readStats(item);
  const verifiedCount = stats?.verifiedExperiences ?? readExperienceCount(item) ?? 0;
  const hours = stats?.volunteerHours;
  const skills = readSkills(item).slice(0, 5);
  // Only a resolved localized label renders — an unknown wilaya id is
  // omitted entirely so internal ids never reach the UI.
  const hasWilaya = wilayaLabel;
  // Shell-agnostic profile route: volunteer (`/volunteer/talents/:username`)
  // vs org (`/org/volunteers/:username`) — same public-profile content behind
  // both (same section ids, so the #portfolio anchor keeps working).
  const profileHref = `${profileBase}/${item.username}`;

  // Headline, availability, and portfolio are NOT in the card projection;
  // they resolve from the real public profile with the profile page's own
  // opt-out gating (closed gate => block omitted, never a placeholder).
  const profileQuery = usePublicTalentProfileQuery(item.username);
  const sections = profileQuery.data ? resolvePublicProfileSections(profileQuery.data) : null;
  const headline = sections?.bio.open ? (sections.bio.data.headline ?? null) : null;
  const availabilityNote = sections?.bio.open ? (sections.bio.data.availabilityNote ?? null) : null;
  const availabilityOpen = sections?.availability.open ?? false;
  const showAvailableLine =
    availabilityNote !== null && availabilityNote !== ''
      ? availabilityNote
      : availabilityOpen && hasScheduleSlots(sections?.availability.data ?? null)
        ? t('talents.availableBadge')
        : null;
  const portfolioItems = sections?.portfolio.open ? sections.portfolio.data : null;
  const showPortfolio = portfolioItems !== null && portfolioItems.length > 0 ? portfolioItems : null;

  return (
    <article
      data-testid="talent-card"
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <TalentAvatar mediaId={item.avatar ?? null} name={name} />
          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="min-w-0 break-words text-base font-semibold text-ink">
                <Link href={profileHref} className="transition-colors hover:text-gold-strong">
                  {name}
                </Link>
              </h3>
              {verifiedCount > 0 ? (
                <span className="inline-flex items-center gap-0.5 rounded bg-surface-muted px-1.5 py-0.5 text-xs font-medium text-ink-muted">
                  <BadgeCheck aria-hidden="true" size={14} className="text-status-success" />
                  {t('talents.verifiedMember')}
                </span>
              ) : null}
            </div>
            {headline ? <p className="mt-0.5 text-sm text-ink-muted">{headline}</p> : null}
            {hasWilaya ? (
              <p className="mt-1 flex items-center gap-1 text-sm text-ink-muted">
                <MapPin aria-hidden="true" size={14} className="shrink-0" />
                <span className="truncate">{hasWilaya}</span>
              </p>
            ) : null}
          </div>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1 text-end sm:flex rtl:items-start">
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-status-success">
            <CheckCircle2 aria-hidden="true" size={16} />
            {t('talents.verifiedExperiences', { count: verifiedCount })}
          </span>
          {typeof hours === 'number' ? (
            <span className="text-sm text-ink-muted">{t('talents.hoursDocumented', { hours })}</span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 sm:hidden">
        <span className="inline-flex items-center gap-1 text-sm font-medium text-status-success">
          <CheckCircle2 aria-hidden="true" size={14} />
          {t('talents.verifiedExperiences', { count: verifiedCount })}
        </span>
        {typeof hours === 'number' ? (
          <span className="text-xs text-ink-muted">{t('talents.hoursDocumentedShort', { hours })}</span>
        ) : null}
      </div>

      {item.bio ? <p className="text-sm leading-relaxed text-ink">{item.bio}</p> : null}

      {skills.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {skills.map((skill) => (
            <span
              key={skill.skillId}
              className="rounded-md bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-muted"
            >
              {skillLabel(skill, locale)}
            </span>
          ))}
        </div>
      ) : null}

      {showPortfolio ? (
        <div className="flex flex-col gap-2 rounded-lg bg-surface-muted p-3">
          <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
            {t('talents.portfolioTitle', { count: showPortfolio.length })}
          </span>
          <div className="flex flex-wrap gap-2">
            {showPortfolio.slice(0, 3).map((portfolioItem) => (
              <Link
                key={portfolioItem.id}
                href={`${profileHref}#portfolio`}
                className="inline-flex items-center gap-1.5 rounded bg-surface px-3 py-1.5 text-sm text-ink shadow-sm transition-colors hover:text-gold-strong"
              >
                <PortfolioItemIcon item={portfolioItem} />
                <span>{portfolioItem.title ?? portfolioItem.typeLabel ?? t('talents.portfolioItemFallback')}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col items-start justify-between gap-3 border-t border-border-muted pt-3 sm:flex-row sm:items-center">
        {showAvailableLine ? (
          <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-status-success" />
            {showAvailableLine}
          </span>
        ) : null}
        <Link
          href={profileHref}
          aria-label={t('talents.viewProfile')}
          title={t('talents.viewProfile')}
          className="inline-flex items-center justify-center rounded-lg p-2 text-gold-strong transition-colors hover:bg-surface-muted sm:ms-auto"
        >
          <ArrowRight aria-hidden="true" size={20} className="rtl:rotate-180" />
        </Link>
      </div>
    </article>
  );
}
