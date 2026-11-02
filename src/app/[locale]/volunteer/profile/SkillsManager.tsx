'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Select } from '@/components/ui/Select';
import { SectionCard } from '@/components/profile';
import { localizedName } from '@/lib/profile/labels';
import {
  useAddMySkillMutation,
  useDeleteMySkillMutation,
  useMySkillsQuery,
  useSkillCategoriesQuery,
  useSkillsLookupQuery,
  useUpdateMySkillMutation,
} from '@/hooks/useVolunteerAccount';

export function SkillsManager({ locale }: { locale: string }) {
  const t = useTranslations('volunteerAccount');
  const activeLocale = useLocale() || locale;
  const skillsQuery = useMySkillsQuery();
  const categoriesQuery = useSkillCategoriesQuery();
  const [categoryId, setCategoryId] = useState('');
  const lookupQuery = useSkillsLookupQuery(categoryId || undefined);
  const add = useAddMySkillMutation();
  const update = useUpdateMySkillMutation();
  const remove = useDeleteMySkillMutation();

  const [skillId, setSkillId] = useState('');
  const [level, setLevel] = useState('3');
  const [years, setYears] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    if (!skillId) return;
    const parsedLevel = Number.parseInt(level, 10);
    if (!Number.isInteger(parsedLevel) || parsedLevel < 1 || parsedLevel > 5) return;
    const parsedYears = years === '' ? undefined : Number.parseInt(years, 10);
    if (parsedYears !== undefined && (!Number.isInteger(parsedYears) || parsedYears < 0)) return;
    try {
      await add.mutateAsync({
        skillId,
        level: parsedLevel,
        yearsOfExperience: parsedYears,
        isPrimary,
      });
      setSkillId('');
      setLevel('3');
      setYears('');
      setIsPrimary(false);
    } catch {
      // Global mutation meta surfaces the failure toast.
    }
  }

  async function onTogglePrimary(rowId: string, next: boolean) {
    try {
      await update.mutateAsync({ skillId: rowId, input: { isPrimary: next } });
    } catch {
      // Global mutation meta surfaces the failure toast.
    }
  }

  async function onRemove(rowId: string) {
    try {
      await remove.mutateAsync(rowId);
    } catch {
      // Global mutation meta surfaces the failure toast.
    }
  }

  const busy = add.isPending || update.isPending || remove.isPending;
  const skills = skillsQuery.data ?? [];
  const lookup = lookupQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  return (
    <SectionCard
      id="profile-skills"
      title={t('profile.skillsTitle')}
      description={t('profile.skillsHint')}
      testId="profile-skills"
    >
      <div className="flex flex-col gap-4">
        {skillsQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {skillsQuery.isError ? (
          <p role="alert" className="text-sm text-status-error">
            {t('shared.loadError')}
          </p>
        ) : null}
        {skills.length === 0 && !skillsQuery.isPending ? (
          <p data-testid="skills-empty" className="text-sm text-ink-muted">
            {t('profile.noSkills')}
          </p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {skills.map((skill) => {
            const rowId = skill._id ?? skill.skillId ?? '';
            const name =
              localizedName(
                {
                  nameAr: skill.nameAr,
                  nameFr: skill.nameFr,
                },
                activeLocale,
              ) || t('profile.unknownSkill');
            const categoryName = localizedName(
              {
                nameAr: skill.categoryNameAr,
                nameFr: skill.categoryNameFr,
              },
              activeLocale,
            );
            return (
              <li
                key={rowId}
                data-testid="skill-row"
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{name}</p>
                  <p className="text-sm text-ink-muted">
                    {categoryName ? `${categoryName} · ` : ''}
                    {t('profile.levelLabel')}: {skill.level ?? '–'}
                    {typeof skill.yearsOfExperience === 'number'
                      ? ` · ${t('profile.yearsValue', { years: skill.yearsOfExperience })}`
                      : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={`skill-primary-${rowId}`}
                    label={t('profile.primaryLabel')}
                    checked={skill.isPrimary ?? false}
                    onChange={(event) => onTogglePrimary(rowId, event.target.checked)}
                    disabled={busy}
                  />
                  <button
                    type="button"
                    onClick={() => onRemove(rowId)}
                    disabled={busy}
                    className="text-sm font-medium text-status-error disabled:opacity-50"
                  >
                    {t('profile.removeSkill')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <form onSubmit={onAdd} className="flex flex-col gap-3 border-t border-border pt-4" noValidate>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Select
              id="skill-category"
              label={t('profile.skillCategoryLabel')}
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setSkillId('');
              }}
              options={[
                { value: '', label: t('profile.selectPlaceholder') },
                ...categories.map((category) => ({
                  value: category.id ?? category._id ?? '',
                  label: localizedName(category, activeLocale),
                })),
              ]}
            />
            <Select
              id="skill-pick"
              label={t('profile.skillLabel')}
              value={skillId}
              onChange={(event) => setSkillId(event.target.value)}
              options={[
                { value: '', label: t('profile.selectPlaceholder') },
                ...lookup.map((skill) => ({
                  value: skill.id ?? skill._id ?? skill.skillId ?? '',
                  label: localizedName(skill, activeLocale),
                })),
              ]}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              id="skill-level"
              label={t('profile.levelLabel')}
              type="number"
              min={1}
              max={5}
              value={level}
              onChange={(event) => setLevel(event.target.value)}
            />
            <Input
              id="skill-years"
              label={t('profile.yearsLabel')}
              type="number"
              min={0}
              value={years}
              onChange={(event) => setYears(event.target.value)}
            />
          </div>
          <Checkbox
            id="skill-primary-new"
            label={t('profile.primaryLabel')}
            checked={isPrimary}
            onChange={(event) => setIsPrimary(event.target.checked)}
          />
          <div>
            <Button type="submit" disabled={busy || !skillId}>
              {t('profile.addSkill')}
            </Button>
          </div>
        </form>
      </div>
    </SectionCard>
  );
}
