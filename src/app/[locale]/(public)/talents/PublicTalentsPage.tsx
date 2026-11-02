'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowUpDown,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Landmark,
  Layers,
  MapPin,
  RotateCcw,
  Search,
  SearchX,
  Users,
  Wrench,
} from 'lucide-react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import {
  usePublicTalentCategoriesQuery,
  usePublicTalentSkillsQuery,
  usePublicTalentWilayasQuery,
  usePublicTalentsQuery,
} from '@/hooks/usePublicTalent';
import {
  buildTalentsQuery,
  type PublicTalentFilters,
} from '@/lib/api/publicTalent';
import { PublicTalentCard } from './PublicTalentCard';

// Public Discover Talents directory over `GET /talents` (single-value filters:
// q, skillId, categoryId, wilayaId, server-whitelisted sort). Selects apply
// immediately; the search box debounces. An out-of-whitelist `sort` is refused
// in `buildTalentsQuery` before any request: the query stays disabled and the
// neutral message renders. Cursor pagination drives a numbered control over
// visited pages (cursor pages cannot be addressed arbitrarily).

const PAGE_LIMIT = 6;
const SEARCH_DEBOUNCE_MS = 400;

export interface PublicTalentSearch {
  q: string;
  skillId: string;
  categoryId: string;
  wilayaId: string;
  sort: string;
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
    skillId: asSingle(search.skillId),
    categoryId: asSingle(search.categoryId),
    wilayaId: asSingle(search.wilayaId),
    sort: asSingle(search.sort) || 'newest',
  };
}

export function toTalentSearchString(filters: PublicTalentSearch): string {
  const params = new URLSearchParams();
  const set = (key: string, value: string) => {
    if (value !== '') params.set(key, value);
  };
  set('q', filters.q.trim());
  set('skillId', filters.skillId);
  set('categoryId', filters.categoryId);
  set('wilayaId', filters.wilayaId);
  set('sort', filters.sort);
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

function toTalentFilters(filters: PublicTalentSearch, cursor?: string): PublicTalentFilters {
  return {
    q: filters.q.trim() || undefined,
    skillId: filters.skillId || undefined,
    categoryId: filters.categoryId || undefined,
    wilayaId: filters.wilayaId || undefined,
    sort: filters.sort === '' ? undefined : filters.sort,
    cursor,
    limit: PAGE_LIMIT,
  };
}

const EMPTY_SEARCH: PublicTalentSearch = {
  q: '',
  skillId: '',
  categoryId: '',
  wilayaId: '',
  sort: 'newest',
};

function FilterSelect({
  id,
  label,
  icon,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted"
      >
        {icon}
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-full cursor-pointer appearance-none rounded-md border border-border bg-surface pe-8 ps-3 text-sm text-ink focus:border-gold-strong focus:outline-none"
        >
          {children}
        </select>
        <ChevronsUpDown
          aria-hidden="true"
          size={18}
          className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-ink-muted"
        />
      </div>
    </div>
  );
}

export function PublicTalentsPage({
  locale,
  initialSearch,
}: {
  locale: string;
  initialSearch: Record<string, string | string[] | undefined>;
}) {
  const t = useTranslations('publicTalent');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();

  const [draft, setDraft] = useState<PublicTalentSearch>(() => parseTalentSearch(initialSearch));
  const [applied, setApplied] = useState<PublicTalentSearch>(() => parseTalentSearch(initialSearch));
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [pageIdx, setPageIdx] = useState(0);

  const apply = (search: PublicTalentSearch) => {
    setApplied(search);
    setCursors([undefined]);
    setPageIdx(0);
    router.replace(`${pathname}${toTalentSearchString(search)}`);
  };

  useEffect(() => {
    if (draft.q === applied.q) return;
    const timer = setTimeout(() => apply(draft), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, applied]);

  const update = (patch: Partial<PublicTalentSearch>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (patch.q === undefined) apply(next);
  };

  const reset = () => {
    setDraft(EMPTY_SEARCH);
    apply(EMPTY_SEARCH);
  };

  const filters = useMemo(() => toTalentFilters(applied, cursors[pageIdx]), [applied, cursors, pageIdx]);
  const talentsQuery = usePublicTalentsQuery(filters);
  const skillsQuery = usePublicTalentSkillsQuery();
  const wilayasQuery = usePublicTalentWilayasQuery();
  const categoriesQuery = usePublicTalentCategoriesQuery();
  // An out-of-whitelist sort is refused before a request is sent.
  const sortRejected = !buildTalentsQuery(filters).ok;

  const skillOptions = useMemo(() => {
    const out: { id: string; label: string }[] = [];
    for (const skill of skillsQuery.data ?? []) {
      const id = skill.skillId ?? skill.id ?? skill._id;
      if (!id) continue;
      out.push({
        id,
        label:
          locale === 'ar'
            ? (skill.nameAr ?? skill.nameFr ?? skill.name ?? id)
            : (skill.nameFr ?? skill.nameAr ?? skill.name ?? id),
      });
    }
    return out;
  }, [skillsQuery.data, locale]);

  const wilayaOptions = useMemo(() => {
    const out: { code: string; label: string }[] = [];
    for (const wilaya of wilayasQuery.data ?? []) {
      const code = wilaya.code ?? wilaya.id ?? wilaya._id;
      if (!code) continue;
      const name =
        locale === 'ar'
          ? (wilaya.nameAr ?? wilaya.nameFr ?? code)
          : (wilaya.nameFr ?? wilaya.nameAr ?? code);
      out.push({ code, label: `${name} (${code})` });
    }
    return out;
  }, [wilayasQuery.data, locale]);

  const categoryOptions = useMemo(() => {
    const out: { id: string; label: string }[] = [];
    for (const category of categoriesQuery.data ?? []) {
      const id = category.id ?? category._id;
      if (!id) continue;
      out.push({
        id,
        label:
          locale === 'ar'
            ? (category.nameAr ?? category.nameFr ?? category.name ?? id)
            : (category.nameFr ?? category.nameAr ?? category.name ?? id),
      });
    }
    return out;
  }, [categoriesQuery.data, locale]);

  const wilayaNameOf = (wilayaId: string | undefined): string | null => {
    if (!wilayaId) return null;
    return wilayaOptions.find((w) => w.code === wilayaId)?.label ?? wilayaId;
  };

  const items = talentsQuery.data?.items ?? [];
  const total = talentsQuery.data?.total ?? 0;
  const pages = talentsQuery.data?.pages ?? pageIdx + 1;
  const visitedPages = cursors.length;
  const pageCount = Math.max(pages, visitedPages);
  const from = total === 0 ? 0 : pageIdx * PAGE_LIMIT + 1;
  const to = pageIdx * PAGE_LIMIT + items.length;
  const wilayaCount =
    (talentsQuery.data?.facets?.wilayas.length ?? 0) > 0
      ? (talentsQuery.data?.facets?.wilayas.length ?? 0)
      : new Set(items.map((item) => item.location?.wilayaId).filter(Boolean)).size;

  const goToPage = (target: number) => {
    const current = pageIdx + 1;
    if (target === current) return;
    if (target < current) {
      setCursors((c) => c.slice(0, target));
      setPageIdx(target - 1);
    } else if (target === current + 1 && talentsQuery.data?.nextCursor) {
      setCursors((c) => [...c, talentsQuery.data?.nextCursor ?? undefined]);
      setPageIdx((i) => i + 1);
    }
  };

  return (
    <Container testId="public-talents" className="flex flex-col gap-6 py-4">
      <header className="flex flex-col gap-3 pb-2">
        <nav aria-label={t('discover.breadcrumb')} className="flex items-center gap-2 text-sm text-ink-muted">
          <Link href="/" className="transition-colors hover:text-ink">
            {tCommon('nav.home')}
          </Link>
          <span aria-hidden="true" className="text-border">
            /
          </span>
          <span aria-current="page" className="font-medium text-ink">
            {t('discover.title')}
          </span>
        </nav>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{t('discover.title')}</h1>
          <span dir="rtl" className="text-base font-normal text-ink-muted">
            {t('discover.subtitle')}
          </span>
        </div>
        <p className="max-w-4xl text-sm leading-relaxed text-ink-muted">{t('discover.intro')}</p>
        <p data-testid="public-talents-count" role="status" className="flex items-center gap-2 pt-1 text-sm text-ink-muted">
          <Users aria-hidden="true" size={16} className="shrink-0" />
          {t.rich('discover.statLine', {
            sem: (chunks) => <span className="font-semibold text-ink">{chunks}</span>,
            count: total,
            wilayas: wilayaCount,
          })}
        </p>
      </header>

      <section
        aria-label={t('discover.title')}
        className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-4 shadow-sm"
      >
        <div className="relative w-full">
          <Search
            aria-hidden="true"
            size={20}
            className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            id="public-talent-q"
            type="text"
            aria-label={t('discover.searchLabel')}
            placeholder={t('discover.searchPlaceholder')}
            value={draft.q}
            onChange={(event) => setDraft((d) => ({ ...d, q: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                apply(draft);
              }
            }}
            className="h-11 w-full rounded-lg border border-border bg-surface pe-4 ps-11 text-sm text-ink transition-colors placeholder:text-ink-muted focus:border-gold-strong focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            id="public-talent-skill"
            label={t('discover.skillLabel')}
            icon={<Wrench aria-hidden="true" size={14} />}
            value={draft.skillId}
            onChange={(skillId) => update({ skillId })}
          >
            <option value="">{t('discover.allSkills')}</option>
            {skillOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            id="public-talent-wilaya"
            label={t('discover.wilayaLabel')}
            icon={<MapPin aria-hidden="true" size={14} />}
            value={draft.wilayaId}
            onChange={(wilayaId) => update({ wilayaId })}
          >
            <option value="">{t('discover.allWilayas')}</option>
            {wilayaOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            id="public-talent-domain"
            label={t('discover.domainLabel')}
            icon={<Layers aria-hidden="true" size={14} />}
            value={draft.categoryId}
            onChange={(categoryId) => update({ categoryId })}
          >
            <option value="">{t('discover.allDomains')}</option>
            {categoryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            id="public-talent-sort"
            label={t('discover.sortLabel')}
            icon={<ArrowUpDown aria-hidden="true" size={14} />}
            value={draft.sort}
            onChange={(sort) => update({ sort })}
          >
            <option value="newest">{t('discover.sortRecent')}</option>
            <option value="experiences_desc">{t('directory.sortExperienced')}</option>
            <option value="oldest">{t('directory.sortOldest')}</option>
          </FilterSelect>
        </div>
        <div className="flex items-center justify-end border-t border-border pt-1">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            <RotateCcw aria-hidden="true" size={16} />
            {t('discover.resetFilters')}
          </button>
        </div>
      </section>

      {sortRejected ? (
        <Empty
          title={t('directory.invalidSortTitle')}
          description={t('directory.invalidSortBody')}
          action={
            <Button type="button" variant="secondary" size="sm" onClick={reset}>
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
      ) : items.length === 0 ? (
        <div
          data-testid="public-talents-empty"
          className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-12 text-center"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
            <SearchX aria-hidden="true" size={24} />
          </div>
          <h3 className="mb-1 text-base font-semibold text-ink">{t('discover.emptyTitle')}</h3>
          <p className="mb-5 max-w-md text-sm text-ink-muted">{t('discover.emptyBody')}</p>
          <Button type="button" variant="primary" size="md" onClick={reset}>
            <RotateCcw aria-hidden="true" size={18} />
            {t('discover.resetAndShowAll')}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            {items.map((item) => (
              <PublicTalentCard
                key={item.username}
                item={item}
                locale={locale}
                wilayaLabel={wilayaNameOf(item.location?.wilayaId)}
              />
            ))}
          </div>
          <div className="flex flex-col items-center justify-between gap-4 border-t border-border py-2 sm:flex-row">
            <p className="text-sm text-ink-muted">
              {t('discover.pageStatus', { from, to, total })}
            </p>
            <nav aria-label={t('discover.pagination')} className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pageIdx === 0}
                onClick={() => goToPage(pageIdx)}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm text-ink-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft aria-hidden="true" size={16} className="rtl:rotate-180" />
                {t('directory.previous')}
              </button>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => {
                const visited = page <= visitedPages;
                const current = page === pageIdx + 1;
                return (
                  <button
                    key={page}
                    type="button"
                    disabled={!visited}
                    onClick={() => goToPage(page)}
                    aria-current={current ? 'page' : undefined}
                    className={`flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                      current
                        ? 'bg-primary font-semibold text-on-primary'
                        : 'border border-border bg-surface text-ink hover:bg-surface-muted disabled:opacity-50'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={!talentsQuery.data?.nextCursor}
                onClick={() => goToPage(pageIdx + 2)}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('directory.next')}
                <ChevronRight aria-hidden="true" size={16} className="rtl:rotate-180" />
              </button>
            </nav>
          </div>
        </>
      )}

      <aside className="mt-2 w-full rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-muted text-gold-strong">
              <Landmark aria-hidden="true" size={26} />
            </div>
            <div className="flex max-w-2xl flex-col gap-1">
              <h2 className="text-base font-semibold tracking-tight text-ink">
                {t('discover.orgCtaTitle')}
              </h2>
              <p className="text-sm leading-relaxed text-ink-muted">{t('discover.orgCtaBody')}</p>
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-wrap items-center gap-3 lg:w-auto">
            <Link
              href="/create-account?type=organization"
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover lg:flex-none"
            >
              <BadgeCheck aria-hidden="true" size={18} />
              {t('discover.registerOrganization')}
            </Link>
            <Link
              href="/login"
              className="inline-flex h-10 flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-muted lg:flex-none"
            >
              {t('discover.signInToAccount')}
            </Link>
          </div>
        </div>
      </aside>
    </Container>
  );
}
