'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ChevronDown,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import {
  useFeedSkillCategoriesQuery,
  useFeedSkillsQuery,
  useFeedWilayasQuery,
  useOpportunitiesQuery,
  useRecommendedQuery,
} from '@/hooks/useFeed';
import { weekWindow, weekendWindow, type OpportunityFeedParams } from '@/lib/api/feed';
import { useFavoritesLookupQuery } from '@/hooks/useFavorites';
import { useSessionQuery } from '@/hooks/useSession';
import { useMySkillsQuery, useVolunteerMeQuery } from '@/hooks/useVolunteerAccount';
import { RequireVolunteer, SectionError } from '../components';
import { OpportunityCard } from './OpportunityCard';

// Authenticated Volunteer Opportunities list — code.html port ("Basmatak
// Tatatoua - Opportunities"). Three independently scrolling columns on
// desktop: the Shell sidebar (left), the center feed, and the right refine
// panel. The grid is fixed to the viewport height below the navbar
// (Dashboard precedent), so each column owns its scroll container and the
// page body never scrolls on desktop. Below xl the refine panel becomes an
// end-docked drawer and the suggested list stacks under the feed.
//
// Every number and label is real API data: facet rows render with no counts
// (GET /opportunities exposes no facet counts), the Remote pill and the
// On-site/Remote/Hybrid group stay out (no `mode` filter exists on the feed
// query), and "Most Relevant" stays out (the sort whitelist is
// newest/oldest/deadline_asc/startDate_asc). The integrity footnote from the
// design carries excluded copy and never renders.

export type AvailPreset = 'week' | 'weekend' | 'month' | 'flexible';

export interface OpportunityFilters {
  q: string;
  categoryIds: string[];
  skillIds: string[];
  wilayaIds: string[];
  municipalityId: string;
  openSeats: boolean;
  nearMe: boolean;
  sort: string;
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
  from: '',
  to: '',
};

const PAGE_LIMIT = 20;

// This-month window (ar-DZ week convention lives in feed.ts; the month bound
// is a plain calendar range, same ISO-string shape as the week helpers).
function monthWindow(ref: Date): { from: string; to: string } {
  const from = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1, 0, 0, 0));
  const to = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0, 23, 59, 59));
  return { from: from.toISOString(), to: to.toISOString() };
}

function datePart(iso: string): string {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id];
}

function isDefaultFilters(filters: OpportunityFilters): boolean {
  return (
    filters.q.trim() === '' &&
    filters.categoryIds.length === 0 &&
    filters.skillIds.length === 0 &&
    filters.wilayaIds.length === 0 &&
    filters.municipalityId === '' &&
    !filters.openSeats &&
    !filters.nearMe &&
    filters.sort === '' &&
    filters.from === '' &&
    filters.to === ''
  );
}

// Quick-filter pills (code.html primary row). Text-only, immediate-apply;
// the active state derives from the applied filters, never local toggles.
function QuickPill({
  active,
  onClick,
  label,
  badge,
  disabled,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-label-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'bg-primary-tint font-semibold text-primary'
          : 'bg-surface text-ink-muted shadow-sm hover:text-ink'
      }`}
    >
      <span>{label}</span>
      {typeof badge === 'number' && badge > 0 ? (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-tint text-[10px] font-bold text-primary">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function FacetCheck({
  checked,
  onChange,
  label,
  testId,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  testId: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 text-body-sm text-ink-muted select-none">
      <span className="flex min-w-0 items-center gap-2">
        <input
          type="checkbox"
          data-testid={testId}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 shrink-0 rounded accent-primary"
        />
        <span className="min-w-0 truncate">{label}</span>
      </span>
    </label>
  );
}

function AvailButton({
  active,
  onClick,
  label,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-md px-2 py-1.5 text-center text-label-xs font-medium transition-colors ${
        active ? 'bg-primary-tint text-primary' : 'bg-surface-muted text-ink-muted hover:bg-border-muted'
      }`}
    >
      {label}
    </button>
  );
}

// The full refine-filter body: location checkboxes, matched (profile) skills,
// category checkboxes, and availability presets. Rendered once in the desktop
// panel and once in the mobile drawer — same state, same handlers.
function RefineFilters({
  applied,
  onPatch,
  onReset,
  onAvail,
  avail,
  mySkillOptions,
  categoryOptions,
  wilayaOptions,
  visibleWilayas,
  wilayasExpanded,
  onToggleWilayas,
  wilayaTotal,
}: {
  applied: OpportunityFilters;
  onPatch: (patch: Partial<OpportunityFilters>) => void;
  onReset: () => void;
  onAvail: (preset: AvailPreset) => void;
  avail: AvailPreset | null;
  mySkillOptions: { value: string; label: string }[];
  categoryOptions: { value: string; label: string }[];
  wilayaOptions: { value: string; label: string }[];
  visibleWilayas: { value: string; label: string }[];
  wilayasExpanded: boolean;
  onToggleWilayas: () => void;
  wilayaTotal: number;
}) {
  const t = useTranslations('volunteerHome');
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-title-md font-bold text-ink">{t('opportunities.refineTitle')}</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-label-xs text-ink-muted transition-colors hover:text-ink"
        >
          {t('opportunities.clearAll')}
        </button>
      </div>

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
          {t('opportunities.locationGroup')}
        </legend>
        <div className="mt-1 flex flex-col gap-2">
          {visibleWilayas.map((option) => (
            <FacetCheck
              key={option.value}
              label={option.label}
              testId={`filter-wilaya-${option.value}`}
              checked={applied.wilayaIds.includes(option.value)}
              onChange={() => onPatch({ wilayaIds: toggleId(applied.wilayaIds, option.value) })}
            />
          ))}
        </div>
        {wilayaOptions.length > 8 ? (
          <button
            type="button"
            onClick={onToggleWilayas}
            className="self-start text-label-xs font-medium text-primary hover:underline"
          >
            {wilayasExpanded
              ? t('talents.showLessLocations')
              : t('talents.showMoreLocations', { count: wilayaTotal - 8 })}
          </button>
        ) : null}
      </fieldset>

      {mySkillOptions.length > 0 ? (
        <>
          <div className="h-px w-full bg-border-muted" aria-hidden="true" />
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="flex items-center justify-between gap-2 text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
              <span>{t('opportunities.skillsGroup')}</span>
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />
            </legend>
            <div className="mt-1 flex flex-col gap-2">
              {mySkillOptions.map((option) => (
                <FacetCheck
                  key={option.value}
                  label={option.label}
                  testId={`filter-skill-${option.value}`}
                  checked={applied.skillIds.includes(option.value)}
                  onChange={() => onPatch({ skillIds: toggleId(applied.skillIds, option.value) })}
                />
              ))}
            </div>
          </fieldset>
        </>
      ) : null}

      <div className="h-px w-full bg-border-muted" aria-hidden="true" />

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
          {t('opportunities.availabilityGroup')}
        </legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <AvailButton active={avail === 'week'} onClick={() => onAvail('week')} label={t('opportunities.availWeek')} testId="filter-avail-week" />
          <AvailButton active={avail === 'weekend'} onClick={() => onAvail('weekend')} label={t('opportunities.availWeekend')} testId="filter-avail-weekend" />
          <AvailButton active={avail === 'month'} onClick={() => onAvail('month')} label={t('opportunities.availMonth')} testId="filter-avail-month" />
          <AvailButton active={avail === 'flexible'} onClick={() => onAvail('flexible')} label={t('opportunities.availFlexible')} testId="filter-avail-flexible" />
        </div>
      </fieldset>

      {categoryOptions.length > 0 ? (
        <>
          <div className="h-px w-full bg-border-muted" aria-hidden="true" />
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
              {t('opportunities.categoryGroup')}
            </legend>
            <div className="mt-1 flex flex-col gap-2">
              {categoryOptions.map((option) => (
                <FacetCheck
                  key={option.value}
                  label={option.label}
                  testId={`filter-category-${option.value}`}
                  checked={applied.categoryIds.includes(option.value)}
                  onChange={() => onPatch({ categoryIds: toggleId(applied.categoryIds, option.value) })}
                />
              ))}
            </div>
          </fieldset>
        </>
      ) : null}
    </div>
  );
}

// Right-side filter sheet below xl: fixed overlay + panel docked to the
// inline-end side (right in LTR, left in RTL), Escape/overlay/X to close.
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
        data-testid="opportunities-filters-overlay"
        aria-label={closeLabel}
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      <div
        data-testid="opportunities-filters-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-y-0 end-0 flex w-[min(85vw,24rem)] min-w-0 flex-col bg-surface shadow-modal"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-muted p-4">
          <h2 className="min-w-0 truncate text-title-sm font-semibold text-ink">{title}</h2>
          <button
            type="button"
            data-testid="opportunities-filters-close"
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

// Loading skeleton (code.html demonstrates skeleton rows for the feed).
function FeedSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex min-w-0 flex-col gap-4">
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          aria-hidden="true"
          className="flex min-w-0 animate-pulse flex-col gap-3 rounded-xl border border-border bg-surface p-5"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-border-muted" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-3 w-1/3 rounded bg-border-muted" />
              <div className="h-2 w-1/5 rounded bg-surface-muted" />
            </div>
          </div>
          <div className="h-4 w-3/4 rounded bg-border-muted" />
          <div className="h-3 w-full rounded bg-surface-muted" />
          <div className="flex gap-2">
            <div className="h-5 w-16 rounded bg-surface-muted" />
            <div className="h-5 w-20 rounded bg-surface-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function daysLeftLabel(deadline: string | null | undefined, now: number): number | null {
  if (!deadline) return null;
  const time = new Date(deadline).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.ceil((time - now) / 86_400_000));
}

// Compact typographic suggestion rows (code.html "Suggested for you"): real
// title/org from GET /opportunities/recommended, real days-left from the
// application deadline, real open-seat totals, and a match note only when a
// position skill id intersects the volunteer's own skills. No urgency or
// affinity adjectives beyond that intersection.
function SuggestedList({
  locale,
  mySkillIds,
  onViewAll,
}: {
  locale: string;
  mySkillIds: string[];
  onViewAll: () => void;
}) {
  const t = useTranslations('volunteerHome');
  const session = useSessionQuery();
  const recommendedQuery = useRecommendedQuery(!!session.data);
  const items = recommendedQuery.data?.items ?? [];
  const now = Date.now();
  const mySkills = useMemo(() => new Set(mySkillIds), [mySkillIds]);

  return (
    <section
      aria-label={t('opportunities.suggestedTitle')}
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-title-sm font-bold text-ink">{t('opportunities.suggestedTitle')}</h2>
        <button
          type="button"
          onClick={onViewAll}
          className="shrink-0 text-label-xs font-medium text-primary hover:underline"
        >
          {t('opportunities.suggestedViewAll')}
        </button>
      </div>
      {recommendedQuery.isPending ? (
        <p className="text-body-sm text-ink-muted">{t('shared.loading')}</p>
      ) : recommendedQuery.isError ? (
        <SectionError testId="suggested-error" message={t('shared.loadError')} />
      ) : items.length === 0 ? (
        <p className="text-body-sm text-ink-muted">{t('dashboard.railSuggestedEmptyBody')}</p>
      ) : (
        <div data-testid="recommended-strip" className="flex min-w-0 flex-col">
          {items.slice(0, 3).map((item, index) => {
            const key = item.id ?? item._id ?? item.slug ?? `suggested-${index}`;
            const detailId = item.slug ?? item.idOrSlug ?? item.id ?? item._id ?? '';
            const orgName = (item.organization
              ? facetLabel(
                  {
                    nameFr: item.organization.nameFr ?? undefined,
                    nameAr: item.organization.nameAr ?? undefined,
                  },
                  locale,
                )
              : '');
            let required = 0;
            let open = 0;
            let known = false;
            const positionSkillIds = new Set<string>();
            for (const position of item.positions ?? []) {
              if (typeof position.requiredCount === 'number' && typeof position.filledCount === 'number') {
                required += position.requiredCount;
                open += Math.max(0, position.requiredCount - position.filledCount);
                known = true;
              }
              for (const skill of position.skillNames ?? []) {
                if (skill?.skillId) positionSkillIds.add(skill.skillId);
              }
            }
            const matches = [...positionSkillIds].some((skillId) => mySkills.has(skillId));
            const daysLeft = daysLeftLabel(item.applicationDeadline, now);
            const meta = daysLeft !== null
              ? t('opportunities.suggestedDaysLeft', { count: daysLeft })
              : null;
            return (
              <div key={key} data-testid="suggested-item">
                {index > 0 ? <div className="my-1.5 h-px w-full bg-border-muted" aria-hidden="true" /> : null}
                <Link
                  href={`/volunteer/opportunities/${detailId}`}
                  className="group block rounded-lg p-1.5 transition-colors hover:bg-surface-muted/60 -m-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-label-md font-semibold text-ink transition-colors group-hover:text-primary">
                      {item.title ?? detailId}
                    </span>
                    {meta ? (
                      <span className="shrink-0 text-label-xs font-medium text-status-pending">{meta}</span>
                    ) : null}
                  </div>
                  {orgName !== '' ? (
                    <span className="mt-0.5 block truncate text-body-sm text-ink-muted">{orgName}</span>
                  ) : null}
                  {known && required > 0 ? (
                    <span className="mt-0.5 block text-label-xs text-ink-muted">
                      {t('opportunities.suggestedOpen', { count: open })}
                      {matches ? ` · ${t('opportunities.suggestedMatch')}` : null}
                    </span>
                  ) : matches ? (
                    <span className="mt-0.5 block text-label-xs text-ink-muted">
                      {t('opportunities.suggestedMatch')}
                    </span>
                  ) : null}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

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
  const next = `/volunteer/opportunities`;

  const [applied, setApplied] = useState<OpportunityFilters>(() => parseOpportunitySearch(initialSearch));
  const [queryText, setQueryText] = useState(() => parseOpportunitySearch(initialSearch).q);
  const [avail, setAvail] = useState<AvailPreset | null>(null);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [pageIdx, setPageIdx] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wilayasExpanded, setWilayasExpanded] = useState(false);

  const feedParams = useMemo(
    () => toFeedParams(applied, cursors[pageIdx]),
    [applied, cursors, pageIdx],
  );
  const feedQuery = useOpportunitiesQuery(feedParams);

  const meQuery = useVolunteerMeQuery();
  const mySkillsQuery = useMySkillsQuery();
  const canNearMe = meQuery.data ? !!meQuery.data.location?.wilayaId : true;

  const categoriesQuery = useFeedSkillCategoriesQuery();
  const skillsQuery = useFeedSkillsQuery();
  const wilayasQuery = useFeedWilayasQuery();

  const mySkillIds = useMemo(
    () => (mySkillsQuery.data ?? []).map((s) => s.skillId).filter((id): id is string => typeof id === 'string' && id !== ''),
    [mySkillsQuery.data],
  );
  const mySkillOptions = useMemo(() => {
    const labels = new Map<string, string>();
    for (const option of skillsQuery.data ?? []) {
      const value = facetValue(option);
      const label = facetLabel(option, locale);
      if (value !== '' && label !== '' && !labels.has(value)) labels.set(value, label);
    }
    return mySkillIds
      .map((id) => ({ value: id, label: labels.get(id) ?? '' }))
      .filter((option) => option.label !== '');
  }, [mySkillIds, skillsQuery.data, locale]);

  const categoryOptions = useMemo(
    () =>
      (categoriesQuery.data ?? [])
        .map((c) => ({ value: facetValue(c), label: facetLabel(c, locale) }))
        .filter((o) => o.value !== '' && o.label !== ''),
    [categoriesQuery.data, locale],
  );
  const wilayaOptions = useMemo(
    () =>
      (wilayasQuery.data ?? [])
        .map((w) => ({ value: facetValue(w), label: facetLabel(w, locale) }))
        .filter((o) => o.value !== '' && o.label !== ''),
    [wilayasQuery.data, locale],
  );
  const visibleWilayas = wilayasExpanded ? wilayaOptions : wilayaOptions.slice(0, 8);

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

  const feedIds = useMemo(
    () => (feedQuery.data?.items ?? []).map((i) => i.id ?? i._id ?? '').filter(Boolean) as string[],
    [feedQuery.data],
  );
  const lookupQuery = useFavoritesLookupQuery('opportunity', feedIds.slice(0, 50));

  const apply = (filters: OpportunityFilters) => {
    const gated: OpportunityFilters = { ...filters, nearMe: filters.nearMe && canNearMe };
    setApplied(gated);
    setCursors([undefined]);
    setPageIdx(0);
    router.replace(`${pathname}${toSearchString(gated)}`);
  };

  const patch = (part: Partial<OpportunityFilters>) => {
    if ((part.from !== undefined || part.to !== undefined) && avail !== null) setAvail(null);
    apply({ ...applied, ...part });
  };

  const resetAll = () => {
    setQueryText('');
    setAvail(null);
    apply(EMPTY_FILTERS);
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    apply({ ...applied, q: queryText });
  };

  const clearSearch = () => {
    setQueryText('');
    apply({ ...applied, q: '' });
  };

  const applyAvail = (preset: AvailPreset) => {
    if (preset === 'flexible') {
      setAvail('flexible');
      apply({ ...applied, from: '', to: '' });
      return;
    }
    const now = new Date();
    const bounds = preset === 'week' ? weekWindow(now) : preset === 'weekend' ? weekendWindow(now) : monthWindow(now);
    setAvail(preset);
    apply({ ...applied, from: bounds.from, to: bounds.to });
  };

  const toggleUpcoming = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (applied.to === '' && datePart(applied.from) === today) {
      setAvail(null);
      apply({ ...applied, from: '', to: '' });
    } else {
      setAvail(null);
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      apply({ ...applied, from: start.toISOString(), to: '' });
    }
  };

  const toggleMySkills = () => {
    const active = mySkillIds.length > 0 && applied.skillIds.length > 0 && applied.skillIds.every((id) => mySkillIds.includes(id));
    apply({ ...applied, skillIds: active ? [] : [...mySkillIds] });
  };

  const toggleNearMe = () => {
    if (!canNearMe) return;
    apply({ ...applied, nearMe: !applied.nearMe });
  };

  const saveStateOf = (id: string, fallback: boolean | null | undefined) => ({
    favorited: lookupQuery.data?.[id]?.favorited ?? fallback ?? false,
    count: lookupQuery.data?.[id]?.favoriteCount ?? null,
  });

  const total = feedQuery.data?.total;
  const rangeFrom = total !== undefined && total > 0 ? pageIdx * PAGE_LIMIT + 1 : 0;
  const rangeTo = total !== undefined ? pageIdx * PAGE_LIMIT + (feedQuery.data?.items.length ?? 0) : 0;

  const mySkillsActive = mySkillIds.length > 0 && applied.skillIds.length > 0 && applied.skillIds.every((id) => mySkillIds.includes(id));
  const upcomingActive = applied.to === '' && applied.from !== '' && datePart(applied.from) === new Date().toISOString().slice(0, 10);
  const allActive = isDefaultFilters(applied);

  const places = useMemo(() => {
    const names: string[] = [];
    for (const id of applied.wilayaIds) {
      const label = wilayaNameOf.get(id);
      if (label && !names.includes(label)) names.push(label);
    }
    if (names.length === 0 && applied.nearMe) {
      const ownId = meQuery.data?.location?.wilayaId;
      const ownLabel = typeof ownId === 'string' ? wilayaNameOf.get(ownId) : undefined;
      if (ownLabel) names.push(ownLabel);
    }
    return names.slice(0, 2);
  }, [applied.wilayaIds, applied.nearMe, wilayaNameOf, meQuery.data?.location?.wilayaId]);

  const refineBody = (
    <RefineFilters
      applied={applied}
      onPatch={patch}
      onReset={resetAll}
      onAvail={applyAvail}
      avail={avail}
      mySkillOptions={mySkillOptions}
      categoryOptions={categoryOptions}
      wilayaOptions={wilayaOptions}
      visibleWilayas={visibleWilayas}
      wilayasExpanded={wilayasExpanded}
      onToggleWilayas={() => setWilayasExpanded((v) => !v)}
      wilayaTotal={wilayaOptions.length}
    />
  );

  return (
    <RequireVolunteer locale={locale} next={next}>
      <div data-testid="volunteer-opportunities" className="min-w-0">
        <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:h-[calc(100dvh-7rem)] xl:grid-cols-[minmax(0,1fr)_300px]">
          {/* Center column: header, search, feed (own scroll container). */}
          <div
            data-testid="opportunities-center"
            className="flex min-w-0 flex-col gap-4 sm:gap-5 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pe-1"
          >
            <section className="flex min-w-0 flex-col gap-3">
              <div>
                <h1 className="text-headline-lg font-bold tracking-tight text-ink">
                  {t('opportunities.title')}
                </h1>
                <p className="mt-0.5 text-body-sm text-ink-muted">{t('opportunities.subtitle')}</p>
              </div>

              <form role="search" onSubmit={submitSearch} className="relative w-full">
                <Search
                  aria-hidden="true"
                  size={20}
                  className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
                />
                <label htmlFor="opp-q" className="sr-only">
                  {t('opportunities.searchLabel')}
                </label>
                <input
                  id="opp-q"
                  type="text"
                  placeholder={t('opportunities.searchPlaceholder')}
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-surface pe-10 ps-11 text-body-sm text-ink shadow-sm transition-all placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
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

              <div className="flex flex-wrap items-center gap-2">
                <QuickPill active={allActive} onClick={resetAll} label={t('opportunities.pillAll')} testId="pill-all" />
                <QuickPill
                  active={applied.nearMe}
                  onClick={toggleNearMe}
                  label={t('opportunities.pillNearMe')}
                  disabled={!canNearMe}
                  testId="pill-near-me"
                />
                <QuickPill
                  active={mySkillsActive}
                  onClick={toggleMySkills}
                  label={t('opportunities.pillMySkills')}
                  badge={mySkillIds.length}
                  testId="pill-my-skills"
                />
                <QuickPill
                  active={upcomingActive}
                  onClick={toggleUpcoming}
                  label={t('opportunities.pillUpcoming')}
                  testId="pill-upcoming"
                />
                <span className="ms-auto flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    data-testid="opportunities-filters-open"
                    aria-expanded={drawerOpen}
                    aria-controls="opportunities-filters-drawer"
                    onClick={() => setDrawerOpen(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-body-sm font-medium text-ink shadow-sm transition-colors hover:bg-surface-muted xl:hidden"
                  >
                    <SlidersHorizontal aria-hidden="true" size={16} />
                    {t('opportunities.filtersTitle')}
                  </button>
                  <button
                    type="button"
                    onClick={resetAll}
                    className="shrink-0 text-label-xs text-ink-muted transition-colors hover:text-ink"
                  >
                    {t('opportunities.resetFilters')}
                  </button>
                </span>
              </div>
              {!canNearMe ? (
                <p className="text-label-xs text-ink-muted">{t('opportunities.nearMeHint')}</p>
              ) : null}
            </section>

            <div className="flex items-center justify-between gap-2 px-1 text-ink-muted">
              {total !== undefined ? (
                <p data-testid="feed-count" role="status" className="flex min-w-0 items-center gap-1.5 text-label-xs font-medium">
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-status-success" />
                  <span className="truncate">
                    {places.length > 0
                      ? t('opportunities.statusLineIn', { total, places: places.join(' & ') })
                      : t('opportunities.statusLine', { total })}
                  </span>
                </p>
              ) : (
                <span />
              )}
              <div className="flex shrink-0 items-center gap-1.5 text-label-xs">
                <span>{t('opportunities.sortBy')}:</span>
                <span className="relative inline-flex items-center">
                  <select
                    id="opp-sort"
                    aria-label={t('opportunities.sortLabel')}
                    value={applied.sort}
                    onChange={(e) => patch({ sort: e.target.value })}
                    className="cursor-pointer appearance-none bg-transparent font-semibold text-ink focus:outline-none pe-4"
                  >
                    <option value="">{t('opportunities.sortDefault')}</option>
                    <option value="newest">{t('opportunities.sortNewest')}</option>
                    <option value="oldest">{t('opportunities.sortOldest')}</option>
                    <option value="deadline_asc">{t('opportunities.sortDeadline')}</option>
                    <option value="startDate_asc">{t('opportunities.sortStartDate')}</option>
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    size={14}
                    className="pointer-events-none absolute end-0 top-1/2 -translate-y-1/2 text-ink-muted"
                  />
                </span>
              </div>
            </div>

            {feedQuery.isPending ? (
              <FeedSkeleton label={t('shared.loading')} />
            ) : feedQuery.isError ? (
              <div className="flex min-w-0 flex-col items-start gap-3">
                <SectionError testId="opportunities-error" message={t('shared.loadError')} />
                <Button type="button" variant="secondary" size="sm" onClick={() => feedQuery.refetch()}>
                  {t('shared.retry')}
                </Button>
              </div>
            ) : feedQuery.data.total === 0 ? (
              <div
                data-testid="opportunities-empty"
                className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-8 text-center shadow-sm sm:p-12"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
                  <SearchX aria-hidden="true" size={24} />
                </div>
                <div className="flex max-w-md flex-col gap-1">
                  <h3 className="text-title-sm font-semibold text-ink">
                    {applied.q.trim() !== ''
                      ? t('opportunities.emptyTitleQuery', { q: applied.q.trim() })
                      : t('opportunities.emptyTitle')}
                  </h3>
                  <p className="text-body-sm text-ink-muted">{t('opportunities.emptyBody')}</p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={resetAll}>
                  {t('shared.clearFilters')}
                </Button>
              </div>
            ) : (
              <>
                <div className="flex min-w-0 flex-col gap-4">
                  {feedQuery.data.items.map((item) => {
                    const id = item.id ?? item._id ?? '';
                    const state = saveStateOf(id, item.isFavorited);
                    return (
                      <OpportunityCard key={id} item={item} locale={locale} favorited={state.favorited} favoriteCount={state.count} next={next} />
                    );
                  })}
                </div>
                <div className="flex flex-col gap-3 py-1 text-body-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    {t('opportunities.showingRange', { from: rangeFrom, to: rangeTo, total: feedQuery.data.total })}
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
                </div>
              </>
            )}

            {/* Suggested list stacks under the feed below xl. */}
            <div className="xl:hidden">
              <SuggestedList locale={locale} mySkillIds={mySkillIds} onViewAll={resetAll} />
            </div>
          </div>

          {/* Right column: refine panel + suggested (own scroll container). */}
          <aside
            data-testid="opportunities-filters"
            className="hidden min-w-0 flex-col gap-5 xl:flex lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pe-1"
          >
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              {refineBody}
            </div>
            <SuggestedList locale={locale} mySkillIds={mySkillIds} onViewAll={resetAll} />
          </aside>
        </div>

        {drawerOpen ? (
          <FilterDrawer
            onClose={() => setDrawerOpen(false)}
            title={t('opportunities.refineTitle')}
            closeLabel={t('talents.closeFilters')}
          >
            {refineBody}
          </FilterDrawer>
        ) : null}
      </div>
    </RequireVolunteer>
  );
}

// Re-exported icon contract for the mapping audit (Material Symbols in
// code.html → the lucide-react component used on this screen).
export const OPPORTUNITIES_ICON_MAP = {
  dashboard: 'LayoutDashboard',
  assignment_turned_in: 'ClipboardList',
  task_alt: 'ListChecks',
  military_tech: 'Award',
  folder_shared: 'Images',
  explore: 'Compass',
  group: 'Users',
  settings: 'Settings',
  search: 'Search',
  search_off: 'SearchX',
  arrow_drop_down: 'ChevronDown',
  expand_more: 'ChevronDown',
  check_circle: 'CircleCheck',
  location_on: 'MapPin',
  calendar_today: 'CalendarDays',
  schedule: 'Clock',
  hourglass_top: 'Hourglass',
  bookmark_border: 'Bookmark',
  share: 'Share2',
  arrow_forward: 'ArrowRight',
  tune: 'SlidersHorizontal',
  public: 'Globe',
} as const;
