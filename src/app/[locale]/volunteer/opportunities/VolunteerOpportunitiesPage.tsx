'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import {
  useFeedMunicipalitiesQuery,
  useFeedSkillCategoriesQuery,
  useFeedSkillsQuery,
  useFeedWilayasQuery,
  useOpportunitiesQuery,
  useRecommendedQuery,
} from '@/hooks/useFeed';
import { useFavoritesLookupQuery } from '@/hooks/useFavorites';
import { weekWindow, weekendWindow, type OpportunityFeedParams } from '@/lib/api/feed';
import { useSessionQuery } from '@/hooks/useSession';
import { useVolunteerMeQuery } from '@/hooks/useVolunteerAccount';
import { SectionError } from '../components';
import { OpportunityCard } from './OpportunityCard';

export type WindowChoice = 'all' | 'week' | 'weekend';

export interface OpportunityFilters {
  q: string;
  categoryIds: string[];
  skillIds: string[];
  wilayaIds: string[];
  municipalityId: string;
  openSeats: boolean;
  nearMe: boolean;
  sort: string;
  window: WindowChoice;
  from: string;
  to: string;
}

function asArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => v.split(',')).filter(Boolean);
  if (typeof value === 'string' && value !== '') return value.split(',').filter(Boolean);
  return [];
}

function asSingle(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export function parseOpportunitySearch(
  search: Record<string, string | string[] | undefined>,
): OpportunityFilters {
  const openSeats = asSingle(search.openSeats) === 'true';
  const nearMe = asSingle(search.nearMe) === 'me';
  const from = asSingle(search.from);
  const to = asSingle(search.to);
  return {
    q: asSingle(search.q),
    categoryIds: asArray(search.categoryId),
    skillIds: asArray(search.skillId),
    wilayaIds: asArray(search.wilayaId),
    municipalityId: asSingle(search.municipalityId),
    openSeats,
    nearMe,
    sort: asSingle(search.sort),
    window: 'all',
    from,
    to,
  };
}

export function toSearchString(filters: OpportunityFilters): string {
  const params = new URLSearchParams();
  const set = (key: string, value: string) => {
    if (value !== '') params.set(key, value);
  };
  set('q', filters.q.trim());
  set('categoryId', filters.categoryIds.join(','));
  set('skillId', filters.skillIds.join(','));
  set('wilayaId', filters.wilayaIds.join(','));
  set('municipalityId', filters.municipalityId);
  if (filters.openSeats) params.set('openSeats', 'true');
  if (filters.nearMe) params.set('nearMe', 'me');
  set('sort', filters.sort);
  set('from', filters.from);
  set('to', filters.to);
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

function toFeedParams(filters: OpportunityFilters, cursor?: string): OpportunityFeedParams {
  return {
    q: filters.q.trim() || undefined,
    categoryIds: filters.categoryIds.length > 0 ? filters.categoryIds : undefined,
    skillIds: filters.skillIds.length > 0 ? filters.skillIds : undefined,
    wilayaIds: filters.wilayaIds.length > 0 ? filters.wilayaIds : undefined,
    municipalityIds: filters.municipalityId !== '' ? [filters.municipalityId] : undefined,
    from: filters.from !== '' ? filters.from : undefined,
    to: filters.to !== '' ? filters.to : undefined,
    hasOpenPositions: filters.openSeats ? true : undefined,
    nearMe: filters.nearMe ? 'me' : undefined,
    sort: (filters.sort as OpportunityFeedParams['sort']) || undefined,
    cursor,
    limit: 20,
  };
}

function multiValues(event: React.ChangeEvent<HTMLSelectElement>): string[] {
  return Array.from(event.target.selectedOptions, (o) => o.value).filter((v) => v !== '');
}

function facetLabel(option: { id?: string; _id?: string; code?: string; nameFr?: string; nameAr?: string; name?: string }, locale: string): string {
  if (locale === 'ar') return option.nameAr ?? option.nameFr ?? option.name ?? option.code ?? '';
  return option.nameFr ?? option.nameAr ?? option.name ?? option.code ?? '';
}

function facetValue(option: { id?: string; _id?: string; code?: string }): string {
  return option.id ?? option._id ?? option.code ?? '';
}

const EMPTY_FILTERS: OpportunityFilters = {
  q: '',
  categoryIds: [],
  skillIds: [],
  wilayaIds: [],
  municipalityId: '',
  openSeats: false,
  nearMe: false,
  sort: '',
  window: 'all',
  from: '',
  to: '',
};

export function VolunteerOpportunitiesPage({
  locale,
  initialSearch,
}: {
  locale: string;
  initialSearch: Record<string, string | string[] | undefined>;
}) {
  const t = useTranslations('volunteerHome');
  const router = useRouter();
  const pathname = usePathname();
  const next = `/${locale}/volunteer/opportunities`;

  const [draft, setDraft] = useState<OpportunityFilters>(() => parseOpportunitySearch(initialSearch));
  const [applied, setApplied] = useState<OpportunityFilters>(() => parseOpportunitySearch(initialSearch));
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [pageIdx, setPageIdx] = useState(0);

  const feedParams = useMemo(
    () => toFeedParams(applied, cursors[pageIdx]),
    [applied, cursors, pageIdx],
  );
  const feedQuery = useOpportunitiesQuery(feedParams);

  const session = useSessionQuery();
  const recommendedQuery = useRecommendedQuery(!!session.data);

  const meQuery = useVolunteerMeQuery();
  const canNearMe = meQuery.data ? !!meQuery.data.location?.wilayaId : true;

  const categoriesQuery = useFeedSkillCategoriesQuery();
  const skillsQuery = useFeedSkillsQuery();
  const wilayasQuery = useFeedWilayasQuery();
  const municipalitiesQuery = useFeedMunicipalitiesQuery(draft.wilayaIds[0]);

  const stripIds = useMemo(
    () => (recommendedQuery.data?.items ?? []).map((i) => i.id ?? i._id ?? '').filter(Boolean) as string[],
    [recommendedQuery.data],
  );
  const feedIds = useMemo(
    () => (feedQuery.data?.items ?? []).map((i) => i.id ?? i._id ?? '').filter(Boolean) as string[],
    [feedQuery.data],
  );
  const lookupIds = useMemo(
    () => Array.from(new Set([...stripIds, ...feedIds])).slice(0, 50),
    [stripIds, feedIds],
  );
  const lookupQuery = useFavoritesLookupQuery('opportunity', lookupIds);

  const apply = (filters: OpportunityFilters) => {
    const gated: OpportunityFilters = { ...filters, nearMe: filters.nearMe && canNearMe };
    setApplied(gated);
    setCursors([undefined]);
    setPageIdx(0);
    router.replace(`${pathname}${toSearchString(gated)}`);
  };

  const setWindow = (window: WindowChoice) => {
    if (window === 'all') {
      setDraft((d) => ({ ...d, window, from: '', to: '' }));
      return;
    }
    const bounds = window === 'week' ? weekWindow(new Date()) : weekendWindow(new Date());
    setDraft((d) => ({ ...d, window, from: bounds.from, to: bounds.to }));
  };

  const saveStateOf = (id: string, fallback: boolean | null | undefined) => ({
    favorited: lookupQuery.data?.[id]?.favorited ?? fallback ?? false,
    count: lookupQuery.data?.[id]?.favoriteCount ?? null,
  });

  return (
    <div data-testid="volunteer-opportunities" className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t('opportunities.title')}</h1>
        <p className="text-sm text-ink-muted">{t('opportunities.subtitle')}</p>
      </div>

      {session.data && recommendedQuery.data && recommendedQuery.data.items.length > 0 ? (
        <section aria-label={t('opportunities.recommendedTitle')}>
          <h2 className="mb-2 text-lg font-semibold text-ink">{t('opportunities.recommendedTitle')}</h2>
          <div data-testid="recommended-strip" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recommendedQuery.data.items.map((item) => {
              const id = item.id ?? item._id ?? '';
              const state = saveStateOf(id, item.isFavorited);
              return (
                <OpportunityCard key={`rec-${id}`} item={item} locale={locale} favorited={state.favorited} favoriteCount={state.count} next={next} saveTestIdPrefix="save-opp-rec" />
              );
            })}
          </div>
        </section>
      ) : null}

      <Card title={t('opportunities.filtersTitle')}>
        <form
          data-testid="opportunities-filters"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            apply(draft);
          }}
        >
          <Input
            id="opp-q"
            label={t('opportunities.searchLabel')}
            placeholder={t('opportunities.searchPlaceholder')}
            value={draft.q}
            onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
          />
          <div>
            <label htmlFor="opp-category" className="mb-1 block text-sm font-medium text-ink">
              {t('opportunities.categoryLabel')}
            </label>
            <select
              id="opp-category"
              multiple
              size={4}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink"
              value={draft.categoryIds}
              onChange={(e) => setDraft((d) => ({ ...d, categoryIds: multiValues(e) }))}
            >
              {(categoriesQuery.data ?? []).map((c) => (
                <option key={facetValue(c)} value={facetValue(c)}>
                  {facetLabel(c, locale)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="opp-skill" className="mb-1 block text-sm font-medium text-ink">
              {t('opportunities.skillLabel')}
            </label>
            <select
              id="opp-skill"
              multiple
              size={4}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink"
              value={draft.skillIds}
              onChange={(e) => setDraft((d) => ({ ...d, skillIds: multiValues(e) }))}
            >
              {(skillsQuery.data ?? []).map((s) => (
                <option key={facetValue(s)} value={facetValue(s)}>
                  {facetLabel(s, locale)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="opp-wilaya" className="mb-1 block text-sm font-medium text-ink">
              {t('opportunities.wilayaLabel')}
            </label>
            <select
              id="opp-wilaya"
              multiple
              size={4}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink"
              value={draft.wilayaIds}
              onChange={(e) => setDraft((d) => ({ ...d, wilayaIds: multiValues(e), municipalityId: '' }))}
            >
              {(wilayasQuery.data ?? []).map((w) => (
                <option key={facetValue(w)} value={facetValue(w)}>
                  {facetLabel(w, locale)}
                </option>
              ))}
            </select>
          </div>
          <Select
            id="opp-municipality"
            label={t('opportunities.municipalityLabel')}
            value={draft.municipalityId}
            onChange={(e) => setDraft((d) => ({ ...d, municipalityId: e.target.value }))}
            options={[
              { value: '', label: t('shared.all') },
              ...((municipalitiesQuery.data ?? []).map((m) => ({
                value: facetValue(m),
                label: facetLabel(m, locale),
              }))),
            ]}
          />
          <Select
            id="opp-sort"
            label={t('opportunities.sortLabel')}
            value={draft.sort}
            onChange={(e) => setDraft((d) => ({ ...d, sort: e.target.value }))}
            options={[
              { value: '', label: t('shared.all') },
              { value: 'newest', label: t('opportunities.sortNewest') },
              { value: 'oldest', label: t('opportunities.sortOldest') },
              { value: 'deadline_asc', label: t('opportunities.sortDeadline') },
              { value: 'startDate_asc', label: t('opportunities.sortStartDate') },
            ]}
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink">{t('opportunities.windowAll')}</legend>
            <div className="flex flex-wrap gap-4 text-sm text-ink">
              {(['all', 'week', 'weekend'] as WindowChoice[]).map((w) => (
                <label key={w} className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="opp-window"
                    value={w}
                    checked={draft.window === w}
                    onChange={() => setWindow(w)}
                  />
                  {w === 'all' ? t('opportunities.windowAll') : w === 'week' ? t('opportunities.windowWeek') : t('opportunities.windowWeekend')}
                </label>
              ))}
            </div>
            <label className="inline-flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={draft.openSeats}
                onChange={(e) => setDraft((d) => ({ ...d, openSeats: e.target.checked }))}
              />
              {t('opportunities.openSeats')}
            </label>
            <label className="inline-flex items-center gap-1.5 text-sm text-ink" title={canNearMe ? undefined : t('opportunities.nearMeHint')}>
              <input
                type="checkbox"
                checked={draft.nearMe && canNearMe}
                disabled={!canNearMe}
                onChange={(e) => setDraft((d) => ({ ...d, nearMe: e.target.checked }))}
              />
              {t('opportunities.nearMe')}
            </label>
            {!canNearMe ? <p className="text-xs text-ink-muted">{t('opportunities.nearMeHint')}</p> : null}
          </fieldset>
          <div className="flex items-end">
            <Button type="submit" variant="primary" size="md">
              {t('opportunities.applyFilters')}
            </Button>
          </div>
        </form>
      </Card>

      {feedQuery.isPending ? (
        <Loader label={t('shared.loading')} />
      ) : feedQuery.isError ? (
        <SectionError testId="opportunities-error" message={t('shared.loadError')} />
      ) : (
        <>
          <p data-testid="feed-count" role="status" className="text-sm text-ink-muted">
            {t('opportunities.countBanner', { total: feedQuery.data.total })}
          </p>
          {feedQuery.data.total === 0 ? (
            <Empty
              title={t('opportunities.emptyTitle')}
              description={t('opportunities.emptyBody')}
              action={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setDraft(EMPTY_FILTERS);
                    apply(EMPTY_FILTERS);
                  }}
                >
                  {t('shared.clearFilters')}
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {feedQuery.data.items.map((item) => {
                  const id = item.id ?? item._id ?? '';
                  const state = saveStateOf(id, item.isFavorited);
                  return (
                    <OpportunityCard key={id} item={item} locale={locale} favorited={state.favorited} favoriteCount={state.count} next={next} />
                  );
                })}
              </div>
              <Pagination
                page={feedQuery.data.page ?? pageIdx + 1}
                pages={feedQuery.data.pages ?? pageIdx + 1}
                statusText={t('shared.pageStatus', {
                  page: feedQuery.data.page ?? pageIdx + 1,
                  pages: feedQuery.data.pages ?? pageIdx + 1,
                })}
                previousLabel={t('shared.previous')}
                nextLabel={t('shared.next')}
                onPage={(target) => {
                  const current = feedQuery.data.page ?? pageIdx + 1;
                  if (target < current && pageIdx > 0) {
                    setCursors((c) => c.slice(0, -1));
                    setPageIdx((i) => i - 1);
                  } else if (target > current && feedQuery.data.nextCursor) {
                    const nextCursor = feedQuery.data.nextCursor;
                    setCursors((c) => [...c, nextCursor ?? undefined]);
                    setPageIdx((i) => i + 1);
                  }
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
