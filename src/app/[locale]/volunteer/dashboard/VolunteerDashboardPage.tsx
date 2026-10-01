'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, CircleCheck, MapPin } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import {
  orgDisplayName,
  useFeedMunicipalitiesQuery,
  useFeedSkillsQuery,
  useFeedWilayasQuery,
  useOpportunitiesQuery,
  useRecommendedQuery,
  useVolunteerHomeDashboardQuery,
} from '@/hooks/useFeed';
import { useFavoritesLookupQuery } from '@/hooks/useFavorites';
import { useVolunteerMeQuery, useVolunteerMediaQuery, useMySkillsQuery } from '@/hooks/useVolunteerAccount';
import { volunteerMediaUrlOf } from '@/lib/api/volunteers';
import type { LatestVerifiedExperience, OpportunityCard as OpportunityCardData } from '@/lib/api/feed';
import { ProgressBar, RequireVolunteer, SectionError } from '../components';
import { OpportunityCard } from '../opportunities/OpportunityCard';

type FeedTab = 'recommended' | 'recent' | 'local';

function facetId(option: { id?: string; _id?: string }): string {
  return option.id ?? option._id ?? '';
}

function facetLabel(
  option: { nameFr?: string; nameAr?: string; name?: string },
  locale: string,
): string {
  if (locale === 'ar') return option.nameAr ?? option.nameFr ?? option.name ?? '';
  return option.nameFr ?? option.nameAr ?? option.name ?? '';
}

function hoursText(durationMinutes: number | null | undefined): string | null {
  if (typeof durationMinutes !== 'number' || !Number.isFinite(durationMinutes)) return null;
  const hours = durationMinutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function greetingKey(hour: number): 'greetingMorning' | 'greetingAfternoon' | 'greetingEvening' {
  if (hour < 12) return 'greetingMorning';
  if (hour < 18) return 'greetingAfternoon';
  return 'greetingEvening';
}

// Own-photo avatar: uploaded media resolves via GET /media/:mediaId with
// public/user.jpg as the real fallback (never hidden, never initials-only).
// An explicit showAvatar opt-out renders nothing at all.
function HeaderAvatar({ name }: { name: string }) {
  const meQuery = useVolunteerMeQuery();
  const avatarId = meQuery.data?.avatar ?? null;
  const isUrl = typeof avatarId === 'string' && /^https?:\/\//i.test(avatarId);
  const mediaQuery = useVolunteerMediaQuery(isUrl ? null : avatarId);
  if (meQuery.data?.publicProfile?.showAvatar === false) return null;
  const src = isUrl ? (avatarId as string) : (volunteerMediaUrlOf(mediaQuery.data) ?? '/user.jpg');
  return (
    // eslint-disable-next-line @next/next/no-img-element -- session-resolved media URL with local fallback
    <img
      data-testid="dashboard-avatar"
      src={src}
      alt={name}
      loading="lazy"
      onError={(event) => {
        if (!event.currentTarget.src.endsWith('/user.jpg')) event.currentTarget.src = '/user.jpg';
      }}
      className="h-12 w-12 shrink-0 rounded-full border border-border-muted bg-surface-muted object-cover"
    />
  );
}

function HeaderCard({ locale }: { locale: string }) {
  const t = useTranslations('volunteerHome');
  const meQuery = useVolunteerMeQuery();
  const skillsQuery = useMySkillsQuery();
  const skillsLookup = useFeedSkillsQuery();
  const wilayasQuery = useFeedWilayasQuery();
  const wilayaId = meQuery.data?.location?.wilayaId;
  const municipalitiesQuery = useFeedMunicipalitiesQuery(wilayaId);

  const hour = new Date().getHours();
  const firstName = meQuery.data?.firstName ?? null;
  const lastName = meQuery.data?.lastName ?? null;
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const displayName = fullName !== '' ? fullName : (meQuery.data?.username ?? '');
  const greetingName = firstName ?? meQuery.data?.username ?? '';

  const skillNames = useMemo(() => {
    const byId = new Map<string, string>();
    for (const option of skillsLookup.data ?? []) {
      const id = facetId(option);
      const label = facetLabel(option, locale);
      if (id !== '' && label !== '') byId.set(id, label);
    }
    return (skillsQuery.data ?? [])
      .map((skill) => (skill.skillId ? byId.get(skill.skillId) : undefined))
      .filter((label): label is string => typeof label === 'string');
  }, [skillsLookup.data, skillsQuery.data, locale]);

  const locationText = useMemo(() => {
    if (!meQuery.data) return null;
    const municipalityName = (municipalitiesQuery.data ?? []).find(
      (m) => facetId(m) === (meQuery.data?.location?.municipalityId ?? ''),
    );
    const wilayaName = (wilayasQuery.data ?? []).find((w) => facetId(w) === (wilayaId ?? ''));
    const parts = [
      municipalityName ? facetLabel(municipalityName, locale) : null,
      wilayaName ? facetLabel(wilayaName, locale) : null,
      meQuery.data.geographicBase ?? null,
    ].filter((part): part is string => typeof part === 'string' && part !== '');
    const unique = Array.from(new Set(parts));
    if (unique.length === 0) return null;
    return `${unique.join(', ')}, ${t('dashboard.locationCountry')}`;
  }, [meQuery.data, municipalitiesQuery.data, wilayasQuery.data, wilayaId, locale, t]);

  if (meQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (meQuery.isError || !meQuery.data) {
    return <SectionError testId="dashboard-profile-error" message={t('shared.loadError')} />;
  }

  return (
    <article data-testid="dashboard-header" className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <HeaderAvatar name={displayName} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-title-md font-semibold text-ink">{displayName}</h2>
              <Pill tone="neutral">{t('dashboard.headerRole')}</Pill>
            </div>
            {meQuery.data.headline ? (
              <p className="mt-0.5 truncate text-body-sm text-ink-muted">{meQuery.data.headline}</p>
            ) : null}
            {locationText ? (
              <p className="mt-1 flex items-center gap-1 text-label-xs text-ink-muted">
                <MapPin size={14} aria-hidden="true" className="shrink-0" />
                <span className="truncate">{locationText}</span>
              </p>
            ) : null}
            {skillNames.length > 0 ? (
              <ul aria-label={t('dashboard.statsSkills')} className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {skillNames.map((label) => (
                  <li
                    key={label}
                    className="rounded border border-border-muted bg-surface-muted px-2 py-0.5 text-label-xs text-ink-muted"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        {meQuery.data.username ? (
          <Link
            href={`/volunteer/talents/${meQuery.data.username}`}
            data-testid="dashboard-view-profile"
            className="shrink-0 rounded-md border border-border-muted px-3 py-1.5 text-label-sm font-medium text-primary transition-colors hover:bg-surface-muted"
          >
            {t('dashboard.viewProfile')}
          </Link>
        ) : null}
      </div>
      <div className="my-4 h-px bg-border-muted" />
      <div>
        <p className="text-title-lg font-semibold text-ink">{t(`dashboard.${greetingKey(hour)}`, { name: greetingName })}</p>
        <p className="mt-0.5 text-body-md text-ink-muted">{t('dashboard.greetingSubtitle')}</p>
      </div>
    </article>
  );
}

function LatestExperience({
  experience,
  verifiedCount,
  locale,
}: {
  experience: LatestVerifiedExperience | null | undefined;
  verifiedCount: number;
  locale: string;
}) {
  const t = useTranslations('volunteerHome');
  const skillsLookup = useFeedSkillsQuery();
  const skillNames = useMemo(() => {
    const byId = new Map<string, string>();
    for (const option of skillsLookup.data ?? []) {
      const id = facetId(option);
      const label = facetLabel(option, locale);
      if (id !== '' && label !== '') byId.set(id, label);
    }
    return (experience?.skills ?? [])
      .map((id) => byId.get(id))
      .filter((label): label is string => typeof label === 'string');
  }, [skillsLookup.data, experience?.skills, locale]);

  return (
    <article className="space-y-2 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-title-sm font-semibold text-ink">{t('dashboard.latestTitle')}</h3>
        <Link
          href="/volunteer/experiences"
          data-testid="dashboard-latest-view-all"
          className="shrink-0 text-label-sm font-medium text-primary hover:underline"
        >
          {t('dashboard.latestViewAll', { count: verifiedCount })}
        </Link>
      </div>
      {!experience ? (
        <Empty
          title={t('dashboard.latestEmptyTitle')}
          description={t('dashboard.latestEmptyBody')}
          action={
            <Link href="/volunteer/opportunities">
              <Button type="button" variant="primary" size="sm">
                {t('dashboard.latestEmptyCta')}
              </Button>
            </Link>
          }
        />
      ) : (
        <div data-testid="dashboard-latest" className="space-y-2 rounded-md border border-border-muted bg-surface-muted/60 p-4">
          <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-start">
            <div className="min-w-0">
              {experience.title ? (
                <h4 className="text-title-sm font-semibold text-ink">{experience.title}</h4>
              ) : null}
              {(() => {
                const orgName =
                  (experience.organization
                    ? orgDisplayName(experience.organization, locale)
                    : '') || experience.organizationName || '';
                const date = experience.verifiedAt
                  ? new Date(experience.verifiedAt).toLocaleDateString(locale)
                  : null;
                const hours = hoursText(experience.duration ?? null);
                const meta = [
                  orgName !== '' ? orgName : null,
                  date,
                  hours ? t('dashboard.latestHours', { hours }) : null,
                ].filter((part): part is string => typeof part === 'string');
                if (meta.length === 0) return null;
                return <p className="mt-0.5 text-label-sm text-ink-muted">{meta.join(' · ')}</p>;
              })()}
              {experience.registryId ? (
                <p data-testid="dashboard-latest-ref" className="mt-0.5 text-label-sm text-ink-muted">
                  EXP-{experience.registryId}
                </p>
              ) : null}
            </div>
            <p className="inline-flex shrink-0 items-center gap-1 pt-0.5 text-body-sm font-medium text-status-success">
              <CircleCheck size={16} aria-hidden="true" />
              <span>{t('dashboard.latestVerifiedBadge')}</span>
            </p>
          </div>
          {skillNames.length > 0 ? (
            <ul className="flex flex-wrap items-center gap-1.5 pt-1">
              {skillNames.map((label) => (
                <li
                  key={label}
                  className="rounded bg-surface px-2 py-0.5 text-label-xs text-ink-muted"
                >
                  {label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </article>
  );
}

function FeedPanel({
  items,
  locale,
  next,
  lookup,
  isPending,
  isError,
  emptyHint,
  testId,
  saveTestIdPrefix,
}: {
  items: OpportunityCardData[];
  locale: string;
  next: string;
  lookup: Record<string, { favorited: boolean; favoriteCount?: number | null }> | undefined;
  isPending: boolean;
  isError: boolean;
  emptyHint?: string;
  testId: string;
  saveTestIdPrefix: string;
}) {
  const t = useTranslations('volunteerHome');
  if (isPending) return <Loader label={t('shared.loading')} />;
  if (isError) return <SectionError testId={`${testId}-error`} message={t('shared.loadError')} />;
  if (items.length === 0) {
    return <Empty title={t('opportunities.emptyTitle')} description={emptyHint ?? t('opportunities.emptyBody')} />;
  }
  return (
    <div data-testid={testId} className="flex min-w-0 flex-col gap-4">
      {items.map((item) => {
        const id = item.id ?? item._id ?? '';
        return (
          <OpportunityCard
            key={`${saveTestIdPrefix}-${id}`}
            item={item}
            locale={locale}
            favorited={lookup?.[id]?.favorited ?? item.isFavorited ?? false}
            favoriteCount={lookup?.[id]?.favoriteCount ?? null}
            next={next}
            saveTestIdPrefix={saveTestIdPrefix}
            detailsBasePath="/opportunities"
          />
        );
      })}
    </div>
  );
}

function OpportunitiesFeed({ locale, wilayaName }: { locale: string; wilayaName: string | null }) {
  const t = useTranslations('volunteerHome');
  const [tab, setTab] = useState<FeedTab>('recommended');
  const next = '/volunteer/dashboard';

  const recommendedQuery = useRecommendedQuery(true);
  const recentQuery = useOpportunitiesQuery({ sort: 'newest', limit: 3 });
  const hasWilaya = wilayaName !== null;
  const localQuery = useOpportunitiesQuery({ nearMe: 'me', limit: 3 }, hasWilaya);

  const lookupIds = useMemo(() => {
    const ids = new Set<string>();
    for (const page of [recommendedQuery.data, recentQuery.data, localQuery.data]) {
      for (const item of page?.items ?? []) {
        const id = item.id ?? item._id ?? '';
        if (id !== '') ids.add(id);
      }
    }
    return Array.from(ids).slice(0, 50);
  }, [recommendedQuery.data, recentQuery.data, localQuery.data]);
  const lookupQuery = useFavoritesLookupQuery('opportunity', lookupIds);

  const tabs: { key: FeedTab; label: string; testId: string }[] = [
    { key: 'recommended', label: t('dashboard.feedRecommended'), testId: 'feed-tab-recommended' },
    { key: 'recent', label: t('dashboard.feedRecent'), testId: 'feed-tab-recent' },
    {
      key: 'local',
      label: wilayaName ? t('dashboard.feedLocal', { place: wilayaName }) : t('dashboard.feedNearby'),
      testId: 'feed-tab-local',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-2 border-b border-border-muted pb-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <h3 className="text-title-md font-semibold text-ink">{t('dashboard.feedTitle')}</h3>
          <Link
            href="/opportunities"
            data-testid="feed-view-all"
            className="shrink-0 text-label-sm font-medium text-primary hover:underline"
          >
            {t('dashboard.feedViewAll')}
          </Link>
        </div>
        <div role="tablist" aria-label={t('dashboard.feedTitle')} className="flex items-center gap-1">
          {tabs.map(({ key, label, testId }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={testId}
                onClick={() => setTab(key)}
                className={`rounded-md px-3 py-1 text-label-sm font-medium transition-colors ${
                  active ? 'bg-primary-tint text-primary' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      {tab === 'recommended' ? (
        <FeedPanel
          items={recommendedQuery.data?.items ?? []}
          locale={locale}
          next={next}
          lookup={lookupQuery.data}
          isPending={recommendedQuery.isPending}
          isError={recommendedQuery.isError}
          testId="feed-panel-recommended"
          saveTestIdPrefix="save-opp-dash-rec"
        />
      ) : null}
      {tab === 'recent' ? (
        <FeedPanel
          items={recentQuery.data?.items ?? []}
          locale={locale}
          next={next}
          lookup={lookupQuery.data}
          isPending={recentQuery.isPending}
          isError={recentQuery.isError}
          testId="feed-panel-recent"
          saveTestIdPrefix="save-opp-dash-recent"
        />
      ) : null}
      {tab === 'local' ? (
        !hasWilaya ? (
          <Empty title={t('opportunities.emptyTitle')} description={t('opportunities.nearMeHint')} />
        ) : (
          <FeedPanel
            items={localQuery.data?.items ?? []}
            locale={locale}
            next={next}
            lookup={lookupQuery.data}
            isPending={localQuery.isPending}
            isError={localQuery.isError}
            testId="feed-panel-local"
            saveTestIdPrefix="save-opp-dash-local"
          />
        )
      ) : null}
    </div>
  );
}

function SuggestedRow({
  item,
  locale,
}: {
  item: OpportunityCardData;
  locale: string;
}) {
  const id = item.id ?? item._id ?? '';
  const detailId = item.slug ?? item.idOrSlug ?? id;
  const orgName = orgDisplayName(item.organization, locale);
  const hours = hoursText(item.durationMinutes ?? null);
  const meta = [item.mode ?? null, hours ? `${hours}h` : null].filter(
    (part): part is string => typeof part === 'string' && part !== '',
  );
  return (
    <Link href={`/opportunities/${detailId}`} data-testid="rail-suggested-item" className="group block">
      <p className="text-title-sm font-medium text-ink transition-colors group-hover:text-primary">
        {item.title ?? detailId}
      </p>
      {orgName !== '' ? <p className="mt-0.5 text-label-xs text-ink-muted">{orgName}</p> : null}
      {meta.length > 0 ? (
        <p className="mt-1 text-label-xs text-ink-muted">{meta.join(' · ')}</p>
      ) : null}
    </Link>
  );
}

function RightRail({ locale }: { locale: string }) {
  const t = useTranslations('volunteerHome');
  const dashboardQuery = useVolunteerHomeDashboardQuery();
  const recommendedQuery = useRecommendedQuery(true);
  const percent = dashboardQuery.data?.completionPercent ?? 0;
  const suggested = (recommendedQuery.data?.items ?? []).slice(0, 3);

  return (
    <div
      data-testid="dashboard-rail"
      className="flex min-w-0 flex-col gap-6 lg:max-h-full lg:overflow-y-auto lg:overscroll-contain"
    >
      <section aria-label={t('dashboard.railCompletionTitle')} className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-title-sm font-semibold text-ink">{t('dashboard.railCompletionTitle')}</h3>
          <span data-testid="dashboard-completion" className="text-title-sm font-semibold text-primary">
            {t('dashboard.completionValue', { percent })}
          </span>
        </div>
        <div className="mt-2.5">
          <ProgressBar percent={percent} label={t('dashboard.railCompletionTitle')} />
        </div>
        <p className="mt-2.5 text-body-sm leading-normal text-ink-muted">{t('dashboard.railCompletionHint')}</p>
        <Link
          href="/volunteer/profile"
          className="mt-2 inline-flex items-center gap-1 text-label-sm font-medium text-primary hover:underline"
        >
          <span>{t('dashboard.railCompletionCta')}</span>
          <ArrowRight size={14} aria-hidden="true" className="rtl:rotate-180" />
        </Link>
      </section>

      <section aria-label={t('dashboard.railSuggestedTitle')} className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
        <h3 className="text-title-sm font-semibold text-ink">{t('dashboard.railSuggestedTitle')}</h3>
        {recommendedQuery.isPending ? (
          <Loader label={t('shared.loading')} />
        ) : recommendedQuery.isError ? (
          <SectionError testId="rail-suggested-error" message={t('shared.loadError')} />
        ) : suggested.length === 0 ? (
          <div data-testid="rail-suggested-empty">
            <p className="text-title-sm font-medium text-ink">{t('dashboard.railSuggestedEmptyTitle')}</p>
            <p className="mt-0.5 text-body-sm text-ink-muted">{t('dashboard.railSuggestedEmptyBody')}</p>
          </div>
        ) : (
          <div data-testid="rail-suggested" className="space-y-3">
            {suggested.map((item, index) => (
              <div key={item.id ?? item._id ?? index}>
                {index > 0 ? <div className="mb-3 h-px bg-border-muted" /> : null}
                <SuggestedRow item={item} locale={locale} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-label={t('dashboard.railPopularTitle')} className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <h3 className="mb-2 text-title-sm font-semibold text-ink">{t('dashboard.railPopularTitle')}</h3>
        <div data-testid="rail-popular-gap">
          <p className="text-title-sm font-medium text-ink">{t('dashboard.railPopularGapTitle')}</p>
          <p className="mt-0.5 text-body-sm text-ink-muted">{t('dashboard.railPopularGapBody')}</p>
        </div>
      </section>
    </div>
  );
}

export function VolunteerDashboardPage({ locale }: { locale: string }) {
  const t = useTranslations('volunteerHome');
  const dashboardQuery = useVolunteerHomeDashboardQuery();
  const skillsQuery = useMySkillsQuery();
  const wilayasQuery = useFeedWilayasQuery();
  const meQuery = useVolunteerMeQuery();

  const wilayaName = useMemo(() => {
    const wilayaId = meQuery.data?.location?.wilayaId;
    if (!wilayaId) return null;
    const match = (wilayasQuery.data ?? []).find((w) => facetId(w) === wilayaId);
    const label = match ? facetLabel(match, locale) : '';
    return label !== '' ? label : null;
  }, [meQuery.data?.location?.wilayaId, wilayasQuery.data, locale]);

  const stats = dashboardQuery.data?.stats;
  const completed = typeof stats?.completedTasks === 'number' ? stats.completedTasks : 0;
  const verified = typeof stats?.verifiedExperiences === 'number' ? stats.verifiedExperiences : 0;
  const hours = typeof stats?.volunteerHours === 'number' ? stats.volunteerHours : 0;
  const skillsCount = skillsQuery.data?.length ?? 0;

  return (
    <RequireVolunteer locale={locale} next="/volunteer/dashboard">
      <div data-testid="volunteer-dashboard" className="min-w-0">
        <h1 className="sr-only">{t('dashboard.title')}</h1>
        {dashboardQuery.isPending ? (
          <Loader label={t('shared.loading')} />
        ) : dashboardQuery.isError ? (
          <SectionError testId="dashboard-error" message={t('shared.loadError')} />
        ) : (
          <div
            data-testid="dashboard-grid"
            className="grid min-w-0 grid-cols-1 items-start gap-6 lg:h-[calc(100dvh-7rem)] lg:grid-cols-[minmax(0,1fr)_300px]"
          >
            <div
              data-testid="dashboard-center"
              className="flex min-w-0 flex-col gap-6 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain"
            >
              <HeaderCard locale={locale} />
              <StatsRowShell
                completed={completed}
                verified={verified}
                hours={hours}
                skillsCount={skillsCount}
              />
              <LatestExperience
                experience={dashboardQuery.data.latestVerifiedExperience}
                verifiedCount={verified}
                locale={locale}
              />
              <OpportunitiesFeed locale={locale} wilayaName={wilayaName} />
            </div>
            <RightRail locale={locale} />
          </div>
        )}
      </div>
    </RequireVolunteer>
  );
}

function StatsRowShell({
  completed,
  verified,
  hours,
  skillsCount,
}: {
  completed: number;
  verified: number;
  hours: number;
  skillsCount: number;
}) {
  const t = useTranslations('volunteerHome');
  return (
    <section
      aria-label={t('dashboard.statsLabel')}
      className="rounded-lg border border-border bg-surface p-4 shadow-sm"
    >
      <dl data-testid="dashboard-stats" className="grid grid-cols-2 divide-border-muted sm:grid-cols-4 sm:divide-x">
        <div className="px-4 py-2 text-center">
          <dd data-testid="dashboard-stat-completed" className="text-display-lg font-semibold tracking-tight text-ink">
            {completed}
          </dd>
          <dt className="mt-0.5 text-label-sm text-ink-muted">{t('dashboard.statsCompleted')}</dt>
        </div>
        <div className="px-4 py-2 text-center">
          <dd data-testid="dashboard-stat-verified" className="text-display-lg font-semibold tracking-tight text-ink">
            {verified}
          </dd>
          <dt className="mt-0.5 text-label-sm text-ink-muted">{t('dashboard.statsVerified')}</dt>
        </div>
        <div className="px-4 py-2 text-center">
          <dd data-testid="dashboard-stat-hours" className="text-display-lg font-semibold tracking-tight text-ink">
            {hours}
          </dd>
          <dt className="mt-0.5 text-label-sm text-ink-muted">{t('dashboard.statsHours')}</dt>
        </div>
        <div className="px-4 py-2 text-center">
          <dd data-testid="dashboard-stat-skills" className="text-display-lg font-semibold tracking-tight text-ink">
            {skillsCount}
          </dd>
          <dt className="mt-0.5 text-label-sm text-ink-muted">{t('dashboard.statsSkills')}</dt>
        </div>
      </dl>
    </section>
  );
}
