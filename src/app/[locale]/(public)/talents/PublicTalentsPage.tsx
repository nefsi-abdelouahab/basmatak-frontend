'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import {
  usePublicTalentSkillsQuery,
  usePublicTalentWilayasQuery,
  usePublicTalentsQuery,
} from '@/hooks/usePublicTalent';
import {
  buildTalentsQuery,
  type PublicTalentFilters,
} from '@/lib/api/publicTalent';
import { PublicTalentCard } from './PublicTalentCard';

// F17 public talent directory over `GET /talents`. Guests may browse; saving a
// card redirects a guest to Login with `next` carrying the current directory URL
// (query string included), and no mutation is sent.
//
// The `sort` select only ever offers the server whitelist, but the URL is
// user-controllable, so an unknown `sort` is refused in `buildTalentsQuery`
// before any request: the query stays disabled and the neutral message renders.

export interface PublicTalentSearch {
  q: string;
  skillIds: string[];
  wilayaIds: string[];
  minExperiences: string;
  hasAvailability: boolean;
  portfolio: boolean;
  sort: string;
}

function asArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean);
  if (typeof value === 'string' && value !== '') return value.split(',').map((v) => v.trim()).filter(Boolean);
  return [];
}

function asSingle(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export function parseTalentSearch(
  search: Record<string, string | string[] | undefined>,
): PublicTalentSearch {
  return {
    q: asSingle(search.q),
    skillIds: asArray(search.skillIds ?? search.skillId),
    wilayaIds: asArray(search.wilayaIds ?? search.wilayaId),
    minExperiences: asSingle(search.minExperiences),
    hasAvailability: asSingle(search.hasAvailability) === 'true',
    portfolio: asSingle(search.portfolio) === 'true',
    sort: asSingle(search.sort),
  };
}

export function toTalentSearchString(filters: PublicTalentSearch): string {
  const params = new URLSearchParams();
  const set = (key: string, value: string) => {
    if (value !== '') params.set(key, value);
  };
  set('q', filters.q.trim());
  set('skillIds', filters.skillIds.join(','));
  set('wilayaIds', filters.wilayaIds.join(','));
  set('minExperiences', filters.minExperiences);
  if (filters.hasAvailability) params.set('hasAvailability', 'true');
  if (filters.portfolio) params.set('portfolio', 'true');
  set('sort', filters.sort);
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

function toTalentFilters(
  filters: PublicTalentSearch,
  cursor?: string,
): PublicTalentFilters {
  const min = Number.parseInt(filters.minExperiences, 10);
  return {
    q: filters.q.trim() || undefined,
    skillIds: filters.skillIds.length > 0 ? filters.skillIds : undefined,
    wilayaIds: filters.wilayaIds.length > 0 ? filters.wilayaIds : undefined,
    minExperiences: Number.isFinite(min) && min > 0 ? min : undefined,
    hasAvailability: filters.hasAvailability ? true : undefined,
    portfolio: filters.portfolio ? true : undefined,
    sort: filters.sort === '' ? undefined : filters.sort,
    cursor,
    limit: 20,
  };
}

function multiValues(event: React.ChangeEvent<HTMLSelectElement>): string[] {
  return Array.from(event.target.selectedOptions, (o) => o.value).filter((v) => v !== '');
}

const EMPTY_SEARCH: PublicTalentSearch = {
  q: '',
  skillIds: [],
  wilayaIds: [],
  minExperiences: '',
  hasAvailability: false,
  portfolio: false,
  sort: '',
};

export function PublicTalentsPage({
  locale,
  initialSearch,
}: {
  locale: string;
  initialSearch: Record<string, string | string[] | undefined>;
}) {
  const t = useTranslations('publicTalent');
  const router = useRouter();
  const pathname = usePathname();

  const [draft, setDraft] = useState<PublicTalentSearch>(() => parseTalentSearch(initialSearch));
  const [applied, setApplied] = useState<PublicTalentSearch>(() => parseTalentSearch(initialSearch));
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [pageIdx, setPageIdx] = useState(0);

  const filters = useMemo(() => toTalentFilters(applied, cursors[pageIdx]), [applied, cursors, pageIdx]);
  // Guest save returns the visitor to the exact filtered view they came from,
  // so the redirect target carries the active query string, not just the route.
  const next = `/${locale}/talents${toTalentSearchString(applied)}`;
  const talentsQuery = usePublicTalentsQuery(filters);
  const skillsQuery = usePublicTalentSkillsQuery();
  const wilayasQuery = usePublicTalentWilayasQuery();
  // An out-of-whitelist sort is refused before a request is sent.
  const sortRejected = !buildTalentsQuery(filters).ok;

  const skillNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const skill of skillsQuery.data ?? []) {
      const id = skill.skillId ?? skill.id ?? skill._id;
      if (!id) continue;
      map.set(
        id,
        locale === 'ar' ? skill.nameAr ?? skill.nameFr ?? id : skill.nameFr ?? skill.nameAr ?? id,
      );
    }
    return map;
  }, [skillsQuery.data, locale]);

  const wilayaNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const wilaya of wilayasQuery.data ?? []) {
      const code = wilaya.code ?? wilaya.id ?? wilaya._id;
      if (!code) continue;
      map.set(
        code,
        locale === 'ar'
          ? wilaya.nameAr ?? wilaya.nameFr ?? code
          : wilaya.nameFr ?? wilaya.nameAr ?? code,
      );
    }
    return map;
  }, [wilayasQuery.data, locale]);

  const apply = (search: PublicTalentSearch) => {
    setApplied(search);
    setCursors([undefined]);
    setPageIdx(0);
    router.replace(`${pathname}${toTalentSearchString(search)}`);
  };

  const facets = talentsQuery.data?.facets;

  return (
    <div data-testid="public-talents" className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t('directory.title')}</h1>
        <p className="text-sm text-ink-muted">{t('directory.subtitle')}</p>
      </div>

      <Card title={t('directory.applyFilters')}>
        <form
          data-testid="public-talents-filters"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            apply(draft);
          }}
        >
          <Input
            id="public-talent-q"
            label={t('directory.searchLabel')}
            placeholder={t('directory.searchPlaceholder')}
            value={draft.q}
            onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
          />
          <div>
            <label htmlFor="public-talent-skill" className="mb-1 block text-sm font-medium text-ink">
              {t('directory.skillLabel')}
            </label>
            <select
              id="public-talent-skill"
              multiple
              size={4}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink"
              value={draft.skillIds}
              onChange={(e) => setDraft((d) => ({ ...d, skillIds: multiValues(e) }))}
            >
              {Array.from(skillNames.entries()).map(([id, label]) => {
                const count = facets?.skills.find((f) => f.skillId === id)?.count;
                return (
                  <option key={id} value={id}>
                    {typeof count === 'number' ? `${label} (${count})` : label}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label htmlFor="public-talent-wilaya" className="mb-1 block text-sm font-medium text-ink">
              {t('directory.wilayaLabel')}
            </label>
            <select
              id="public-talent-wilaya"
              multiple
              size={4}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink"
              value={draft.wilayaIds}
              onChange={(e) => setDraft((d) => ({ ...d, wilayaIds: multiValues(e) }))}
            >
              {Array.from(wilayaNames.entries()).map(([code, label]) => {
                const count = facets?.wilayas.find((f) => f.wilayaId === code)?.count;
                return (
                  <option key={code} value={code}>
                    {typeof count === 'number' ? `${label} (${count})` : label}
                  </option>
                );
              })}
            </select>
          </div>
          <Input
            id="public-talent-min-exp"
            label={t('directory.minExperiencesLabel')}
            type="number"
            min={0}
            value={draft.minExperiences}
            onChange={(e) => setDraft((d) => ({ ...d, minExperiences: e.target.value }))}
          />
          <Select
            id="public-talent-sort"
            label={t('directory.sortLabel')}
            value={draft.sort}
            onChange={(e) => setDraft((d) => ({ ...d, sort: e.target.value }))}
            options={[
              { value: '', label: t('directory.allOption') },
              { value: 'newest', label: t('directory.sortNewest') },
              { value: 'oldest', label: t('directory.sortOldest') },
              { value: 'experiences_desc', label: t('directory.sortExperienced') },
            ]}
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink">{t('directory.title')}</legend>
            <label className="inline-flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={draft.hasAvailability}
                onChange={(e) => setDraft((d) => ({ ...d, hasAvailability: e.target.checked }))}
              />
              {t('directory.hasAvailability')}
            </label>
            <label className="inline-flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={draft.portfolio}
                onChange={(e) => setDraft((d) => ({ ...d, portfolio: e.target.checked }))}
              />
              {t('directory.portfolioOnly')}
            </label>
          </fieldset>
          <div className="flex items-end">
            <Button type="submit" variant="primary" size="md">
              {t('directory.applyFilters')}
            </Button>
          </div>
        </form>
      </Card>

      {sortRejected ? (
        <Empty
          title={t('directory.invalidSortTitle')}
          description={t('directory.invalidSortBody')}
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setDraft(EMPTY_SEARCH);
                apply(EMPTY_SEARCH);
              }}
            >
              {t('shared.clearFilters')}
            </Button>
          }
        />
      ) : talentsQuery.isPending ? (
        <Loader label={t('shared.loading')} />
      ) : talentsQuery.isError ? (
        <div className="flex flex-col gap-2">
          <p data-testid="public-talents-error" role="alert" className="text-sm text-status-error">
            {t('shared.loadError')}
          </p>
          <Button variant="secondary" onClick={() => talentsQuery.refetch()}>
            {t('shared.retry')}
          </Button>
        </div>
      ) : (
        <>
          <p data-testid="public-talents-count" role="status" className="text-sm text-ink-muted">
            {t('directory.countBanner', { total: talentsQuery.data?.total ?? 0 })}
          </p>
          {(talentsQuery.data?.items.length ?? 0) === 0 ? (
            <Empty
              title={t('directory.emptyTitle')}
              description={t('directory.emptyBody')}
              action={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setDraft(EMPTY_SEARCH);
                    apply(EMPTY_SEARCH);
                  }}
                >
                  {t('shared.clearFilters')}
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {(talentsQuery.data?.items ?? []).map((item) => (
                  <PublicTalentCard
                    key={item.username}
                    item={item}
                    locale={locale}
                    favorited={Boolean(item.isFavorited)}
                    favoriteCount={item.favoriteCount ?? 0}
                    wilayaName={
                      item.location?.wilayaId
                        ? wilayaNames.get(item.location.wilayaId) ?? item.location.wilayaId
                        : null
                    }
                    next={next}
                  />
                ))}
              </div>
              <Pagination
                page={talentsQuery.data?.page ?? pageIdx + 1}
                pages={talentsQuery.data?.pages ?? pageIdx + 1}
                statusText={t('directory.pageStatus', {
                  page: talentsQuery.data?.page ?? pageIdx + 1,
                  pages: talentsQuery.data?.pages ?? pageIdx + 1,
                })}
                previousLabel={t('directory.previous')}
                nextLabel={t('directory.next')}
                onPage={(target) => {
                  const current = talentsQuery.data?.page ?? pageIdx + 1;
                  if (target < current && pageIdx > 0) {
                    setCursors((c) => c.slice(0, -1));
                    setPageIdx((i) => i - 1);
                  } else if (target > current && talentsQuery.data?.nextCursor) {
                    setCursors((c) => [...c, talentsQuery.data?.nextCursor ?? undefined]);
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
