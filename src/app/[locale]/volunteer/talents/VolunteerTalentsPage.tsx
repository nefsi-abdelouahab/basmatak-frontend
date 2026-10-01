'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ChevronDown,
  Clock,
  Info,
  MapPin,
  RotateCcw,
  Search,
  SearchX,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { Pagination } from '@/components/ui/Pagination';
import {
  useFeedSkillsQuery,
  useFeedWilayasQuery,
  useTalentsQuery,
} from '@/hooks/useFeed';
import { useVolunteerMeQuery } from '@/hooks/useVolunteerAccount';
import type { TalentFeedParams } from '@/lib/api/feed';
import { SectionError } from '../components';
import { TalentCard } from './TalentCard';

// Authenticated Discover Talents page (code.html port). Filters apply
// immediately — every control writes the real `GET /talents` query params
// (q, skillIds, wilayaIds, minExperiences, hasAvailability, portfolio, sort)
// and the URL stays shareable. Facet counts come from the response `facets`
// (skills/wilayas of the filtered population); dimensions the API does not
// facet (availability/portfolio breakdowns) render with no counts, never
// invented ones.
export interface TalentFilters {
  q: string;
  skillIds: string[];
  wilayaIds: string[];
  minExperiences: string;
  hasAvailability: boolean;
  portfolio: boolean;
  sort: string;
}

const VALID_SORTS = ['experiences_desc', 'newest', 'oldest'] as const;
export const DEFAULT_TALENT_SORT = 'experiences_desc';

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
  const sort = asSingle(search.sort);
  return {
    q: asSingle(search.q),
    skillIds: asArray(search.skillIds ?? search.skillId),
    wilayaIds: asArray(search.wilayaIds ?? search.wilayaId),
    minExperiences: asSingle(search.minExperiences),
    hasAvailability: asSingle(search.hasAvailability) === 'true',
    portfolio: asSingle(search.portfolio) === 'true',
    sort: (VALID_SORTS as readonly string[]).includes(sort) ? sort : DEFAULT_TALENT_SORT,
  };
}

export function toTalentSearchString(filters: TalentFilters): string {
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

function toTalentParams(filters: TalentFilters, cursor?: string): TalentFeedParams {
  const min = Number.parseInt(filters.minExperiences, 10);
  return {
    q: filters.q.trim() || undefined,
    skillIds: filters.skillIds.length > 0 ? filters.skillIds : undefined,
    wilayaIds: filters.wilayaIds.length > 0 ? filters.wilayaIds : undefined,
    minExperiences: Number.isFinite(min) && min > 0 ? min : undefined,
    hasAvailability: filters.hasAvailability ? true : undefined,
    portfolio: filters.portfolio ? true : undefined,
    sort: (VALID_SORTS as readonly string[]).includes(filters.sort)
      ? (filters.sort as TalentFeedParams['sort'])
      : DEFAULT_TALENT_SORT,
    cursor,
    limit: 20,
  };
}

function facetLabel(option: { id?: string; _id?: string; code?: string; nameFr?: string; nameAr?: string; name?: string }, locale: string): string {
  if (locale === 'ar') return option.nameAr ?? option.nameFr ?? option.name ?? option.code ?? '';
  return option.nameFr ?? option.nameAr ?? option.name ?? option.code ?? '';
}

function facetValue(option: { id?: string; _id?: string; code?: string }): string {
  return option.id ?? option._id ?? option.code ?? '';
}

interface TalentFacets {
  skills?: { skillId: string; count: number }[];
  wilayas?: { wilayaId: string; count: number }[];
}

const EMPTY_TALENT_FILTERS: TalentFilters = {
  q: '',
  skillIds: [],
  wilayaIds: [],
  minExperiences: '',
  hasAvailability: false,
  portfolio: false,
  sort: DEFAULT_TALENT_SORT,
};

function isDefaultFilters(filters: TalentFilters): boolean {
  return (
    filters.q.trim() === '' &&
    filters.skillIds.length === 0 &&
    filters.wilayaIds.length === 0 &&
    filters.minExperiences === '' &&
    !filters.hasAvailability &&
    !filters.portfolio &&
    (filters.sort === '' || filters.sort === DEFAULT_TALENT_SORT)
  );
}

// Quick-filter rows for the refine panel: full-width rows (never pills or
// badges), icon before the label, active state in primary. They reuse the
// exact filter state/handlers of the former chip row.
function QuickFilter({
  active,
  onClick,
  Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  Icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
        active
          ? 'bg-primary/10 font-medium text-primary'
          : 'font-normal text-ink hover:bg-surface-muted'
      }`}
    >
      <Icon
        aria-hidden="true"
        size={16}
        className={`shrink-0 ${active ? 'text-primary' : 'text-ink-muted'}`}
      />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function FacetCheck({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  count: number | null;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 text-sm text-ink select-none">
      <span className="flex min-w-0 items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 shrink-0 rounded accent-primary"
        />
        <span className="min-w-0 truncate">{label}</span>
      </span>
      {typeof count === 'number' ? (
        <span className="shrink-0 text-xs text-ink-muted">{count}</span>
      ) : null}
    </label>
  );
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id];
}

interface FacetOptionView {
  value: string;
  label: string;
  count: number | null;
}

// The full refine-filter body (quick filters, skills, location,
// verification, availability). Rendered once in the desktop panel and once
// in the mobile drawer — same state, same handlers, no second system.
function RefineFilters({
  applied,
  isDefault,
  onPatch,
  onReset,
  skillOptions,
  visibleSkills,
  skillsExpanded,
  onToggleSkills,
  wilayaOptions,
  visibleWilayas,
  locationsExpanded,
  onToggleLocations,
  nearby,
  nearbyActive,
  verificationGroupName,
}: {
  applied: TalentFilters;
  isDefault: boolean;
  onPatch: (patch: Partial<TalentFilters>) => void;
  onReset: () => void;
  skillOptions: FacetOptionView[];
  visibleSkills: FacetOptionView[];
  skillsExpanded: boolean;
  onToggleSkills: () => void;
  wilayaOptions: FacetOptionView[];
  visibleWilayas: FacetOptionView[];
  locationsExpanded: boolean;
  onToggleLocations: () => void;
  nearby: { ids: string[]; label: string | null } | null;
  nearbyActive: boolean;
  verificationGroupName: string;
}) {
  const t = useTranslations('volunteerHome');
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <fieldset className="flex min-w-0 flex-col gap-1">
        <legend className="text-xs font-medium uppercase tracking-wider text-ink-muted">
          {t('talents.quickGroup')}
        </legend>
        <div className="mt-1 flex flex-col gap-1">
          <QuickFilter
            active={isDefault}
            onClick={onReset}
            Icon={Users}
            label={t('talents.chipAll')}
          />
          <QuickFilter
            active={applied.hasAvailability}
            onClick={() => onPatch({ hasAvailability: !applied.hasAvailability })}
            Icon={Clock}
            label={t('talents.chipAvailable')}
          />
          <QuickFilter
            active={applied.minExperiences === '1'}
            onClick={() =>
              onPatch({ minExperiences: applied.minExperiences === '1' ? '' : '1' })
            }
            Icon={ShieldCheck}
            label={t('talents.chipVerified')}
          />
          {nearby !== null && nearby.label !== null ? (
            <QuickFilter
              active={nearbyActive}
              onClick={() => onPatch({ wilayaIds: nearbyActive ? [] : nearby.ids })}
              Icon={MapPin}
              label={t('talents.chipNearbyPlace', { place: nearby.label })}
            />
          ) : null}
        </div>
      </fieldset>

      <div className="h-px w-full bg-border-muted" aria-hidden="true" />

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="text-xs font-medium uppercase tracking-wider text-ink-muted">
          {t('talents.skillsGroup')}
        </legend>
        <div className="mt-1 flex flex-col gap-2">
          {visibleSkills.map((option) => (
            <FacetCheck
              key={option.value}
              label={option.label}
              count={option.count}
              checked={applied.skillIds.includes(option.value)}
              onChange={() => onPatch({ skillIds: toggleId(applied.skillIds, option.value) })}
            />
          ))}
        </div>
        {skillOptions.length > 6 ? (
          <button
            type="button"
            onClick={onToggleSkills}
            className="self-start text-xs font-medium text-primary hover:underline"
          >
            {skillsExpanded
              ? t('talents.showLessSkills')
              : t('talents.showMoreSkills', { count: skillOptions.length - 6 })}
          </button>
        ) : null}
      </fieldset>

      <div className="h-px w-full bg-border-muted" aria-hidden="true" />

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="text-xs font-medium uppercase tracking-wider text-ink-muted">
          {t('talents.locationGroup')}
        </legend>
        <div className="mt-1 flex flex-col gap-2">
          {visibleWilayas.map((option) => (
            <FacetCheck
              key={option.value}
              label={option.label}
              count={option.count}
              checked={applied.wilayaIds.includes(option.value)}
              onChange={() => onPatch({ wilayaIds: toggleId(applied.wilayaIds, option.value) })}
            />
          ))}
        </div>
        {wilayaOptions.length > 8 ? (
          <button
            type="button"
            onClick={onToggleLocations}
            className="self-start text-xs font-medium text-primary hover:underline"
          >
            {locationsExpanded
              ? t('talents.showLessLocations')
              : t('talents.showMoreLocations', { count: wilayaOptions.length - 8 })}
          </button>
        ) : null}
      </fieldset>

      <div className="h-px w-full bg-border-muted" aria-hidden="true" />

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="text-xs font-medium uppercase tracking-wider text-ink-muted">
          {t('talents.verificationGroup')}
        </legend>
        <label className="mt-1 inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="radio"
            name={verificationGroupName}
            value=""
            checked={applied.minExperiences === ''}
            onChange={() => onPatch({ minExperiences: '' })}
            className="h-4 w-4 accent-primary"
          />
          {t('talents.verificationAny')}
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="radio"
            name={verificationGroupName}
            value="1"
            checked={applied.minExperiences === '1'}
            onChange={() => onPatch({ minExperiences: '1' })}
            className="h-4 w-4 accent-primary"
          />
          <span className="inline-flex items-center gap-1">
            {t('talents.verificationVerified')}
            <ShieldCheck aria-hidden="true" size={14} className="text-status-success" />
          </span>
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="radio"
            name={verificationGroupName}
            value="5"
            checked={applied.minExperiences === '5'}
            onChange={() => onPatch({ minExperiences: '5' })}
            className="h-4 w-4 accent-primary"
          />
          {t('talents.verificationExperienced')}
        </label>
      </fieldset>

      <div className="h-px w-full bg-border-muted" aria-hidden="true" />

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="text-xs font-medium uppercase tracking-wider text-ink-muted">
          {t('talents.availabilityGroup')}
        </legend>
        <label className="mt-1 inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={applied.hasAvailability}
            onChange={(e) => onPatch({ hasAvailability: e.target.checked })}
            className="h-4 w-4 rounded accent-primary"
          />
          {t('talents.hasAvailability')}
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={applied.portfolio}
            onChange={(e) => onPatch({ portfolio: e.target.checked })}
            className="h-4 w-4 rounded accent-primary"
          />
          {t('talents.portfolioOnly')}
        </label>
      </fieldset>
    </div>
  );
}

// Right-side filter sheet for below-xl screens: fixed overlay + panel
// docked to the inline-end side (right in LTR, left in RTL), internally
// scrollable, Escape/overlay/X to close, body scroll locked while open.
function FilterDrawer({
  onClose,
  title,
  closeLabel,
  children,
}: {
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 xl:hidden">
      <button
        type="button"
        data-testid="talents-filters-overlay"
        aria-label={closeLabel}
        onClick={onClose}
        className="animate-modal-overlay absolute inset-0 bg-ink/40"
      />
      <div
        data-testid="talents-filters-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-drawer-panel absolute inset-y-0 end-0 flex w-[min(85vw,24rem)] min-w-0 flex-col bg-surface shadow-modal"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-muted p-4">
          <h2 className="min-w-0 truncate text-base font-semibold text-ink">{title}</h2>
          <button
            type="button"
            data-testid="talents-filters-close"
            onClick={onClose}
            aria-label={closeLabel}
            autoFocus
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
      </div>
    </div>
  );
}

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

  const [applied, setApplied] = useState<TalentFilters>(() => parseTalentSearch(initialSearch));
  const [queryText, setQueryText] = useState(() => parseTalentSearch(initialSearch).q);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [pageIdx, setPageIdx] = useState(0);
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const [locationsExpanded, setLocationsExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const talentParams = useMemo(() => toTalentParams(applied, cursors[pageIdx]), [applied, cursors, pageIdx]);
  const talentsQuery = useTalentsQuery(talentParams);

  const skillsQuery = useFeedSkillsQuery();
  const wilayasQuery = useFeedWilayasQuery();
  const meQuery = useVolunteerMeQuery();

  const apply = (filters: TalentFilters) => {
    setApplied(filters);
    setCursors([undefined]);
    setPageIdx(0);
    router.replace(`${pathname}${toTalentSearchString(filters)}`);
  };

  const resetAll = () => {
    setQueryText('');
    apply(EMPTY_TALENT_FILTERS);
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    apply({ ...applied, q: queryText });
  };

  const clearSearch = () => {
    setQueryText('');
    apply({ ...applied, q: '' });
  };

  const togglePatch = (patch: Partial<TalentFilters>) => {
    apply({ ...applied, ...patch });
  };

  // Real response facets (backend `talentFacets`): counts for the filtered
  // population, shown next to the matching facet options when present.
  const facets: TalentFacets | undefined = (
    talentsQuery.data as { facets?: TalentFacets } | undefined
  )?.facets;
  const skillCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of facets?.skills ?? []) map.set(row.skillId, row.count);
    return map;
  }, [facets]);
  const wilayaCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of facets?.wilayas ?? []) map.set(row.wilayaId, row.count);
    return map;
  }, [facets]);

  // Indexed by every identifier the catalog carries (id, _id, code):
  // talent cards reference the numeric code (e.g. "01") while other
  // callers use ids — all resolve to the same localized label.
  const wilayaNameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of wilayasQuery.data ?? []) {
      const label = facetLabel(w, locale);
      if (label === '') continue;
      for (const key of [w.id, w._id, w.code]) {
        if (typeof key === 'string' && key !== '' && !map.has(key)) map.set(key, label);
      }
    }
    return map;
  }, [wilayasQuery.data, locale]);

  // Skills: options with real facet counts first (count desc), then the rest
  // of the catalog without a count badge — never invented.
  const skillOptions = useMemo(() => {
    const options = (skillsQuery.data ?? []).map((s) => {
      const value = facetValue(s);
      const count = skillCounts.get(value);
      return { value, label: facetLabel(s, locale), count: count ?? null };
    });
    return options.sort((a, b) => (b.count ?? -1) - (a.count ?? -1));
  }, [skillsQuery.data, skillCounts, locale]);
  const visibleSkills = skillsExpanded ? skillOptions : skillOptions.slice(0, 6);

  // Locations: wilayas with real facet counts first (count desc), then the
  // rest of the catalog without a count badge.
  const wilayaOptions = useMemo(() => {
    const options = (wilayasQuery.data ?? []).map((w) => {
      const value = facetValue(w);
      const count = wilayaCounts.get(value);
      return { value, label: facetLabel(w, locale), count: count ?? null };
    });
    return options.sort((a, b) => (b.count ?? -1) - (a.count ?? -1));
  }, [wilayasQuery.data, wilayaCounts, locale]);
  const visibleWilayas = locationsExpanded ? wilayaOptions : wilayaOptions.slice(0, 8);

  // "Near {place}" resolves to a real wilaya id: the volunteer's own wilaya
  // first, falling back to a Timimoun/Adrar name match over the loaded
  // catalog (no hardcoded codes). Hidden when unresolvable.
  const nearby = useMemo(() => {
    const ownId = meQuery.data?.location?.wilayaId;
    if (typeof ownId === 'string' && ownId !== '') {
      const label = wilayaNameOf.get(ownId);
      if (label) return { ids: [ownId], label };
    }
    const ids: string[] = [];
    for (const w of wilayasQuery.data ?? []) {
      const haystack = [w.nameFr, w.nameAr, w.code, w.name].filter(Boolean).join(' ');
      if (/timimoun|adrar/i.test(haystack)) {
        const value = facetValue(w);
        if (value !== '' && !ids.includes(value)) ids.push(value);
      }
    }
    if (ids.length === 0) return null;
    const label = ids.map((id) => wilayaNameOf.get(id)).filter(Boolean).join(' & ');
    return { ids, label: label !== '' ? label : null };
  }, [meQuery.data?.location?.wilayaId, wilayaNameOf, wilayasQuery.data]);

  const nearbyActive =
    nearby !== null &&
    applied.wilayaIds.length > 0 &&
    applied.wilayaIds.every((id) => nearby.ids.includes(id));

  const total = talentsQuery.data?.total;

  // Below xl the refine panel becomes a right-side drawer: the 300px
  // panel plus the app sidebar leave the result list cramped under ~1280px.
  // Each surface gets its own radio group name so the two mounted copies
  // never share native browser group semantics (React state stays the
  // single source of truth for both).
  const renderRefineFilters = (verificationGroupName: string) => (
    <RefineFilters
      applied={applied}
      isDefault={isDefaultFilters(applied)}
      onPatch={togglePatch}
      onReset={resetAll}
      skillOptions={skillOptions}
      visibleSkills={visibleSkills}
      skillsExpanded={skillsExpanded}
      onToggleSkills={() => setSkillsExpanded((v) => !v)}
      wilayaOptions={wilayaOptions}
      visibleWilayas={visibleWilayas}
      locationsExpanded={locationsExpanded}
      onToggleLocations={() => setLocationsExpanded((v) => !v)}
      nearby={nearby}
      nearbyActive={nearbyActive}
      verificationGroupName={verificationGroupName}
    />
  );

  return (
    <div data-testid="volunteer-talents" className="min-w-0">
      <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* Center column: header, search, results */}
        <div className="flex w-full min-w-0 flex-col gap-4 sm:gap-6">
          <section
            data-testid="talents-filters"
            aria-label={t('talents.title')}
            className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6"
          >
            <div>
              <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                {t('talents.title')}
              </h1>
              <p className="mt-1 text-sm text-ink-muted">{t('talents.subtitle')}</p>
            </div>

            <form role="search" onSubmit={submitSearch} className="relative w-full">
              <Search
                aria-hidden="true"
                size={20}
                className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <label htmlFor="talent-q" className="sr-only">
                {t('talents.searchLabel')}
              </label>
              <input
                id="talent-q"
                type="text"
                placeholder={t('talents.searchPlaceholder')}
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                className="h-11 w-full rounded-lg bg-surface-muted pe-10 ps-11 text-sm text-ink transition-colors placeholder:text-ink-muted focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {queryText !== '' ? (
                <button
                  type="button"
                  aria-label={t('talents.clearSearch')}
                  onClick={clearSearch}
                  className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-muted transition-colors hover:text-ink"
                >
                  <X aria-hidden="true" size={16} />
                </button>
              ) : null}
            </form>

            <div className="flex items-center justify-end border-t border-border-muted pt-2">
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-primary"
              >
                <RotateCcw aria-hidden="true" size={16} />
                {t('talents.resetFilters')}
              </button>
            </div>
          </section>

          <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
            <p data-testid="talents-count" role="status" className="text-base font-semibold text-ink">
              {typeof total === 'number' ? t('talents.resultsCount', { total }) : null}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <label htmlFor="talent-sort" className="shrink-0 whitespace-nowrap text-sm text-ink-muted">
                  {t('talents.sortLabel')}:
                </label>
                <div className="relative min-w-0">
                  <select
                    id="talent-sort"
                    value={applied.sort}
                    onChange={(e) => togglePatch({ sort: e.target.value })}
                    className="max-w-full cursor-pointer appearance-none rounded-lg border border-border bg-surface py-1.5 pe-8 ps-2.5 text-sm text-ink shadow-sm focus:border-primary focus:outline-none"
                  >
                    <option value="experiences_desc">{t('talents.sortVerified')}</option>
                    <option value="newest">{t('talents.sortRecent')}</option>
                    <option value="oldest">{t('talents.sortOldest')}</option>
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    size={16}
                    className="pointer-events-none absolute end-1.5 top-1/2 -translate-y-1/2 text-ink-muted"
                  />
                </div>
                <span title={t('talents.sortHint')} className="inline-flex shrink-0 text-ink-muted">
                  <Info aria-hidden="true" size={16} />
                </span>
              </div>
              <button
                type="button"
                data-testid="talents-filters-open"
                aria-expanded={drawerOpen}
                aria-controls="talents-filters-drawer"
                onClick={() => setDrawerOpen(true)}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-surface-muted xl:hidden"
              >
                <SlidersHorizontal aria-hidden="true" size={16} />
                {t('talents.filtersTitle')}
              </button>
            </div>
          </div>

          {talentsQuery.isPending ? (
            <Loader label={t('shared.loading')} />
          ) : talentsQuery.isError ? (
            <SectionError testId="talents-error" message={t('shared.loadError')} />
          ) : talentsQuery.data.total === 0 ? (
            <div
              data-testid="talents-empty"
              className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-8 text-center shadow-sm sm:p-12"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
                <SearchX aria-hidden="true" size={24} />
              </div>
              <div className="flex max-w-md flex-col gap-1">
                <h3 className="text-base font-semibold text-ink">{t('talents.emptyTitle')}</h3>
                <p className="text-sm text-ink-muted">{t('talents.emptyBody')}</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={resetAll}>
                {t('shared.clearFilters')}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4">
                {talentsQuery.data.items.map((item) => {
                  const wilayaId = (
                    item as { location?: { wilayaId?: string } | null }
                  ).location?.wilayaId;
                  return (
                    <TalentCard
                      key={item.username}
                      item={item}
                      locale={locale}
                      wilayaLabel={wilayaId ? (wilayaNameOf.get(wilayaId) ?? null) : null}
                    />
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
        </div>

        {/* Right column: refine sidebar on xl+, drawer below (sticky, DESIGN.md top:80px pattern) */}
        <aside className="hidden w-full min-w-0 flex-col xl:sticky xl:top-20 xl:flex xl:self-start xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto xl:overscroll-contain">
          <section
            aria-label={t('talents.refineTitle')}
            className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">{t('talents.refineTitle')}</h2>
              <button
                type="button"
                onClick={resetAll}
                className="text-sm text-ink-muted transition-colors hover:text-primary"
              >
                {t('talents.clearAll')}
              </button>
            </div>

            {renderRefineFilters('talent-verification')}
          </section>
        </aside>
      </div>

      {drawerOpen ? (
        <FilterDrawer
          onClose={() => setDrawerOpen(false)}
          title={t('talents.refineTitle')}
          closeLabel={t('talents.closeFilters')}
        >
          {renderRefineFilters('talent-verification-drawer')}
        </FilterDrawer>
      ) : null}
    </div>
  );
}
