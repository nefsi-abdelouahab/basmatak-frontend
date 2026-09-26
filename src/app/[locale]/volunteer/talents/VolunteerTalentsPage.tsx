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
  useFeedSkillCategoriesQuery,
  useFeedSkillsQuery,
  useFeedWilayasQuery,
  useTalentsQuery,
} from '@/hooks/useFeed';
import { useFavoritesLookupQuery } from '@/hooks/useFavorites';
import type { TalentFeedParams } from '@/lib/api/feed';
import { SectionError } from '../components';
import { TalentCard } from './TalentCard';

export interface TalentFilters {
  q: string;
  skillIds: string[];
  categoryId: string;
  wilayaIds: string[];
  minExperiences: string;
  hasAvailability: boolean;
  portfolio: boolean;
  sort: string;
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

export function parseTalentSearch(
  search: Record<string, string | string[] | undefined>,
): TalentFilters {
  return {
    q: asSingle(search.q),
    skillIds: asArray(search.skillIds ?? search.skillId),
    categoryId: asSingle(search.categoryId),
    wilayaIds: asArray(search.wilayaIds ?? search.wilayaId),
    minExperiences: asSingle(search.minExperiences),
    hasAvailability: asSingle(search.hasAvailability) === 'true',
    portfolio: asSingle(search.portfolio) === 'true',
    sort: asSingle(search.sort),
  };
}

export function toTalentSearchString(filters: TalentFilters): string {
  const params = new URLSearchParams();
  const set = (key: string, value: string) => {
    if (value !== '') params.set(key, value);
  };
  set('q', filters.q.trim());
  set('skillIds', filters.skillIds.join(','));
  set('categoryId', filters.categoryId);
  set('wilayaIds', filters.wilayaIds.join(','));
  set('minExperiences', filters.minExperiences);
  if (filters.hasAvailability) params.set('hasAvailability', 'true');
  if (filters.portfolio) params.set('portfolio', 'true');
  set('sort', filters.sort);
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

function toTalentParams(filters: TalentFilters, cursor?: string): TalentFeedParams {
  const min = Number.parseInt(filters.minExperiences, 10);
  return {
    q: filters.q.trim() || undefined,
    skillIds: filters.skillIds.length > 0 ? filters.skillIds : undefined,
    categoryId: filters.categoryId !== '' ? filters.categoryId : undefined,
    wilayaIds: filters.wilayaIds.length > 0 ? filters.wilayaIds : undefined,
    minExperiences: Number.isFinite(min) && min > 0 ? min : undefined,
    hasAvailability: filters.hasAvailability ? true : undefined,
    portfolio: filters.portfolio ? true : undefined,
    sort: (filters.sort as TalentFeedParams['sort']) || undefined,
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

const EMPTY_TALENT_FILTERS: TalentFilters = {
  q: '',
  skillIds: [],
  categoryId: '',
  wilayaIds: [],
  minExperiences: '',
  hasAvailability: false,
  portfolio: false,
  sort: '',
};

export function VolunteerTalentsPage({
  locale,
  initialSearch,
}: {
  locale: string;
  initialSearch: Record<string, string | string[] | undefined>;
}) {
  const t = useTranslations('volunteerHome');
  const router = useRouter();
  const pathname = usePathname();
  const next = `/${locale}/volunteer/talents`;

  const [draft, setDraft] = useState<TalentFilters>(() => parseTalentSearch(initialSearch));
  const [applied, setApplied] = useState<TalentFilters>(() => parseTalentSearch(initialSearch));
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [pageIdx, setPageIdx] = useState(0);

  const talentParams = useMemo(() => toTalentParams(applied, cursors[pageIdx]), [applied, cursors, pageIdx]);
  const talentsQuery = useTalentsQuery(talentParams);

  const categoriesQuery = useFeedSkillCategoriesQuery();
  const skillsQuery = useFeedSkillsQuery();
  const wilayasQuery = useFeedWilayasQuery();

  const talentIds = useMemo(
    () => (talentsQuery.data?.items ?? []).map((i) => i.username).filter(Boolean).slice(0, 50),
    [talentsQuery.data],
  );
  const lookupQuery = useFavoritesLookupQuery('talent', talentIds);

  const apply = (filters: TalentFilters) => {
    setApplied(filters);
    setCursors([undefined]);
    setPageIdx(0);
    router.replace(`${pathname}${toTalentSearchString(filters)}`);
  };

  return (
    <div data-testid="volunteer-talents" className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t('talents.title')}</h1>
        <p className="text-sm text-ink-muted">{t('talents.subtitle')}</p>
      </div>

      <Card title={t('talents.filtersTitle')}>
        <form
          data-testid="talents-filters"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            apply(draft);
          }}
        >
          <Input
            id="talent-q"
            label={t('talents.searchLabel')}
            placeholder={t('talents.searchPlaceholder')}
            value={draft.q}
            onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
          />
          <div>
            <label htmlFor="talent-skill" className="mb-1 block text-sm font-medium text-ink">
              {t('talents.skillLabel')}
            </label>
            <select
              id="talent-skill"
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
          <Select
            id="talent-category"
            label={t('talents.categoryLabel')}
            value={draft.categoryId}
            onChange={(e) => setDraft((d) => ({ ...d, categoryId: e.target.value }))}
            options={[
              { value: '', label: t('shared.all') },
              ...((categoriesQuery.data ?? []).map((c) => ({
                value: facetValue(c),
                label: facetLabel(c, locale),
              }))),
            ]}
          />
          <div>
            <label htmlFor="talent-wilaya" className="mb-1 block text-sm font-medium text-ink">
              {t('talents.wilayaLabel')}
            </label>
            <select
              id="talent-wilaya"
              multiple
              size={4}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink"
              value={draft.wilayaIds}
              onChange={(e) => setDraft((d) => ({ ...d, wilayaIds: multiValues(e) }))}
            >
              {(wilayasQuery.data ?? []).map((w) => (
                <option key={facetValue(w)} value={facetValue(w)}>
                  {facetLabel(w, locale)}
                </option>
              ))}
            </select>
          </div>
          <Input
            id="talent-min-exp"
            label={t('talents.minExperiencesLabel')}
            type="number"
            min={0}
            value={draft.minExperiences}
            onChange={(e) => setDraft((d) => ({ ...d, minExperiences: e.target.value }))}
          />
          <Select
            id="talent-sort"
            label={t('talents.sortLabel')}
            value={draft.sort}
            onChange={(e) => setDraft((d) => ({ ...d, sort: e.target.value }))}
            options={[
              { value: '', label: t('shared.all') },
              { value: 'newest', label: t('talents.sortNewest') },
              { value: 'oldest', label: t('talents.sortOldest') },
              { value: 'experiences_desc', label: t('talents.sortExperienced') },
            ]}
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink">{t('talents.filtersTitle')}</legend>
            <label className="inline-flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={draft.hasAvailability}
                onChange={(e) => setDraft((d) => ({ ...d, hasAvailability: e.target.checked }))}
              />
              {t('talents.hasAvailability')}
            </label>
            <label className="inline-flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={draft.portfolio}
                onChange={(e) => setDraft((d) => ({ ...d, portfolio: e.target.checked }))}
              />
              {t('talents.portfolioOnly')}
            </label>
          </fieldset>
          <div className="flex items-end">
            <Button type="submit" variant="primary" size="md">
              {t('talents.applyFilters')}
            </Button>
          </div>
        </form>
      </Card>

      {talentsQuery.isPending ? (
        <Loader label={t('shared.loading')} />
      ) : talentsQuery.isError ? (
        <SectionError testId="talents-error" message={t('shared.loadError')} />
      ) : (
        <>
          <p data-testid="talents-count" role="status" className="text-sm text-ink-muted">
            {t('talents.countBanner', { total: talentsQuery.data.total })}
          </p>
          {talentsQuery.data.total === 0 ? (
            <Empty
              title={t('talents.emptyTitle')}
              description={t('talents.emptyBody')}
              action={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setDraft(EMPTY_TALENT_FILTERS);
                    apply(EMPTY_TALENT_FILTERS);
                  }}
                >
                  {t('shared.clearFilters')}
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {talentsQuery.data.items.map((item) => {
                  const favorited = lookupQuery.data?.[item.username]?.favorited ?? item.isFavorited ?? false;
                  const count = lookupQuery.data?.[item.username]?.favoriteCount ?? null;
                  return (
                    <TalentCard key={item.username} item={item} locale={locale} favorited={favorited} favoriteCount={count} next={next} />
                  );
                })}
              </div>
              <Pagination
                page={talentsQuery.data.page ?? pageIdx + 1}
                pages={talentsQuery.data.pages ?? pageIdx + 1}
                statusText={t('shared.pageStatus', {
                  page: talentsQuery.data.page ?? pageIdx + 1,
                  pages: talentsQuery.data.pages ?? pageIdx + 1,
                })}
                previousLabel={t('shared.previous')}
                nextLabel={t('shared.next')}
                onPage={(target) => {
                  const current = talentsQuery.data.page ?? pageIdx + 1;
                  if (target < current && pageIdx > 0) {
                    setCursors((c) => c.slice(0, -1));
                    setPageIdx((i) => i - 1);
                  } else if (target > current && talentsQuery.data.nextCursor) {
                    const nextCursor = talentsQuery.data.nextCursor;
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
