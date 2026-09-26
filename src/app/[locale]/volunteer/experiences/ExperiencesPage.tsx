'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
import { reviewOrgDisplayName } from '@/lib/api/experiences';
import { RequireVolunteer, SectionError } from '../components';
import { ExperienceCard } from './ExperienceCard';

function skillLabel(
  skill: { nameFr?: string | null; nameAr?: string | null; name?: string | null },
  locale: string,
): string {
  if (locale === 'ar') return skill.nameAr ?? skill.nameFr ?? skill.name ?? '';
  return skill.nameFr ?? skill.nameAr ?? skill.name ?? '';
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

// F8-owned My Experiences route: enriched records with category/skill/date
// filters, visibility toggles, attestation downloads, verify-link copies,
// plus the received-reviews section on the same page (OQ2). Guest visits
// redirect to Login (decision 10). No audio player; no Audited 100%.
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
  const categoriesQuery = useFilterSkillCategoriesQuery();
  const skillsQuery = useFilterSkillsQuery(categoryId === '' ? undefined : categoryId);

  const clearFilters = () => {
    setCategoryId('');
    setSkillId('');
    setFrom('');
    setTo('');
  };

  return (
    <RequireVolunteer locale={locale} next={`/${locale}/volunteer/experiences`}>
      <div data-testid="volunteer-experiences" className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('experiences.title')}</h1>
          <p className="text-sm text-ink-muted">{t('experiences.subtitle')}</p>
        </div>
        <Card title={t('experiences.filtersTitle')}>
          <div data-testid="exp-filters" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                ...((categoriesQuery.data ?? []).map((category) => ({
                  value: category.id ?? category._id ?? '',
                  label: skillLabel(category, locale),
                })) ?? []),
              ]}
            />
            <Select
              id="exp-skill"
              label={t('experiences.skillLabel')}
              value={skillId}
              onChange={(event) => setSkillId(event.target.value)}
              options={[
                { value: '', label: t('experiences.allSkills') },
                ...((skillsQuery.data ?? []).map((skill) => ({
                  value: skill.skillId ?? skill.id ?? skill._id ?? '',
                  label: skillLabel(skill, locale),
                })) ?? []),
              ]}
            />
            <Input
              id="exp-from"
              type="date"
              label={t('experiences.fromLabel')}
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
            <Input
              id="exp-to"
              type="date"
              label={t('experiences.toLabel')}
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          <div className="mt-3">
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              {t('experiences.clearFilters')}
            </Button>
          </div>
        </Card>
        {listQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {listQuery.isError ? (
          <SectionError testId="exp-list-error" message={t('shared.loadError')} />
        ) : null}
        {listQuery.data ? (
          <p data-testid="exp-count" className="text-sm text-ink-muted">
            {t('experiences.count', { total: listQuery.data.total })}
          </p>
        ) : null}
        {listQuery.data && listQuery.data.items.length === 0 ? (
          <Empty title={t('experiences.empty')} />
        ) : null}
        {(listQuery.data?.items ?? []).map((experience) => (
          <ExperienceCard key={experience.id} experience={experience} locale={locale} />
        ))}
        <div data-testid="exp-reviews">
          <ReviewsSection locale={locale} />
        </div>
      </div>
    </RequireVolunteer>
  );
}
