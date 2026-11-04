'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ArrowLeft, BadgeCheck, Check, Copy, Download, MapPin, Pencil, ShieldCheck } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { Pagination } from '@/components/ui/Pagination';
import { Pill } from '@/components/ui/Pill';
import { mapToApiError } from '@/lib/api/errors';
import { notify } from '@/lib/notify';
import { useSessionQuery, getLoginHref } from '@/hooks/useSession';
import { useVolunteerMeQuery } from '@/hooks/useVolunteerAccount';
import { useToggleTalentFavoriteMutation, isAuthError } from '@/hooks/useFavorites';
import {
  usePublicTalentExperiencesQuery,
  usePublicTalentProfileQuery,
  usePublicTalentReviewsQuery,
  usePublicTalentWilayasQuery,
  invalidatePublicTalentProfile,
} from '@/hooks/usePublicTalent';
import {
  DAY_KEYS,
  emptySchedule,
  experiencesGateOpen,
  hoursFromMinutes,
  humanExperienceSkillLabels,
  isImageMedia,
  isLinkMedia,
  mergeUniqueById,
  publicDisplayName,
  registryCode,
  resolvePublicProfileSections,
  skillNameMapOf,
  sortAreasByPercentDesc,
  verifiedLineParts,
  type DayKey,
  type PublicExperience,
  type PublicPortfolioItem,
  type WeeklySchedule,
} from '@/lib/api/publicTalent';
import { PublicEvidenceMedia, PublicMediaImage, PublicMediaLink, PublicLinkPreview, PortfolioPlaceholder } from './PublicMediaParts';

// F17 merged public volunteer profile (plan M1: Talent layout as the base plus
// the Volunteer folder's media grid and stats strip). This route ALWAYS renders
// inside the (shared) group (PublicNavbar + PublicFooter) for every viewer —
// anonymous, volunteer, or organization. There is no sidebar on this route and
// no layout branch: session only toggles two header buttons (content-level).
//
// - Save: visible only when authenticated AND not the profile owner (real
//   POST/DELETE /favorites/talents/:username; hidden for guests and owners).
// - Edit profile: visible only when the viewer owns this profile.
// Icon map (Public Talent Profile code.html Material Symbol -> lucide-react):
// arrow_back -> ArrowLeft, verified/check_circle -> BadgeCheck (verified line),
// location_on -> MapPin (location meta), verified_user -> ShieldCheck
// (neutral Verification card — no tier/endorsement copy, which has no backend
// field), open_in_new -> Copy/Check (Copy Profile Link button),
// calendar_today -> omitted (member-since is a registry-membership claim,
// never rendered), task_alt -> omitted (endorsement copy has no backend
// field), article/psychology/workspace_premium/folder_open/volunteer_activism/
// mic/map/translate/format_quote/schedule/lock/output/check -> documented
// only (sections render as neutral cards without per-section icons),
// expand_more, assignment, explore, group, language, notifications, search,
// space_dashboard, folder_shared, tune (dashboard sidebar icons — the
// app-shell sidebar is never rendered on this route, so these have no
// mapping target; the in-content profile <aside> below carries no icon set).
//
// GATING: every block renders from `resolvePublicProfileSections`, so a closed
// show-flag emits no heading, count, placeholder, empty state or reserved
// space. The experiences paginator is enabled from `experiencesGateOpen` only.
// Curation deliberately absent: the payload's ungated `createdAt` is never
// rendered (a member-since line is a registry-membership claim), there is no
// apply/contact/invite control, no verification tier, and no public activity
// stream. The design's free-form "Community Contributions" list is CUT per the
// reconciliation (no backend field); the Recommendations (reviews) section is
// the real community signal and the tab points there.

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '';
  return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

function Avatar({ mediaId, hidden }: { mediaId: string | null; hidden: boolean }) {
  // Photo when one is uploaded; the neutral public/user.jpg fallback when
  // the profile is otherwise public but no photo was uploaded. Nothing at
  // all only when the profile is fully closed (every opt-out gate shut) —
  // the fallback never overrides an explicit hide. The API sends null for
  // both "never uploaded" and "hidden", so "any open gate" is the proxy for
  // "public profile" (see avatarHidden below).
  if (hidden) return null;
  return (
    <div
      data-testid="profile-avatar"
      className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-surface-muted"
    >
      {mediaId ? (
        <PublicMediaImage media={{ mediaId }} fallbackSrc="/user.jpg" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- neutral local fallback portrait
        <img src="/user.jpg" alt="" className="h-full w-full object-cover" />
      )}
    </div>
  );
}

function SaveProfileButton({
  username,
  favorited,
  count,
  next,
}: {
  username: string;
  favorited: boolean;
  count: number;
  next: string;
}) {
  const t = useTranslations('publicTalent');
  const session = useSessionQuery();
  const queryClient = useQueryClient();
  const router = useRouter();
  const toggle = useToggleTalentFavoriteMutation();
  // `getLoginHref` returns a locale-less `/login` because the locale-aware
  // router adds the prefix; handing it a pre-prefixed path double-prefixed it.
  const goLogin = () => router.replace(getLoginHref(next));
  return (
    <Button
      type="button"
      variant={favorited ? 'secondary' : 'primary'}
      size="sm"
      aria-pressed={favorited}
      data-testid="profile-save"
      disabled={toggle.isPending}
      onClick={() => {
        if (!session.data) {
          goLogin();
          return;
        }
        toggle.mutate(
          { username, favorited },
          {
            // The shared mutation cannot see this session's keys, so refresh the
            // profile here to settle `aria-pressed` and the count from source.
            onSuccess: () => invalidatePublicTalentProfile(queryClient, username),
            onError: (err) => {
              if (isAuthError(err)) goLogin();
            },
          },
        );
      }}
    >
      {favorited ? t('profile.unsaveLabel') : t('profile.saveLabel')}
      {typeof count === 'number' ? ` (${count})` : null}
    </Button>
  );
}

function StatsStrip({
  completedTasks,
  verifiedExperiences,
  volunteerHours,
  skillsCount,
}: {
  completedTasks: number;
  verifiedExperiences: number;
  /** Already converted from stored minutes by the caller. */
  volunteerHours: string;
  skillsCount: number | null;
}) {
  const t = useTranslations('publicTalent');
  const cells = [
    { key: 'completedTasks', value: completedTasks, label: t('stats.completedTasks') },
    { key: 'verifiedExperiences', value: verifiedExperiences, label: t('stats.verifiedExperiences') },
    { key: 'volunteerHours', value: volunteerHours, label: t('stats.volunteerHours') },
    ...(skillsCount !== null
      ? [{ key: 'skills', value: skillsCount, label: t('stats.skills') }]
      : []),
  ];
  return (
    <dl data-testid="profile-stats" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cells.map((cell) => (
        <div key={cell.key} className="rounded-md border border-border bg-surface p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{cell.label}</dt>
          <dd className="text-xl font-semibold text-ink">{cell.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CopyProfileLink() {
  const t = useTranslations('publicTalent');
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-testid="profile-copy"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            notify.success('success.linkCopied');
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2500);
          } catch {
            notify.error('error.copyFailed');
            setCopied(false);
          }
        }}
      >
        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        {copied ? t('copy.copied') : t('copy.label')}
      </Button>
      {copied ? (
        <span data-testid="profile-copied" role="status" className="text-xs text-ink-muted">
          {t('copy.copied')}
        </span>
      ) : null}
    </div>
  );
}

const DAY_LABELS: Record<DayKey, string> = {
  monday: 'monday',
  tuesday: 'tuesday',
  wednesday: 'wednesday',
  thursday: 'thursday',
  friday: 'friday',
  saturday: 'saturday',
  sunday: 'sunday',
};

function AvailabilityBlock({ schedule, note }: { schedule: WeeklySchedule; note: string | null }) {
  const t = useTranslations('publicTalent');
  const populated = DAY_KEYS.filter((day) => (schedule[day] ?? []).length > 0);
  if (populated.length === 0) {
    return <Empty title={t('availability.emptyTitle')} description={t('availability.emptyBody')} />;
  }
  return (
    <div data-testid="profile-availability" className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {populated.map((day) => (
          <li key={day} className="flex flex-wrap items-baseline gap-3 text-sm">
            <span className="min-w-28 font-medium text-ink">{t(`availability.${DAY_LABELS[day]}`)}</span>
            <span className="text-ink-muted">
              {(schedule[day] ?? []).map((slot) => `${slot.from}–${slot.to}`).join(', ')}
            </span>
          </li>
        ))}
      </ul>
      {note ? <p className="text-sm text-ink-muted">{note}</p> : null}
    </div>
  );
}

function ExperienceCard({
  experience,
  locale,
  skillNames,
}: {
  experience: PublicExperience;
  locale: string;
  /** Profile skill catalog (id -> locale name) to resolve raw skill ids. */
  skillNames: Map<string, string>;
}) {
  const t = useTranslations('publicTalent');
  const parts = verifiedLineParts(experience, locale);
  const date = formatDate(parts.verifiedAt, locale);
  const hours = hoursFromMinutes(experience.duration);
  const ref = registryCode(experience.registryId, 'EXP');
  // Backend `skills` is an ObjectId snapshot: resolve to catalog names and
  // drop unresolvable raw ids so a database id never renders as text.
  const skillLabels = humanExperienceSkillLabels(experience.skills, skillNames);
  return (
    <li data-testid="experience-card" className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink">{experience.title}</h4>
        {ref ? <span className="text-xs text-ink-muted">{ref}</span> : null}
      </div>
      {experience.description ? (
        <p className="text-sm text-ink-muted">{experience.description}</p>
      ) : null}
      {hours || skillLabels.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          {hours ? <span>{t('experiences.hours', { hours })}</span> : null}
          {skillLabels.map((skill) => (
            <Pill key={skill} tone="neutral">
              {skill}
            </Pill>
          ))}
        </div>
      ) : null}
      {parts.organization ? (
        <p data-testid="experience-verified" className="text-xs font-medium text-status-success">
          <span aria-hidden="true">✓ </span>
          {date
            ? t('experiences.verifiedByOn', { organization: parts.organization, date })
            : t('experiences.verifiedBy', { organization: parts.organization })}
        </p>
      ) : null}
      {(experience.evidence ?? []).length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {(experience.evidence ?? []).map((media) => (
            <PublicEvidenceMedia key={media.mediaId} media={media} />
          ))}
        </div>
      ) : null}
    </li>
  );
}

function PortfolioItem({ item }: { item: PublicPortfolioItem }) {
  const media = item.media ?? [];
  const images = media.filter(isImageMedia);
  const links = media.filter((m) => isLinkMedia(m));
  // A link row is the only shape a remote image can take in the media model,
  // so the first link doubles as the hero preview (image-first, anchor
  // fallback inside). Remaining links keep their plain anchors below.
  const heroLink = images.length === 0 ? (links[0] ?? null) : null;
  const restLinks = images.length === 0 ? links.slice(1) : links;
  return (
    <li data-testid="portfolio-item" className="flex flex-col gap-2 rounded-md border border-border p-3">
      {images[0] ? (
        <div className="h-40 w-full overflow-hidden rounded-md bg-surface-muted">
          <PublicMediaImage media={images[0]} />
        </div>
      ) : heroLink ? (
        <PublicLinkPreview media={heroLink} />
      ) : (
        <PortfolioPlaceholder />
      )}
      {item.title ? <h4 className="text-sm font-semibold text-ink">{item.title}</h4> : null}
      {item.typeLabel ? <span className="text-xs text-ink-muted">{item.typeLabel}</span> : null}
      {item.description ? <p className="text-sm text-ink-muted">{item.description}</p> : null}
      {(item.tags ?? []).length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {(item.tags ?? []).map((tag) => (
            <Pill key={tag} tone="neutral">
              {tag}
            </Pill>
          ))}
        </div>
      ) : null}
      {restLinks.map((link) => (
        <PublicMediaLink key={link.mediaId ?? link.url} media={link} />
      ))}
    </li>
  );
}

export function PublicTalentProfilePage({
  locale,
  username,
  // Optional volunteer-context overrides. Defaults preserve the public
  // route exactly: breadcrumb/404 back link → `/talents`, post-login
  // return → the public profile URL. The Volunteer talent route passes its
  // in-area equivalents so an authenticated volunteer never leaves the
  // Volunteer experience through this component.
  backHref = '/talents',
  loginNext,
  // Shell-agnostic save gate: the favorites backend only backs the volunteer
  // role (POST/DELETE /favorites/talents/:username carry @Roles('volunteer'),
  // so an organization-role session gets 403). The org workspace passes
  // `allowSave={false}` to omit the button instead of calling a forbidden
  // endpoint — same content, only the action differs.
  allowSave = true,
}: {
  locale: string;
  username: string;
  backHref?: string;
  loginNext?: string;
  allowSave?: boolean;
}) {
  const t = useTranslations('publicTalent');
  const c = useTranslations('common');
  const session = useSessionQuery();
  const profileQuery = usePublicTalentProfileQuery(username);
  const wilayasQuery = usePublicTalentWilayasQuery();
  // Owner check: only a signed-in volunteer whose own username matches this
  // route owns the profile. A pending/failed own-profile read means
  // not-owner (Save stays visible for signed-in non-owners; Edit appears
  // only on a confirmed username match). Guests never own a profile.
  const meQuery = useVolunteerMeQuery();
  const ownUsername = session.data?.role === 'volunteer' ? (meQuery.data?.username ?? null) : null;
  const isOwner = ownUsername !== null && ownUsername === username;
  const isAuthenticated = session.data != null;
  const showSave = allowSave && isAuthenticated && !isOwner;
  const showEdit = isOwner;
  const [expPageIdx, setExpPageIdx] = useState(0);
  const [expCursors, setExpCursors] = useState<(string | undefined)[]>([undefined]);
  const [reviewPageIdx, setReviewPageIdx] = useState(0);
  const [reviewCursors, setReviewCursors] = useState<(string | undefined)[]>([undefined]);

  const profile = profileQuery.data ?? null;
  const sections = useMemo(
    () => (profile ? resolvePublicProfileSections(profile) : null),
    [profile],
  );
  // Gate comes from the embedded payload, never from a client-side flag default.
  const experiencesGate = experiencesGateOpen(profile);
  const experiencesQuery = usePublicTalentExperiencesQuery(
    username,
    expCursors[expPageIdx],
    experiencesGate,
  );
  const reviewsQuery = usePublicTalentReviewsQuery(
    username,
    reviewCursors[reviewPageIdx],
    profileQuery.isSuccess,
  );

  const wilayaName = useMemo(() => {
    const code = sections?.location.data?.wilayaId;
    if (!code) return null;
    const match = (wilayasQuery.data ?? []).find((w) => (w.code ?? w.id ?? w._id) === code);
    if (!match) return code;
    if (locale === 'ar') return match.nameAr ?? match.nameFr ?? match.name ?? code;
    return match.nameFr ?? match.nameAr ?? match.name ?? code;
  }, [sections, wilayasQuery.data, locale]);

  const experiences = useMemo(() => {
    if (!sections) return [];
    return mergeUniqueById(sections.experiences.data, experiencesQuery.data?.items ?? []);
  }, [sections, experiencesQuery.data]);

  // Catalog to resolve raw experience skill ids into display names.
  const skillNames = useMemo(
    () =>
      skillNameMapOf(
        sections?.skills.open ? sections.skills.data : null,
        locale,
      ),
    [sections, locale],
  );

  if (profileQuery.isPending) return <Loader label={t('shared.loading')} />;

  if (profileQuery.isError) {
    const err = mapToApiError(profileQuery.error);
    if (err.statusCode === 404) {
      return (
        <Container testId="public-profile" className="flex flex-col gap-6 py-4">
          <Empty
            title={t('profile.notFoundTitle')}
            description={t('profile.notFoundBody')}
            action={
              <Link href={backHref} className="text-sm font-medium text-gold-strong">
                {t('profile.backToTalents')}
              </Link>
            }
          />
        </Container>
      );
    }
    return (
      <Container testId="public-profile" className="flex flex-col gap-6 py-4">
        <p data-testid="profile-error" role="alert" className="text-sm text-status-error">
          {t('shared.loadError')}
        </p>
        <Button variant="secondary" onClick={() => profileQuery.refetch()}>
          {t('shared.retry')}
        </Button>
      </Container>
    );
  }

  if (!profile || !sections) return <Loader label={t('shared.loading')} />;

  // Locale-less: the locale-aware router adds the prefix, and the post-login
  // `router.push(next)` would double-prefix a pre-prefixed value.
  const next = loginNext ?? `/volunteers/${username}`;
  const displayName = publicDisplayName(sections.bio.data.firstName, profile.username);
  const code = registryCode(profile.registryId, 'VOL');
  const areas = sortAreasByPercentDesc(sections.areas.data);
  // Neutral verified line: real stats count first, embedded experiences length
  // as fallback, omitted when both gates are closed. Never a tier, registry,
  // or counterparty claim — just the count and the word "verified".
  const verifiedCount =
    sections.stats.open && sections.stats.data
      ? sections.stats.data.verifiedExperiences
      : sections.experiences.open
        ? experiences.length
        : null;
  const skillsCount = sections.skills.open ? sections.skills.data.length : null;
  const overviewLocation = wilayaName ?? sections.bio.data.geographicBase;
  // "Fully closed" = every opt-out gate shut (karim-style). Anything public
  // (stats, skills, bio, ...) makes this a public profile, which always gets
  // an avatar node: photo if uploaded, user.jpg if not.
  const avatarHidden =
    !sections.avatar.open &&
    !sections.bio.open &&
    !sections.location.open &&
    !sections.stats.open &&
    !sections.areas.open &&
    !sections.experiences.open &&
    !sections.availability.open &&
    !sections.skills.open &&
    !sections.portfolio.open;
  const expPage = experiencesQuery.data?.page ?? expPageIdx + 1;
  const expPages = experiencesQuery.data?.pages ?? expPageIdx + 1;
  const reviewPage = reviewsQuery.data?.page ?? reviewPageIdx + 1;
  const reviewPages = reviewsQuery.data?.pages ?? reviewPageIdx + 1;
  const reviews = reviewsQuery.data?.items ?? [];

  return (
    <Container testId="public-profile" className="flex flex-col gap-6 py-4">
      <nav aria-label={c('a11y.breadcrumb')} className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t('profile.backToTalents')}
        </Link>
        <span aria-hidden="true" className="text-ink-muted">
          /
        </span>
        <span className="text-ink-muted">{displayName}</span>
      </nav>

      <header data-testid="profile-header" id="overview" className="flex flex-col gap-4 scroll-mt-20">
        <div data-testid="profile-cover" className="h-24 w-full overflow-hidden rounded-xl border border-border bg-surface-muted sm:h-28">
          {profile.banner ? (
            <PublicMediaImage
              media={{ mediaId: profile.banner }}
              fallbackSrc="/banner.png"
            />
          ) : (
            /* Neutral local cover when the volunteer shared no banner. */
            /* eslint-disable-next-line @next/next/no-img-element -- neutral local fallback cover */
            <img src="/banner.png" alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex flex-wrap items-start gap-4">
          <Avatar
            mediaId={sections.avatar.open ? (sections.avatar.data ?? null) : null}
            hidden={avatarHidden}
          />
          <div className="flex flex-1 flex-col gap-1">
            <h1 className="text-2xl font-bold text-ink">{displayName}</h1>
            {sections.bio.open && sections.bio.data.headline ? (
              <p className="text-sm text-ink-muted">{sections.bio.data.headline}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
              {code ? (
                <span data-testid="profile-registry-code">
                  {t('profile.registryCode')}: {code}
                </span>
              ) : null}
              {overviewLocation ? (
                <span data-testid="profile-location" className="inline-flex items-center gap-1">
                  <MapPin size={14} aria-hidden="true" />
                  {t('profile.locationTitle')}: {overviewLocation}
                </span>
              ) : null}
            </div>
            {verifiedCount !== null ? (
              <p data-testid="profile-verified-line" className="inline-flex items-center gap-1 text-xs font-medium text-status-success">
                <BadgeCheck size={14} aria-hidden="true" />
                {t('profile.verifiedCount', { count: verifiedCount })}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showSave ? (
              <SaveProfileButton
                username={profile.username}
                favorited={Boolean(profile.isFavorited)}
                count={profile.favoriteCount ?? 0}
                next={next}
              />
            ) : null}
            {showEdit ? (
              <Link
                href="/volunteer/profile"
                data-testid="profile-edit"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
              >
                <Pencil size={16} aria-hidden="true" />
                {t('profile.editLabel')}
              </Link>
            ) : null}
            {(sections.experiences.open && sections.experiences.data.length > 0) ||
            (sections.skills.open && sections.skills.data.length > 0) ? (
              <Link
                href={`/volunteers/${profile.username}/cv?print=1`}
                data-testid="profile-download-cv"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
              >
                <Download size={16} aria-hidden="true" />
                {t('cv.download')}
              </Link>
            ) : null}
            <CopyProfileLink />
          </div>
        </div>
      </header>

      <nav
        aria-label={t('tabs.label')}
        data-testid="profile-tabs"
        className="flex flex-wrap items-center gap-2 border-b border-border pb-2 text-sm"
      >
        <a href="#overview" className="rounded-md px-3 py-1.5 font-medium text-ink transition-colors hover:bg-surface-muted">
          {t('tabs.overview')}
        </a>
        {sections.experiences.open ? (
          <a href="#experiences" className="rounded-md px-3 py-1.5 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink">
            {t('tabs.experience')}
          </a>
        ) : null}
        {sections.portfolio.open ? (
          <a href="#portfolio" className="rounded-md px-3 py-1.5 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink">
            {t('tabs.portfolio')}
          </a>
        ) : null}
        <a href="#reviews" className="rounded-md px-3 py-1.5 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink">
          {t('tabs.recommendations')}
        </a>
      </nav>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-8">
      {sections.stats.open && sections.stats.data ? (
        <Card title={t('stats.title')}>
          <StatsStrip
            completedTasks={sections.stats.data.completedTasks}
            verifiedExperiences={sections.stats.data.verifiedExperiences}
            volunteerHours={hoursFromMinutes(sections.stats.data.volunteerHours) ?? '0'}
            skillsCount={skillsCount}
          />
        </Card>
      ) : null}

      {sections.bio.open && sections.bio.data.bio ? (
        <Card title={t('about.title')}>
          <p data-testid="profile-bio" className="text-sm leading-relaxed text-ink">
            {sections.bio.data.bio}
          </p>
        </Card>
      ) : null}

      {sections.areas.open && areas.length > 0 ? (
        <Card title={t('areas.title')}>
          <ul data-testid="profile-areas" className="flex flex-col gap-2">
            {areas.map((area) => (
              <li key={area.categoryId} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink">
                  {locale === 'ar' ? area.nameAr : area.nameFr}
                </span>
                <span className="text-ink-muted">{t('areas.percent', { percent: area.percent })}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {sections.skills.open ? (
        <Card title={t('skills.title')}>
          {(sections.skills.data ?? []).length === 0 ? (
            <p className="text-sm text-ink-muted">{t('skills.emptyBody')}</p>
          ) : (
            <ul data-testid="profile-skills" className="flex flex-wrap gap-2">
              {sections.skills.data.map((skill) => (
                <li key={skill.skillId}>
                  <Pill tone="neutral">
                    {locale === 'ar' ? skill.nameAr : skill.nameFr}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {sections.experiences.open ? (
        <div id="experiences" className="scroll-mt-20">
        <Card title={t('experiences.title')}>
          {experiencesQuery.isPending ? (
            <Loader label={t('shared.loading')} />
          ) : experiences.length === 0 ? (
            <Empty
              title={t('experiences.emptyTitle')}
              description={t('experiences.emptyBody')}
            />
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {experiences.map((experience) => (
                  <ExperienceCard key={experience.id} experience={experience} locale={locale} skillNames={skillNames} />
                ))}
              </ul>
              {expPages > 1 ? (
                <div className="mt-4">
                  <Pagination
                    page={expPage}
                    pages={expPages}
                    statusText={t('experiences.pageStatus', { page: expPage, pages: expPages })}
                    previousLabel={t('experiences.previous')}
                    nextLabel={t('experiences.next')}
                    onPage={(target) => {
                      if (target < expPage && expPageIdx > 0) {
                        setExpCursors((c) => c.slice(0, -1));
                        setExpPageIdx((i) => i - 1);
                      } else if (target > expPage && experiencesQuery.data?.nextCursor) {
                        setExpCursors((c) => [...c, experiencesQuery.data?.nextCursor ?? undefined]);
                        setExpPageIdx((i) => i + 1);
                      }
                    }}
                  />
                </div>
              ) : null}
            </>
          )}
        </Card>
        </div>
      ) : null}

      {sections.portfolio.open ? (
        <div id="portfolio" className="scroll-mt-20">
        <Card title={t('portfolio.title')}>
          {sections.portfolio.data.length === 0 ? (
            <Empty
              title={t('portfolio.emptyTitle')}
              description={t('portfolio.emptyBody')}
            />
          ) : (
            <ul data-testid="profile-portfolio" className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {sections.portfolio.data.map((item) => (
                <PortfolioItem key={item.id} item={item} />
              ))}
            </ul>
          )}
        </Card>
        </div>
      ) : null}

      <div id="reviews" className="scroll-mt-20">
      <Card title={t('reviews.title')}>
        {reviews.length === 0 ? (
          <Empty title={t('reviews.emptyTitle')} description={t('reviews.emptyBody')} />
        ) : (
          <>
            <ul data-testid="profile-reviews" className="flex flex-col gap-3">
              {reviews.map((review) => (
                <li
                  key={review.id}
                  data-testid="review-card"
                  className="flex flex-col gap-1 rounded-md border border-border p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-ink-muted">
                    <span className="font-medium text-ink">
                      {review.organization
                        ? locale === 'ar'
                          ? review.organization.nameAr
                          : review.organization.nameFr
                        : ''}
                    </span>
                    <span>{formatDate(review.createdAt, locale)}</span>
                  </div>
                  <p className="text-xs text-ink-muted">
                    {t('reviews.rating', { rating: review.rating })}
                  </p>
                  {review.comment ? (
                    <p className="text-sm text-ink">{review.comment}</p>
                  ) : null}
                </li>
              ))}
            </ul>
            {reviewPages > 1 ? (
              <div className="mt-4">
                <Pagination
                  page={reviewPage}
                  pages={reviewPages}
                  statusText={t('reviews.pageStatus', { page: reviewPage, pages: reviewPages })}
                  previousLabel={t('reviews.previous')}
                  nextLabel={t('reviews.next')}
                  onPage={(target) => {
                    if (target < reviewPage && reviewPageIdx > 0) {
                      setReviewCursors((c) => c.slice(0, -1));
                      setReviewPageIdx((i) => i - 1);
                    } else if (target > reviewPage && reviewsQuery.data?.nextCursor) {
                      setReviewCursors((c) => [...c, reviewsQuery.data?.nextCursor ?? undefined]);
                      setReviewPageIdx((i) => i + 1);
                    }
                  }}
                />
              </div>
            ) : null}
          </>
        )}
      </Card>
      </div>
      </div>
      <aside data-testid="profile-sidebar" aria-label={t('overview.title')} className="flex min-w-0 flex-col gap-6 lg:col-span-4">
        {(overviewLocation || skillsCount !== null || verifiedCount !== null || (sections.stats.open && sections.stats.data)) ? (
          <Card title={t('overview.title')}>
            <dl data-testid="profile-overview" className="flex flex-col gap-2 text-sm">
              {overviewLocation ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-ink-muted">{t('profile.locationTitle')}</dt>
                  <dd className="text-end font-medium text-ink">{overviewLocation}</dd>
                </div>
              ) : null}
              {skillsCount !== null ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-ink-muted">{t('stats.skills')}</dt>
                  <dd className="font-medium text-ink">{skillsCount}</dd>
                </div>
              ) : null}
              {verifiedCount !== null ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-ink-muted">{t('stats.verifiedExperiences')}</dt>
                  <dd className="font-medium text-ink">{verifiedCount}</dd>
                </div>
              ) : null}
              {sections.stats.open && sections.stats.data ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-ink-muted">{t('stats.volunteerHours')}</dt>
                  <dd className="font-medium text-ink">
                    {hoursFromMinutes(sections.stats.data.volunteerHours) ?? '0'}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>
        ) : null}

        <Card title={t('verify.title')}>
          <div className="flex flex-col gap-2">
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
              <ShieldCheck size={16} aria-hidden="true" className="text-status-success" />
              {t('verify.title')}
            </p>
            <p className="text-sm leading-relaxed text-ink-muted">{t('verify.body')}</p>
          </div>
        </Card>

        {sections.availability.open ? (
          <Card title={t('availability.title')}>
            <AvailabilityBlock
              schedule={sections.availability.data ?? emptySchedule()}
              note={sections.bio.data.availabilityNote}
            />
            {(sections.bio.data.preferredDomains ?? []).length > 0 ? (
              <div className="mt-3 flex flex-col gap-1">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  {t('overview.preferredDomains')}
                </p>
                <div className="flex flex-wrap gap-1">
                  {(sections.bio.data.preferredDomains ?? []).map((domain) => (
                    <Pill key={domain} tone="neutral">
                      {domain}
                    </Pill>
                  ))}
                </div>
              </div>
            ) : null}
            {sections.bio.data.geographicBase ? (
              <p className="mt-3 text-sm text-ink-muted">
                <span className="font-medium text-ink">{t('overview.geographicBase')}: </span>
                {sections.bio.data.geographicBase}
              </p>
            ) : null}
          </Card>
        ) : null}

        <p className="text-xs leading-relaxed text-ink-muted">{t('privacy.note')}</p>
      </aside>
      </div>
    </Container>
  );
}
