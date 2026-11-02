'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  CalendarX,
  ChevronDown,
  Clock,
  Hourglass,
  MapPin,
  MonitorSmartphone,
  RotateCcw,
  Search,
  SearchX,
  Shapes,
  ShieldCheck,
  Sparkles,
  Tag,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Loader } from '@/components/ui/Loader';
import { Pagination } from '@/components/ui/Pagination';
import { Pill } from '@/components/ui/Pill';
import { useSessionQuery, getLoginHref } from '@/hooks/useSession';
import {
  usePublicOpportunitiesQuery,
  usePublicOpportunitiesSkillCategoriesQuery,
  usePublicOpportunitiesSkillsQuery,
  usePublicOpportunitiesWilayasQuery,
} from '@/hooks/usePublicOpportunities';
import {
  PUBLIC_OPP_SORTS,
  filterByMode,
  isPublicOrgVerified,
  parsePublicOppMode,
  publicHoursFromMinutes,
  publicLabelFor,
  publicLocationOf,
  publicOpenSeatsOf,
  publicOppSlugOf,
  publicOrgDisplayName,
  publicSkillLabelsOf,
  type PublicOpportunitiesParams,
  type PublicOppModeFilter,
  type PublicOpportunity,
} from '@/lib/api/publicOpportunities';

// Public opportunities list. Section order mirrors
// design/...Public Opportunities/code.html (header/counter, search + 4-filter
// toolbar, active-filter meta bar, article list, no-results + empty states,
// pagination footer, guest CTA band). Every value comes from the real backend
// (`GET /opportunities` + facet lookups) or is omitted when absent — no mock
// data, no invented fields.
//
// Backend notes (verified against OpportunityFeedQueryDto + OPPORTUNITY_MODES):
// - Sent params: q, categoryId, skillId, wilayaId, sort, cursor, limit. The
//   feed accepts NO `mode` param, so Format narrows the served page client-side
//   on the real onsite|remote|hybrid enum (`filterByMode`).
// - Omitted controls from the design grid stay omitted: municipality, date
//   window, hasOpenPositions, nearMe (volunteer-session-gated, guest 401).
// - Sort is a functional addition in the meta-bar row (the design has no sort
//   control); options are exactly the server FEED_SORTS whitelist.
// - Pagination renders the served total/page/pages via the shared Prev/Next
//   primitive — page numbers are never invented (A-page).
//
// Icon map (code.html Material Symbol -> lucide-react, theme-token colors):
// search -> Search (ink-muted), expand_more -> ChevronDown (ink-muted),
// restart_alt -> RotateCcw (ink-muted), check_circle -> BadgeCheck
// (status-success), location_on -> MapPin (primary), mode inline ->
// MonitorSmartphone (primary), calendar_today -> Calendar (primary),
// duration inline -> Hourglass (primary), alarm -> Clock (status-pending when
// closing, primary otherwise), category cell -> Tag (primary), skills row ->
// Sparkles (primary), verified_user -> ShieldCheck (primary),
// arrow_forward -> ArrowRight, manage_search -> SearchX, event_busy ->
// CalendarX. Filter selects carry a primary leading icon mirroring the search
// field; skills use Wrench (filter) / Shapes (category filter).

export interface PublicOpportunitiesFilters {
  q: string;
  categoryId: string;
  skillId: string;
  wilayaId: string;
  mode: PublicOppModeFilter;
  sort: string;
}

function asSingle(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export function parsePublicOpportunitiesSearch(
  search: Record<string, string | string[] | undefined>,
): PublicOpportunitiesFilters {
  const sort = asSingle(search.sort);
  return {
    q: asSingle(search.q),
    categoryId: asSingle(search.categoryId ?? search.categoryIds),
    skillId: asSingle(search.skillId ?? search.skillIds),
    wilayaId: asSingle(search.wilayaId ?? search.wilayaIds),
    mode: parsePublicOppMode(asSingle(search.mode)),
    sort: (PUBLIC_OPP_SORTS as readonly string[]).includes(sort) ? sort : '',
  };
}

export function toPublicOpportunitiesSearchString(filters: PublicOpportunitiesFilters): string {
  const params = new URLSearchParams();
  const set = (key: string, value: string) => {
    if (value !== '') params.set(key, value);
  };
  set('q', filters.q.trim());
  set('categoryId', filters.categoryId);
  set('skillId', filters.skillId);
  set('wilayaId', filters.wilayaId);
  if (filters.mode !== 'all') params.set('mode', filters.mode);
  set('sort', filters.sort);
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

function toFeedParams(
  filters: PublicOpportunitiesFilters,
  cursor?: string,
): PublicOpportunitiesParams {
  return {
    q: filters.q.trim() || undefined,
    categoryIds: filters.categoryId !== '' ? [filters.categoryId] : undefined,
    skillIds: filters.skillId !== '' ? [filters.skillId] : undefined,
    wilayaIds: filters.wilayaId !== '' ? [filters.wilayaId] : undefined,
    sort: (filters.sort as PublicOpportunitiesParams['sort']) || undefined,
    cursor,
    limit: 12,
  };
}

function facetLabel(
  option: { id?: string; _id?: string; code?: string; nameFr?: string; nameAr?: string; name?: string },
  locale: string,
): string {
  if (locale === 'ar') return option.nameAr ?? option.nameFr ?? option.name ?? option.code ?? '';
  return option.nameFr ?? option.nameAr ?? option.name ?? option.code ?? '';
}

function facetValue(option: { id?: string; _id?: string; code?: string }): string {
  return option.id ?? option._id ?? option.code ?? '';
}

const EMPTY_FILTERS: PublicOpportunitiesFilters = {
  q: '',
  categoryId: '',
  skillId: '',
  wilayaId: '',
  mode: 'all',
  sort: '',
};

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '';
  return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-DZ' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function daysUntil(deadline: string | null | undefined, now: number): number | null {
  if (!deadline) return null;
  const time = new Date(deadline).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.ceil((time - now) / 86_400_000);
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  allLabel,
  options,
  icon: Icon,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
  icon: LucideIcon;
}) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon
        aria-hidden="true"
        size={18}
        className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-gold-strong"
      />
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full cursor-pointer appearance-none rounded-md border border-border bg-surface pe-8 ps-9 text-label-sm text-ink transition-colors focus:border-gold-strong focus:outline-none"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        size={18}
        className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
}

function OpportunityArticle({
  locale,
  item,
  featured,
}: {
  locale: string;
  item: PublicOpportunity;
  featured: boolean;
}) {
  const t = useTranslations('publicOrgs');
  const now = useMemo(() => Date.now(), []);
  const slug = publicOppSlugOf(item);
  const detailHref = slug !== '' ? `/opportunities/${slug}` : '/opportunities';
  const orgName = publicOrgDisplayName(item.organization, locale);
  const verified = isPublicOrgVerified(item.organization);
  const location = publicLocationOf(item, locale);
  const modeLabel =
    item.mode === 'onsite'
      ? t('oppsList.modeOnsite')
      : item.mode === 'remote'
        ? t('oppsList.modeRemote')
        : item.mode === 'hybrid'
          ? t('oppsList.modeHybrid')
          : null;
  const locationLine =
    location && modeLabel
      ? `${location} · ${modeLabel}`
      : (location ?? modeLabel ?? null);
  const hours = publicHoursFromMinutes(item.durationMinutes ?? null);
  const start = formatDate(item.startDate, locale);
  const end = formatDate(item.endDate, locale);
  const range = start !== '' && end !== '' && start !== end ? `${start} – ${end}` : (start || end || '');
  const hoursLine = hours !== null ? t('landing.hours', { hours }) : null;
  const dateLine = range !== '' && hoursLine ? `${range} · ${hoursLine}` : (range || hoursLine);
  const left = daysUntil(item.applicationDeadline, now);
  const closing = left !== null && left >= 0 && left <= 7;
  const deadlineLine =
    left !== null && left >= 0 && left <= 30
      ? t('oppsList.deadlineLeft', { date: formatDate(item.applicationDeadline, locale), days: left })
      : item.applicationDeadline
        ? t('opps.deadline', { date: formatDate(item.applicationDeadline, locale) })
        : null;
  const seats = publicOpenSeatsOf(item);
  const skills = publicSkillLabelsOf(item, locale);
  const category = publicLabelFor(item.categoryName, locale);

  return (
    <article
      data-testid="opp-list-card"
      className="border-b border-border-muted p-6 transition-colors last:border-b-0 hover:bg-surface-muted/60"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex flex-wrap items-center gap-x-2 text-label-sm text-ink-muted">
            {orgName ? <span className="font-semibold text-ink">{orgName}</span> : null}
            {verified ? (
              <span className="inline-flex items-center gap-1 font-medium text-status-success">
                <BadgeCheck aria-hidden="true" size={14} />
                <span>{t('landing.verifiedBadge')}</span>
              </span>
            ) : null}
            {location ? (
              <>
                <span aria-hidden="true" className="text-border">
                  •
                </span>
                <span>{location}</span>
              </>
            ) : null}
          </p>
          {seats ? (
            <Pill tone={closing ? 'pending' : 'success'}>
              {closing
                ? t('oppsList.seatsClosing', { open: seats.open, total: seats.total })
                : t('oppsList.seatsOpen', { open: seats.open, total: seats.total })}
            </Pill>
          ) : (
            <Pill tone="success">{t('oppsList.statusOpen')}</Pill>
          )}
        </div>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div className="flex-1">
            <h2 className="text-title-lg font-semibold text-ink">
              <Link href={detailHref} className="transition-colors hover:text-gold-strong">
                {item.title ?? slug}
              </Link>
            </h2>
            {item.description ? (
              <p className="mt-1.5 text-body-md leading-relaxed text-ink-muted">{item.description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center md:pt-1">
            <Link
              href={detailHref}
              data-testid="opp-view-cta"
              className={
                featured
                  ? 'inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-label-md font-medium text-on-primary shadow-sm transition-colors hover:bg-primary-hover'
                  : 'inline-flex items-center gap-1 rounded-md border border-border bg-surface px-4 py-2 text-label-md font-medium text-ink transition-colors hover:bg-surface-muted'
              }
            >
              <span>{t('oppsList.viewCta')}</span>
              <ArrowRight aria-hidden="true" size={18} className="rtl:rotate-180" />
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 pt-2 text-body-sm text-ink-muted sm:grid-cols-2 lg:grid-cols-4">
          {locationLine ? (
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              {location ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin aria-hidden="true" size={18} className="shrink-0 text-gold-strong" />
                  <span>{location}</span>
                </span>
              ) : null}
              {location && modeLabel ? (
                <span aria-hidden="true" className="text-border">
                  •
                </span>
              ) : null}
              {modeLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <MonitorSmartphone
                    aria-hidden="true"
                    size={16}
                    className="shrink-0 text-gold-strong"
                  />
                  <span>{modeLabel}</span>
                </span>
              ) : null}
            </p>
          ) : null}
          {dateLine ? (
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              {range !== '' ? (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar aria-hidden="true" size={18} className="shrink-0 text-gold-strong" />
                  <span>{range}</span>
                </span>
              ) : null}
              {range !== '' && hoursLine ? (
                <span aria-hidden="true" className="text-border">
                  •
                </span>
              ) : null}
              {hoursLine ? (
                <span className="inline-flex items-center gap-1.5">
                  <Hourglass aria-hidden="true" size={16} className="shrink-0 text-gold-strong" />
                  <span>{hoursLine}</span>
                </span>
              ) : null}
            </p>
          ) : null}
          {deadlineLine ? (
            <p className="flex items-center gap-1.5">
              <Clock
                aria-hidden="true"
                size={18}
                className={closing ? 'shrink-0 text-status-pending' : 'shrink-0 text-gold-strong'}
              />
              <span className={closing ? 'font-medium text-status-pending' : undefined}>{deadlineLine}</span>
            </p>
          ) : null}
          {category ? (
            <p className="flex items-center gap-1.5">
              <Tag aria-hidden="true" size={18} className="shrink-0 text-gold-strong" />
              <span>{category}</span>
            </p>
          ) : null}
        </div>
        {skills.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Sparkles aria-hidden="true" size={14} className="shrink-0 text-gold-strong" />
            <span className="me-1 text-label-xs uppercase tracking-wider text-ink-muted">
              {t('oppsList.skillsLabel')}
            </span>
            {skills.map((skill) => (
              <Pill key={skill} tone="neutral">
                {skill}
              </Pill>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function PublicOpportunitiesPage({
  locale,
  initialSearch,
}: {
  locale: string;
  initialSearch: Record<string, string | string[] | undefined>;
}) {
  const t = useTranslations('publicOrgs');
  const router = useRouter();
  const pathname = usePathname();
  const session = useSessionQuery();

  const [filters, setFilters] = useState<PublicOpportunitiesFilters>(() =>
    parsePublicOpportunitiesSearch(initialSearch),
  );
  const [qDraft, setQDraft] = useState(filters.q);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [pageIdx, setPageIdx] = useState(0);

  // Search commits on a short debounce; selects commit immediately. No extra
  // submit button — the design toolbar has none.
  useEffect(() => {
    const handle = setTimeout(() => {
      const committed = qDraft.trim();
      setFilters((prev) => (prev.q === committed ? prev : { ...prev, q: committed }));
    }, 400);
    return () => clearTimeout(handle);
  }, [qDraft]);

  // Shareable URL stays in sync with applied filters; cursors reset.
  useEffect(() => {
    router.replace(`${pathname}${toPublicOpportunitiesSearchString(filters)}`);
    setCursors([undefined]);
    setPageIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const feedParams = useMemo(
    () => toFeedParams(filters, cursors[pageIdx]),
    [filters, cursors, pageIdx],
  );
  const feedQuery = usePublicOpportunitiesQuery(feedParams);
  const categoriesQuery = usePublicOpportunitiesSkillCategoriesQuery();
  const skillsQuery = usePublicOpportunitiesSkillsQuery();
  const wilayasQuery = usePublicOpportunitiesWilayasQuery();

  const update = (patch: Partial<PublicOpportunitiesFilters>) =>
    setFilters((prev) => ({ ...prev, ...patch }));

  const reset = () => {
    setQDraft('');
    setFilters(EMPTY_FILTERS);
  };

  const modeOptions = useMemo(
    () => [
      { value: 'onsite', label: t('oppsList.modeOnsite') },
      { value: 'remote', label: t('oppsList.modeRemote') },
      { value: 'hybrid', label: t('oppsList.modeHybrid') },
    ],
    [t],
  );
  const sortOptions = useMemo(
    () => [
      { value: 'newest', label: t('oppsList.sortNewest') },
      { value: 'oldest', label: t('oppsList.sortOldest') },
      { value: 'deadline_asc', label: t('oppsList.sortDeadline') },
      { value: 'startDate_asc', label: t('oppsList.sortStartDate') },
    ],
    [t],
  );

  const total = feedQuery.data?.total ?? 0;
  const served = useMemo(
    () => feedQuery.data?.items ?? [],
    [feedQuery.data],
  );
  const visible = useMemo(() => filterByMode(served, filters.mode), [served, filters.mode]);
  const filtersActive =
    filters.q.trim() !== '' ||
    filters.categoryId !== '' ||
    filters.skillId !== '' ||
    filters.wilayaId !== '' ||
    filters.mode !== 'all' ||
    filters.sort !== '';
  const showSystemEmpty = feedQuery.isSuccess && total === 0 && !filtersActive;
  const showNoResults = feedQuery.isSuccess && !showSystemEmpty && visible.length === 0;

  const page = feedQuery.data?.page ?? pageIdx + 1;
  const pages = feedQuery.data?.pages ?? pageIdx + 1;
  const rangeFrom = total === 0 ? 0 : pageIdx * 12 + 1;
  const rangeTo = Math.min(pageIdx * 12 + visible.length, total);

  const modeChipLabel =
    filters.mode === 'all'
      ? t('oppsList.formatAllChip')
      : t('oppsList.formatChip', {
          mode:
            filters.mode === 'onsite'
              ? t('oppsList.modeOnsite')
              : filters.mode === 'remote'
                ? t('oppsList.modeRemote')
                : t('oppsList.modeHybrid'),
        });

  // Guest Apply gate: the band renders for guests only (established
  // guest → Login pattern); `next` carries the exact filtered list URL.
  const next = `/opportunities${toPublicOpportunitiesSearchString(filters)}`;

  return (
    <Container testId="public-opportunities" className="py-8">
      {/* 1. Header area + live counter */}
      <section data-section="header" className="mb-6 flex flex-col justify-between gap-6 border-b border-border-muted pb-6 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <p className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded bg-gold-soft px-2 py-0.5 text-label-xs font-semibold uppercase tracking-wider text-gold-strong">
              {t('oppsList.eyebrowBadge')}
            </span>
            <span className="text-label-xs text-ink-muted">{t('oppsList.eyebrowNote')}</span>
          </p>
          <h1 className="text-headline-lg font-semibold tracking-tight text-ink">
            {t('oppsList.title')}
          </h1>
          <p className="mt-2 text-body-md text-ink-muted">{t('oppsList.subtitle')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-md border border-border-muted bg-surface-muted px-4 py-2">
          <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-status-success" />
          <span data-testid="opp-list-counter" role="status" className="text-label-sm font-medium text-ink">
            {t('oppsList.countBanner', { shown: visible.length, total })}
          </span>
        </div>
      </section>

      {/* 2. Search + filter toolbar */}
      <section data-section="filters" className="mb-6 rounded-lg border border-border-muted bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="relative w-full">
            <Search
              aria-hidden="true"
              size={20}
              className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <label htmlFor="opp-list-search" className="sr-only">
              {t('oppsList.searchLabel')}
            </label>
            <input
              id="opp-list-search"
              type="text"
              value={qDraft}
              onChange={(event) => setQDraft(event.target.value)}
              placeholder={t('oppsList.searchPlaceholder')}
              className="h-10 w-full rounded-md border border-border bg-surface-muted/60 py-2 pe-4 ps-11 text-body-sm text-ink transition-colors placeholder:text-ink-muted focus:border-gold-strong focus:bg-surface focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              id="opp-list-wilaya"
              label={t('oppsList.wilayaLabel')}
              value={filters.wilayaId}
              onChange={(value) => update({ wilayaId: value })}
              allLabel={t('oppsList.wilayaAll')}
              icon={MapPin}
              options={(wilayasQuery.data ?? []).map((w) => ({
                value: facetValue(w),
                label: facetLabel(w, locale),
              }))}
            />
            <FilterSelect
              id="opp-list-category"
              label={t('oppsList.categoryLabel')}
              value={filters.categoryId}
              onChange={(value) => update({ categoryId: value })}
              allLabel={t('oppsList.categoryAll')}
              icon={Shapes}
              options={(categoriesQuery.data ?? []).map((c) => ({
                value: facetValue(c),
                label: facetLabel(c, locale),
              }))}
            />
            <FilterSelect
              id="opp-list-skill"
              label={t('oppsList.skillLabel')}
              value={filters.skillId}
              onChange={(value) => update({ skillId: value })}
              allLabel={t('oppsList.skillAny')}
              icon={Wrench}
              options={(skillsQuery.data ?? []).map((s) => ({
                value: facetValue(s),
                label: facetLabel(s, locale),
              }))}
            />
            <FilterSelect
              id="opp-list-mode"
              label={t('oppsList.modeLabel')}
              value={filters.mode === 'all' ? '' : filters.mode}
              onChange={(value) =>
                update({ mode: value === '' ? 'all' : parsePublicOppMode(value) })
              }
              allLabel={t('oppsList.modeAll')}
              icon={MonitorSmartphone}
              options={modeOptions}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-muted pt-2">
            <div className="flex flex-wrap items-center gap-1.5 text-label-sm text-ink-muted">
              <span className="font-medium">{t('oppsList.activeParams')}</span>
              <span className="inline-flex items-center gap-1 rounded-md border border-status-success/30 bg-status-success/10 px-2 py-0.5 text-status-success">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-status-success" />
                {t('oppsList.statusChip')}
              </span>
              <span className="inline-flex items-center rounded-md border border-border-muted bg-surface-muted px-2 py-0.5">
                {modeChipLabel}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <label htmlFor="opp-list-sort" className="sr-only">
                  {t('oppsList.sortLabel')}
                </label>
                <select
                  id="opp-list-sort"
                  value={filters.sort}
                  onChange={(event) => update({ sort: event.target.value })}
                  className="h-8 cursor-pointer appearance-none rounded-md border border-border bg-surface pe-7 ps-2 text-label-sm text-ink transition-colors focus:border-gold-strong focus:outline-none"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  size={14}
                  className="pointer-events-none absolute end-1.5 top-1/2 -translate-y-1/2 text-ink-muted"
                />
              </div>
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1 text-label-sm text-ink-muted transition-colors hover:text-ink"
              >
                <RotateCcw aria-hidden="true" size={16} />
                {t('oppsList.resetFilters')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3-5. List / no-results / empty */}
      {feedQuery.isPending ? (
        <Loader label={t('shared.loading')} />
      ) : feedQuery.isError ? (
        <div className="flex flex-col items-start gap-2">
          <p data-testid="opp-list-error" role="alert" className="text-sm text-status-error">
            {t('shared.loadError')}
          </p>
          <Button variant="secondary" onClick={() => feedQuery.refetch()}>
            {t('shared.retry')}
          </Button>
        </div>
      ) : showSystemEmpty ? (
        <section
          data-section="empty"
          className="flex flex-col items-center justify-center rounded-lg border border-border-muted bg-surface p-8 text-center shadow-sm"
        >
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
            <CalendarX aria-hidden="true" size={26} />
          </div>
          <h3 className="text-headline-md font-semibold text-ink">{t('oppsList.emptyTitle')}</h3>
          <p className="mb-4 mt-1 max-w-lg text-body-md text-ink-muted">{t('oppsList.emptyBody')}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/create-account"
              className="rounded-md bg-surface-muted px-4 py-2 text-label-md font-medium text-ink transition-colors hover:bg-border-muted"
            >
              {t('oppsList.emptyRegister')}
            </Link>
            <button
              type="button"
              onClick={reset}
              className="rounded-md bg-primary px-4 py-2 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-hover"
            >
              {t('oppsList.emptyBrowseAll')}
            </button>
          </div>
        </section>
      ) : showNoResults ? (
        <section
          data-section="no-results"
          className="flex flex-col items-center justify-center rounded-lg border border-border-muted bg-surface p-8 text-center shadow-sm"
        >
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
            <SearchX aria-hidden="true" size={26} />
          </div>
          <h3 className="text-headline-md font-semibold text-ink">{t('oppsList.noResultsTitle')}</h3>
          <p className="mb-4 mt-1 max-w-md text-body-md text-ink-muted">{t('oppsList.noResultsBody')}</p>
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-primary px-4 py-2 text-label-md font-medium text-on-primary transition-colors hover:bg-primary-hover"
          >
            {t('oppsList.resetAll')}
          </button>
        </section>
      ) : (
        <>
          <section
            data-section="list"
            className="flex flex-col overflow-hidden rounded-lg border border-border-muted bg-surface shadow-sm"
          >
            {visible.map((item, index) => (
              <OpportunityArticle
                key={item._id ?? item.id ?? index}
                locale={locale}
                item={item}
                featured={index === 0}
              />
            ))}
          </section>

          {/* 6. Pagination footer (served numbers only — never invented) */}
          <section
            data-section="pagination"
            className="mt-6 flex flex-col items-center justify-between gap-4 text-label-sm text-ink-muted sm:flex-row"
          >
            <span data-testid="opp-list-range" role="status">
              {t('oppsList.showingRange', { from: rangeFrom, to: rangeTo, total })}
            </span>
            <Pagination
              page={page}
              pages={pages}
              statusText={t('oppsList.pageStatus', { page, pages })}
              previousLabel={t('shared.previous')}
              nextLabel={t('shared.next')}
              onPage={(target) => {
                const current = page;
                if (target < current && pageIdx > 0) {
                  setCursors((c) => c.slice(0, -1));
                  setPageIdx((i) => i - 1);
                } else if (target > current && feedQuery.data?.nextCursor) {
                  setCursors((c) => [...c, feedQuery.data?.nextCursor ?? undefined]);
                  setPageIdx((i) => i + 1);
                }
              }}
            />
          </section>
        </>
      )}

      {/* 7. Guest CTA band (guests only; copy verified neutral) */}
      {!session.data ? (
        <section
          data-section="cta-band"
          className="mt-6 flex flex-col items-center justify-between gap-6 rounded-lg border border-border-muted bg-surface-muted p-6 md:flex-row"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gold-soft text-gold-strong">
              <ShieldCheck aria-hidden="true" size={24} />
            </div>
            <div>
              <h4 className="text-title-md font-semibold text-ink">{t('oppsList.ctaTitle')}</h4>
              <p className="mt-0.5 text-body-sm text-ink-muted">{t('oppsList.ctaBody')}</p>
            </div>
          </div>
          <div className="flex w-full shrink-0 items-center gap-2 md:w-auto">
            <Link
              href={getLoginHref(next)}
              className="flex-1 rounded-md border border-border bg-surface px-4 py-2 text-center text-label-md font-medium text-ink transition-colors hover:bg-surface-muted md:flex-none"
            >
              {t('oppsList.ctaSignIn')}
            </Link>
            <Link
              href="/create-account"
              className="flex-1 rounded-md bg-primary px-4 py-2 text-center text-label-md font-medium text-on-primary shadow-sm transition-colors hover:bg-primary-hover md:flex-none"
            >
              {t('oppsList.ctaCreate')}
            </Link>
          </div>
        </section>
      ) : null}
    </Container>
  );
}
