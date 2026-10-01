'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Info, Lock } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Select } from '@/components/ui/Select';
import {
  useFilterSkillCategoriesQuery,
  useFilterSkillsQuery,
  useMyExperiencesQuery,
  useMyReviewsQuery,
} from '@/hooks/useExperiences';
import { useVolunteerMeQuery } from '@/hooks/useVolunteerAccount';
import { reviewOrgDisplayName } from '@/lib/api/experiences';
import { RequireVolunteer, SectionError } from '../components';
import { ExperienceCard } from './ExperienceCard';

function labelOf(
  entry: { nameFr?: string | null; nameAr?: string | null; name?: string | null },
  locale: string,
): string {
  if (locale === 'ar') return entry.nameAr ?? entry.nameFr ?? entry.name ?? '';
  return entry.nameFr ?? entry.nameAr ?? entry.name ?? '';
}

function categoryIdOf(entry: { id?: string; _id?: string }): string {
  return entry.id ?? entry._id ?? '';
}

function ReviewsSection({ locale }: { locale: string }) {
  const t = useTranslations('volunteerCredentials');
  const reviewsQuery = useMyReviewsQuery();
  if (reviewsQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (reviewsQuery.isError)
    return <SectionError testId="reviews-error" message={t('shared.loadError')} />;
  const reviews = reviewsQuery.data ?? [];
  return (
    <Card title={t('experiences.reviewsTitle')}>
      <p className="mb-3 text-sm text-ink-muted">{t('experiences.reviewsSubtitle')}</p>
      {reviews.length === 0 ? (
        <Empty title={t('experiences.reviewsEmpty')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.map((review, index) => (
            <li
              key={`${review.rating}-${index}`}
              data-testid="review-row"
              className="rounded-md border border-border p-3"
            >
              <p className="text-sm font-semibold text-ink">
                {reviewOrgDisplayName(review.organization ?? null, locale) ||
                  t('experiences.unknownOrg')}{' '}
                — {review.rating}/5
              </p>
              {review.comment ? <p className="mt-1 text-sm text-ink-muted">{review.comment}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// My Experiences rebuilt from `design/Basmatak Tatatoua - My Experiences/`:
// breadcrumb header -> category tabs + sort -> featured hero + chronological
// stream + overview sidebar -> reviews. Every row comes from the real
// verified-experience endpoints (GET /experiences/me, detail evidence,
// /volunteers/me/reviews); mock-only role/location/deliverable copy, record
// codes, aggregate percentages, bulk exports, and mock-only legal
// vocabulary are deleted, not reworded. Skill names resolve
// from the real /skills catalog as plain text (never badges). Guest visits
// redirect to Login (decision 10).
export function ExperiencesPage({ locale }: { locale: string }) {
  const t = useTranslations('volunteerCredentials');
  const [categoryId, setCategoryId] = useState('');
  const [skillId, setSkillId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const listQuery = useMyExperiencesQuery({
    categoryId: categoryId === '' ? undefined : categoryId,
    skillId: skillId === '' ? undefined : skillId,
    from: from === '' ? undefined : from,
    to: to === '' ? undefined : to,
  });
  // Overall total for the All tab + overview (limit=1: only `total` is read).
  const totalQuery = useMyExperiencesQuery({ limit: 1 });
  const categoriesQuery = useFilterSkillCategoriesQuery();
  const allSkillsQuery = useFilterSkillsQuery();
  const meQuery = useVolunteerMeQuery();

  const categories = useMemo(
    () =>
      (categoriesQuery.data ?? [])
        .map((category) => ({ id: categoryIdOf(category), label: labelOf(category, locale) }))
        .filter((entry) => entry.id !== '' && entry.label !== ''),
    [categoriesQuery.data, locale],
  );

  const skillOptions = useMemo(() => {
    const rows = (allSkillsQuery.data ?? []).filter(
      (skill) =>
        categoryId === '' ||
        (skill as { categoryId?: string }).categoryId === undefined ||
        (skill as { categoryId?: string }).categoryId === categoryId,
    );
    return rows
      .map((skill) => ({
        id: (skill as { skillId?: string }).skillId ?? categoryIdOf(skill),
        label: labelOf(skill, locale),
      }))
      .filter((entry) => entry.id !== '' && entry.label !== '');
  }, [allSkillsQuery.data, categoryId, locale]);

  const skillNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const skill of allSkillsQuery.data ?? []) {
      const label = labelOf(skill, locale);
      if (label === '') continue;
      for (const key of [
        (skill as { skillId?: string }).skillId,
        (skill as { id?: string }).id,
        (skill as { _id?: string })._id,
      ]) {
        if (key && !map.has(key)) map.set(key, label);
      }
    }
    return map;
  }, [allSkillsQuery.data, locale]);

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);
  const [featured, ...rest] = items;
  const overallTotal = totalQuery.data?.total ?? 0;

  const overviewSkills = useMemo(() => {
    const unique = new Set<string>();
    for (const item of items) {
      for (const skill of item.skills ?? []) unique.add(skill);
    }
    return unique.size;
  }, [items]);

  const overviewHours = useMemo(() => {
    const minutes = items.reduce(
      (sum, item) => sum + (typeof item.duration === 'number' ? item.duration : 0),
      0,
    );
    return Math.round((minutes / 60) * 10) / 10;
  }, [items]);

  const hasFilters = categoryId !== '' || skillId !== '' || from !== '' || to !== '';
  const clearFilters = () => {
    setCategoryId('');
    setSkillId('');
    setFrom('');
    setTo('');
  };

  const username = meQuery.data?.username ?? '';

  return (
    <RequireVolunteer locale={locale} next={`/volunteer/experiences`}>
      <div data-testid="volunteer-experiences" className="flex min-w-0 flex-col gap-6">
        <nav aria-label={t('experiences.breadcrumbLabel')}>
          <ol className="flex flex-wrap items-center gap-1.5 text-label-sm">
            <li className="text-ink-muted">{t('experiences.breadcrumbSection')}</li>
            <li aria-hidden="true" className="text-ink-muted">
              /
            </li>
            <li aria-current="page" className="font-medium text-ink">
              {t('experiences.title')}
            </li>
          </ol>
        </nav>

        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-ink">{t('experiences.title')}</h1>
            <p className="mt-0.5 text-sm text-ink-muted">{t('experiences.subtitle')}</p>
          </div>
          {username !== '' ? (
            <Link
              href={`/volunteer/talents/${username}`}
              data-testid="experiences-view-profile"
              className="inline-flex shrink-0 items-center gap-1 text-label-sm font-medium text-primary hover:underline"
            >
              <span>{t('experiences.viewPublicProfile')}</span>
              <ArrowRight size={14} aria-hidden="true" className="rtl:rotate-180" />
            </Link>
          ) : null}
        </div>

        <div data-testid="exp-filters" className="flex flex-col gap-3">
          <div className="flex flex-col justify-between gap-2 border-b border-border-muted pb-2 sm:flex-row sm:items-center">
            <div
              role="tablist"
              aria-label={t('experiences.filtersTitle')}
              className="flex min-w-0 items-center gap-1 overflow-x-auto"
            >
              <button
                key="all"
                type="button"
                role="tab"
                aria-selected={categoryId === ''}
                data-testid="exp-tab-all"
                onClick={() => {
                  setCategoryId('');
                  setSkillId('');
                }}
                className={`shrink-0 rounded-md px-3 py-1 text-label-sm font-medium transition-colors ${
                  categoryId === ''
                    ? 'bg-primary-tint text-primary'
                    : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                }`}
              >
                {t('experiences.allTab', { total: overallTotal })}
              </button>
              {categories.map((category) => {
                const active = categoryId === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-testid={`exp-tab-${category.id}`}
                    onClick={() => {
                      setCategoryId(category.id);
                      setSkillId('');
                    }}
                    className={`shrink-0 rounded-md px-3 py-1 text-label-sm font-medium transition-colors ${
                      active
                        ? 'bg-primary-tint text-primary'
                        : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                    }`}
                  >
                    {category.label}
                  </button>
                );
              })}
            </div>
            <p className="flex shrink-0 items-center gap-1.5 text-label-sm text-ink-muted">
              <span>{t('experiences.sortBy')}</span>
              <span className="font-medium text-ink">{t('experiences.sortRecent')}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-44">
              <Select
                id="exp-category"
                label={t('experiences.categoryLabel')}
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setSkillId('');
                }}
                options={[
                  { value: '', label: t('experiences.allCategories') },
                  ...categories.map((category) => ({ value: category.id, label: category.label })),
                ]}
              />
            </div>
            <div className="w-44">
              <Select
                id="exp-skill"
                label={t('experiences.skillLabel')}
                value={skillId}
                onChange={(event) => setSkillId(event.target.value)}
                options={[
                  { value: '', label: t('experiences.allSkills') },
                  ...skillOptions.map((skill) => ({ value: skill.id, label: skill.label })),
                ]}
              />
            </div>
            <div className="w-40">
              <Input
                id="exp-from"
                type="date"
                label={t('experiences.fromLabel')}
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div className="w-40">
              <Input
                id="exp-to"
                type="date"
                label={t('experiences.toLabel')}
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
            {hasFilters ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                {t('experiences.clearFilters')}
              </Button>
            ) : null}
          </div>
        </div>

        {listQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {listQuery.isError ? (
          <div className="flex flex-col items-start gap-2">
            <SectionError testId="exp-list-error" message={t('shared.loadError')} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="exp-list-retry"
              onClick={() => void listQuery.refetch()}
            >
              {t('shared.retry')}
            </Button>
          </div>
        ) : null}
        {listQuery.data ? (
          <p data-testid="exp-count" className="text-sm text-ink-muted">
            {t('experiences.count', { total: listQuery.data.total })}
          </p>
        ) : null}

        {listQuery.data && items.length === 0 ? (
          <Empty title={t('experiences.empty')} description={t('experiences.emptyBody')} />
        ) : null}

        {items.length > 0 ? (
          <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="flex min-w-0 flex-col gap-10">
              {featured ? (
                <ExperienceCard
                  key={featured.id}
                  experience={featured}
                  locale={locale}
                  skillNames={skillNames}
                  featured
                  defaultExpanded
                />
              ) : null}
              {rest.length > 0 ? (
                <div className="flex flex-col divide-y divide-border">
                  {rest.map((experience) => (
                    <div key={experience.id} className="py-6 first:pt-0 last:pb-0">
                      <ExperienceCard
                        experience={experience}
                        locale={locale}
                        skillNames={skillNames}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <aside className="flex min-w-0 flex-col gap-6" aria-label={t('experiences.overviewTitle')}>
              <Card title={t('experiences.overviewTitle')}>
                <dl className="flex flex-col divide-y divide-border-muted">
                  <div className="flex items-center justify-between gap-3 py-3 first:pt-0">
                    <dt className="text-body-md text-ink-muted">{t('experiences.overviewExperiences')}</dt>
                    <dd data-testid="overview-total" className="text-title-md font-semibold text-ink">
                      {overallTotal}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-3">
                    <dt className="text-body-md text-ink-muted">{t('experiences.overviewSkills')}</dt>
                    <dd data-testid="overview-skills" className="text-title-md font-semibold text-ink">
                      {overviewSkills}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-3 last:pb-0">
                    <dt className="text-body-md text-ink-muted">{t('experiences.overviewHours')}</dt>
                    <dd data-testid="overview-hours" className="text-title-md font-semibold text-ink">
                      {t('experiences.hoursShort', { hours: overviewHours })}
                    </dd>
                  </div>
                </dl>
              </Card>

              <Card title={t('experiences.aboutTitle')}>
                <p className="flex items-start gap-2 text-body-sm leading-relaxed text-ink-muted">
                  <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                  <span>{t('experiences.aboutBody')}</span>
                </p>
              </Card>

              <p className="flex items-start gap-2 px-1 text-body-sm leading-relaxed text-ink-muted">
                <Lock size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span>{t('experiences.privacyNote')}</span>
              </p>
            </aside>
          </div>
        ) : null}

        <div data-testid="exp-reviews">
          <ReviewsSection locale={locale} />
        </div>
      </div>
    </RequireVolunteer>
  );
}
