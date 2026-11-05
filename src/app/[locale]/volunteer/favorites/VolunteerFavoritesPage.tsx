'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bookmark } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { Pagination } from '@/components/ui/Pagination';
import { Pill } from '@/components/ui/Pill';
import {
  useFavoritesCountsQuery,
  useMyFavoritesQuery,
  useToggleOpportunityFavoriteMutation,
  useToggleOrganizationFavoriteMutation,
  useToggleTalentFavoriteMutation,
} from '@/hooks/useFavorites';
import type { FavoriteItem, FavoriteTargetType } from '@/lib/api/favorites';
import { RequireVolunteer, SectionError } from '../components';

// Saved items page (Task 5): one cursor-paginated tab per target type.
// Opportunities link only while published (the public detail endpoint serves
// published rows), organizations link only while active, and rows whose
// target was removed keep their place as disabled entries so the user can
// still unsave them. Talent rows render the username, never `fullName`.

const TABS: FavoriteTargetType[] = ['opportunity', 'talent', 'organization'];

const OPPORTUNITY_STATUS_LABEL: Record<string, string> = {
  published: 'statusPublished',
  draft: 'statusDraft',
  in_progress: 'statusInProgress',
  completed: 'statusCompleted',
  closed: 'statusClosed',
  cancelled: 'statusCancelled',
};

const ORGANIZATION_STATUS_LABEL: Record<string, string> = {
  active: 'statusActive',
  suspended: 'statusSuspended',
  deleted: 'statusDeleted',
};

const EMPTY_COPY: Record<
  FavoriteTargetType,
  { title: string; body: string; action: string; href: string }
> = {
  opportunity: {
    title: 'emptyOpportunitiesTitle',
    body: 'emptyOpportunitiesBody',
    action: 'emptyOpportunitiesAction',
    href: '/volunteer/opportunities',
  },
  talent: {
    title: 'emptyTalentsTitle',
    body: 'emptyTalentsBody',
    action: 'emptyTalentsAction',
    href: '/volunteer/talents',
  },
  organization: {
    title: 'emptyOrganizationsTitle',
    body: 'emptyOrganizationsBody',
    action: 'emptyOrganizationsAction',
    // No public organization directory route exists yet; opportunities are
    // the discoverable path into organization profiles.
    href: '/opportunities',
  },
};

function formatDate(value: string | null | undefined, locale: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

function summaryName(
  summary: { nameAr?: string | null; nameFr?: string | null } | null | undefined,
  locale: string,
): string | null {
  if (!summary) return null;
  const name = locale === 'ar' ? summary.nameAr ?? summary.nameFr : summary.nameFr ?? summary.nameAr;
  return name && name.trim() !== '' ? name : null;
}

export function VolunteerFavoritesPage({ locale }: { locale: string }) {
  const t = useTranslations('volunteerFavorites');
  const [tab, setTab] = useState<FavoriteTargetType>('opportunity');
  const [cursors, setCursors] = useState<Record<FavoriteTargetType, (string | undefined)[]>>({
    opportunity: [undefined],
    talent: [undefined],
    organization: [undefined],
  });
  const [pageIdx, setPageIdx] = useState<Record<FavoriteTargetType, number>>({
    opportunity: 0,
    talent: 0,
    organization: 0,
  });

  const cursor = cursors[tab][pageIdx[tab]];
  const listQuery = useMyFavoritesQuery({ targetType: tab, cursor });
  const countsQuery = useFavoritesCountsQuery();
  const toggleOpportunity = useToggleOpportunityFavoriteMutation();
  const toggleTalent = useToggleTalentFavoriteMutation();
  const toggleOrganization = useToggleOrganizationFavoriteMutation();
  const pending =
    toggleOpportunity.isPending || toggleTalent.isPending || toggleOrganization.isPending;

  const counts = useMemo(
    () => ({
      opportunity: countsQuery.data?.opportunity ?? 0,
      talent: countsQuery.data?.talent ?? 0,
      organization: countsQuery.data?.organization ?? 0,
    }),
    [countsQuery.data],
  );

  const unsave = (item: FavoriteItem) => {
    if (item.targetType === 'opportunity') {
      toggleOpportunity.mutate({ id: item.targetId, favorited: true });
      return;
    }
    if (item.targetType === 'talent' && item.summary?.username) {
      toggleTalent.mutate({ username: item.summary.username, favorited: true });
      return;
    }
    if (item.targetType === 'organization' && item.summary?.slug) {
      toggleOrganization.mutate({ slug: item.summary.slug, favorited: true });
    }
  };

  const canUnsave = (item: FavoriteItem): boolean => {
    if (item.targetType === 'opportunity') return true;
    if (item.targetType === 'talent') return Boolean(item.summary?.username);
    return Boolean(item.summary?.slug);
  };

  const goToPage = (target: number) => {
    const current = listQuery.data?.page ?? pageIdx[tab] + 1;
    if (target < current && pageIdx[tab] > 0) {
      setCursors((state) => ({ ...state, [tab]: state[tab].slice(0, -1) }));
      setPageIdx((state) => ({ ...state, [tab]: state[tab] - 1 }));
      return;
    }
    if (target > current && listQuery.data?.nextCursor) {
      const nextCursor = listQuery.data.nextCursor;
      setCursors((state) => ({ ...state, [tab]: [...state[tab], nextCursor ?? undefined] }));
      setPageIdx((state) => ({ ...state, [tab]: state[tab] + 1 }));
    }
  };

  const tabLabel = (type: FavoriteTargetType): string => {
    const label =
      type === 'opportunity'
        ? t('tabOpportunities')
        : type === 'talent'
          ? t('tabTalents')
          : t('tabOrganizations');
    return t('tabLabel', { label, count: counts[type] });
  };

  const empty = EMPTY_COPY[tab];

  return (
    <RequireVolunteer locale={locale} next="/volunteer/favorites">
      <div data-testid="volunteer-favorites" className="flex min-w-0 flex-col gap-6">
        <nav aria-label={t('breadcrumbLabel')}>
          <ol className="flex flex-wrap items-center gap-1.5 text-label-sm">
            <li className="text-ink-muted">{t('breadcrumbSection')}</li>
            <li aria-hidden="true" className="text-ink-muted">
              /
            </li>
            <li aria-current="page" className="font-medium text-ink">
              {t('title')}
            </li>
          </ol>
        </nav>

        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">{t('subtitle')}</p>
        </div>

        <div
          role="tablist"
          aria-label={t('tabsLabel')}
          className="flex min-w-0 items-center gap-1 overflow-x-auto border-b border-border-muted pb-2"
        >
          {TABS.map((type) => (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={tab === type}
              data-testid={`favorites-tab-${type}`}
              onClick={() => setTab(type)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-label-sm font-medium transition-colors ${
                tab === type
                  ? 'bg-surface-muted text-ink'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {tabLabel(type)}
            </button>
          ))}
        </div>

        {listQuery.isPending ? (
          <Loader label={t('loading')} />
        ) : listQuery.isError ? (
          <div className="flex flex-col items-start gap-2">
            <SectionError testId="favorites-error" message={t('loadError')} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="favorites-retry"
              onClick={() => void listQuery.refetch()}
            >
              {t('retry')}
            </Button>
          </div>
        ) : listQuery.data.items.length === 0 ? (
          <div data-testid={`favorites-empty-${tab}`}>
            <Empty
              title={t(empty.title)}
              description={t(empty.body)}
              action={
                <Link href={empty.href}>
                  <Button type="button" variant="gold" size="sm">
                    {t(empty.action)}
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <ul data-testid={`favorites-list-${tab}`} className="flex flex-col gap-3">
              {listQuery.data.items.map((item) => {
                const summary = item.summary;
                const savedOn = formatDate(item.createdAt, locale);
                const isOpportunity = item.targetType === 'opportunity';
                const isTalent = item.targetType === 'talent';
                const isOrganization = item.targetType === 'organization';

                const opportunityAvailable =
                  isOpportunity && summary?.status === 'published' && summary.slug;
                const talentAvailable = isTalent && summary?.username;
                const organizationAvailable =
                  isOrganization && summary?.status === 'active' && summary.slug;

                const title = isOpportunity
                  ? summary?.title ?? t('removed')
                  : isTalent
                    ? summary?.username ?? t('removed')
                    : summaryName(summary, locale) ?? t('removed');

                const href = opportunityAvailable
                  ? `/opportunities/${summary?.slug}`
                  : talentAvailable
                    ? `/volunteers/${summary?.username}`
                    : organizationAvailable
                      ? `/orgs/${summary?.slug}`
                      : null;

                const status = summary?.status ?? null;
                const statusLabel =
                  isOpportunity && status
                    ? OPPORTUNITY_STATUS_LABEL[status]
                    : isOrganization && status
                      ? ORGANIZATION_STATUS_LABEL[status]
                      : undefined;

                const orgName = isOpportunity ? summaryName(summary?.organization, locale) : null;
                const deadline = isOpportunity
                  ? formatDate(summary?.applicationDeadline, locale)
                  : null;
                const handle = isTalent && summary?.username ? `@${summary.username}` : null;
                const metadata = [orgName, handle, deadline ? t('deadline', { date: deadline }) : null]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <li
                    key={`${item.targetType}:${item.targetId}`}
                    data-testid="favorites-row"
                    className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {href ? (
                          <Link
                            href={href}
                            className="min-w-0 truncate font-semibold text-ink hover:text-gold-strong"
                          >
                            {title}
                          </Link>
                        ) : (
                          <span
                            aria-disabled="true"
                            className="min-w-0 truncate font-semibold text-ink-muted"
                          >
                            {title}
                          </span>
                        )}
                        {statusLabel ? <Pill tone="neutral">{t(statusLabel)}</Pill> : null}
                      </div>
                      {metadata ? (
                        <p className="min-w-0 truncate text-sm text-ink-muted">{metadata}</p>
                      ) : null}
                      {savedOn ? (
                        <p className="text-label-xs text-ink-muted">
                          {t('savedOn', { date: savedOn })}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      data-testid="favorites-unsave"
                      disabled={pending || !canUnsave(item)}
                      onClick={() => unsave(item)}
                      className="shrink-0"
                    >
                      <Bookmark size={16} aria-hidden="true" className="fill-current" />
                      {t('unsave')}
                    </Button>
                  </li>
                );
              })}
            </ul>
            {(listQuery.data.pages ?? 1) > 1 ? (
              <Pagination
                page={listQuery.data.page ?? pageIdx[tab] + 1}
                pages={listQuery.data.pages ?? pageIdx[tab] + 1}
                statusText={t('pageStatus', {
                  page: listQuery.data.page ?? pageIdx[tab] + 1,
                  pages: listQuery.data.pages ?? pageIdx[tab] + 1,
                })}
                previousLabel={t('previous')}
                nextLabel={t('next')}
                onPage={goToPage}
              />
            ) : null}
          </>
        )}
      </div>
    </RequireVolunteer>
  );
}
