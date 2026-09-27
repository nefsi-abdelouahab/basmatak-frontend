'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { Pagination } from '@/components/ui/Pagination';
import { Pill } from '@/components/ui/Pill';
import { mapToApiError } from '@/lib/api/errors';
import { useSessionQuery, getLoginHref } from '@/hooks/useSession';
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
  isImageMedia,
  isLinkMedia,
  mergeUniqueById,
  publicDisplayName,
  registryCode,
  resolvePublicProfileSections,
  sortAreasByPercentDesc,
  verifiedLineParts,
  type DayKey,
  type PublicExperience,
  type PublicPortfolioItem,
  type WeeklySchedule,
} from '@/lib/api/publicTalent';
import { PublicEvidenceMedia, PublicMediaImage, PublicMediaLink } from './PublicMediaParts';

// F17 merged public volunteer profile (plan M1: Talent layout as the base plus
// the Volunteer folder's media grid and stats strip). Guests may view every
// block; the save control redirects guests to Login with `next`.
//
// GATING: every block renders from `resolvePublicProfileSections`, so a closed
// show-flag emits no heading, count, placeholder, empty state or reserved
// space. The experiences paginator is enabled from `experiencesGateOpen` only.
// Curation deliberately absent: the payload's ungated `createdAt` is never
// rendered (a member-since line is a registry-membership claim), there is no
// apply/contact/invite control, no verification tier, and no public activity
// stream.

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '';
  return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

function Avatar({ mediaId }: { mediaId: string }) {
  return (
    <div
      data-testid="profile-avatar"
      className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-surface-muted"
    >
      <PublicMediaImage media={{ mediaId }} />
    </div>
  );
}

function SaveProfileButton({
  username,
  favorited,
  count,
  locale,
  next,
}: {
  username: string;
  favorited: boolean;
  count: number;
  locale: string;
  next: string;
}) {
  const t = useTranslations('publicTalent');
  const session = useSessionQuery();
  const queryClient = useQueryClient();
  const toggle = useToggleTalentFavoriteMutation();
  // `getLoginHref` already carries the locale. Navigating with a full document
  // load keeps the path exactly `/{locale}/login`; a locale-aware router would
  // prefix the locale a second time.
  const goLogin = () => window.location.assign(getLoginHref(locale, next));
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
}: {
  completedTasks: number;
  verifiedExperiences: number;
  volunteerHours: number;
}) {
  const t = useTranslations('publicTalent');
  const cells = [
    { key: 'completedTasks', value: completedTasks, label: t('stats.completedTasks') },
    { key: 'verifiedExperiences', value: verifiedExperiences, label: t('stats.verifiedExperiences') },
    { key: 'volunteerHours', value: volunteerHours, label: t('stats.volunteerHours') },
  ];
  return (
    <dl data-testid="profile-stats" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cells.map((cell) => (
        <div key={cell.key} className="rounded-md border border-border bg-surface p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{cell.label}</dt>
          <dd className="text-xl font-semibold text-ink">{cell.value}</dd>
        </div>
      ))}
    </dl>
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
}: {
  experience: PublicExperience;
  locale: string;
}) {
  const t = useTranslations('publicTalent');
  const parts = verifiedLineParts(experience, locale);
  const date = formatDate(parts.verifiedAt, locale);
  const hours = hoursFromMinutes(experience.duration);
  const ref = registryCode(experience.registryId, 'EXP');
  return (
    <li data-testid="experience-card" className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink">{experience.title}</h4>
        {ref ? <span className="text-xs text-ink-muted">{ref}</span> : null}
      </div>
      {experience.description ? (
        <p className="text-sm text-ink-muted">{experience.description}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        {hours ? <span>{t('experiences.hours', { hours })}</span> : null}
        {(experience.skills ?? []).map((skill) => (
          <Pill key={skill} tone="neutral">
            {skill}
          </Pill>
        ))}
      </div>
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
  return (
    <li data-testid="portfolio-item" className="flex flex-col gap-2 rounded-md border border-border p-3">
      {images[0] ? (
        <div className="h-40 w-full overflow-hidden rounded-md bg-surface-muted">
          <PublicMediaImage media={images[0]} />
        </div>
      ) : null}
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
      {links.map((link) => (
        <PublicMediaLink key={link.mediaId ?? link.url} media={link} />
      ))}
    </li>
  );
}

export function PublicTalentProfilePage({
  locale,
  username,
}: {
  locale: string;
  username: string;
}) {
  const t = useTranslations('publicTalent');
  const profileQuery = usePublicTalentProfileQuery(username);
  const wilayasQuery = usePublicTalentWilayasQuery();
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

  if (profileQuery.isPending) return <Loader label={t('shared.loading')} />;

  if (profileQuery.isError) {
    const err = mapToApiError(profileQuery.error);
    if (err.statusCode === 404) {
      return (
        <div
          data-testid="public-profile"
          className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4"
        >
          <Empty
            title={t('profile.notFoundTitle')}
            description={t('profile.notFoundBody')}
            action={
              <Link href="/talents" className="text-sm font-medium text-primary">
                {t('profile.backToTalents')}
              </Link>
            }
          />
        </div>
      );
    }
    return (
      <div
        data-testid="public-profile"
        className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4"
      >
        <p data-testid="profile-error" role="alert" className="text-sm text-status-error">
          {t('shared.loadError')}
        </p>
        <Button variant="secondary" onClick={() => profileQuery.refetch()}>
          {t('shared.retry')}
        </Button>
      </div>
    );
  }

  if (!profile || !sections) return <Loader label={t('shared.loading')} />;

  const next = `/${locale}/volunteers/${username}`;
  const displayName = publicDisplayName(sections.bio.data.firstName, profile.username);
  const code = registryCode(profile.registryId, 'VOL');
  const areas = sortAreasByPercentDesc(sections.areas.data);
  const expPage = experiencesQuery.data?.page ?? expPageIdx + 1;
  const expPages = experiencesQuery.data?.pages ?? expPageIdx + 1;
  const reviewPage = reviewsQuery.data?.page ?? reviewPageIdx + 1;
  const reviewPages = reviewsQuery.data?.pages ?? reviewPageIdx + 1;
  const reviews = reviewsQuery.data?.items ?? [];

  return (
    <div data-testid="public-profile" className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
      <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/talents" className="font-medium text-ink-muted">
          {t('profile.backToTalents')}
        </Link>
        <span aria-hidden="true" className="text-ink-muted">
          /
        </span>
        <span className="text-ink-muted">{displayName}</span>
      </nav>

      <header data-testid="profile-header" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start gap-4">
          {sections.avatar.open && sections.avatar.data ? (
            <Avatar mediaId={sections.avatar.data} />
          ) : null}
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
              {sections.location.open && wilayaName ? (
                <span data-testid="profile-location">
                  {t('profile.locationTitle')}: {wilayaName}
                </span>
              ) : null}
            </div>
          </div>
          <SaveProfileButton
            username={profile.username}
            favorited={Boolean(profile.isFavorited)}
            count={profile.favoriteCount ?? 0}
            locale={locale}
            next={next}
          />
        </div>
        {sections.bio.open && sections.bio.data.bio ? (
          <p data-testid="profile-bio" className="text-sm text-ink">
            {sections.bio.data.bio}
          </p>
        ) : null}
      </header>

      {sections.stats.open && sections.stats.data ? (
        <Card title={t('stats.title')}>
          <StatsStrip
            completedTasks={sections.stats.data.completedTasks}
            verifiedExperiences={sections.stats.data.verifiedExperiences}
            volunteerHours={sections.stats.data.volunteerHours}
          />
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

      {sections.availability.open ? (
        <Card title={t('availability.title')}>
            <AvailabilityBlock
              schedule={sections.availability.data ?? emptySchedule()}
              note={sections.bio.data.availabilityNote}
            />
        </Card>
      ) : null}

      {sections.experiences.open ? (
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
                  <ExperienceCard key={experience.id} experience={experience} locale={locale} />
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
      ) : null}

      {sections.portfolio.open ? (
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
      ) : null}

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
  );
}
