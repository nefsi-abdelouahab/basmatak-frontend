'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Select } from '@/components/ui/Select';
import {
  useAddMySkillMutation,
  useDeleteMySkillMutation,
  useMySkillsQuery,
  useSkillCategoriesQuery,
  useSkillsLookupQuery,
  useUpdateMySkillMutation,
} from '@/hooks/useVolunteerAccount';
import { SectionError } from '../components';

function skillName(skill: { nameFr?: string; nameAr?: string; name?: string }, locale: string) {
  if (locale === 'ar') return skill.nameAr ?? skill.nameFr ?? skill.name ?? '';
  return skill.nameFr ?? skill.name ?? skill.nameAr ?? '';
}

export function SkillsManager({ locale }: { locale: string }) {
  const t = useTranslations('volunteerAccount');
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
      // surfaced below via add.isError
    }
  }

  async function onTogglePrimary(id: string, next: boolean) {
    try {
      await update.mutateAsync({ skillId: id, input: { isPrimary: next } });
    } catch {
      // surfaced below via update.isError
    }
  }

  async function onRemove(id: string) {
    try {
      await remove.mutateAsync(id);
    } catch {
      // surfaced below via remove.isError
    }
  }

  const busy = add.isPending || update.isPending || remove.isPending;
  const skills = skillsQuery.data ?? [];
  const lookup = lookupQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  return (
    <Card title={t('profile.skillsTitle')}>
      <div data-testid="profile-skills" className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">{t('profile.skillsHint')}</p>
        {skillsQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {skills.length === 0 && !skillsQuery.isPending ? (
          <p data-testid="skills-empty" className="text-sm text-ink-muted">
            {t('profile.noSkills')}
          </p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {skills.map((s) => {
            const key = s.id ?? s.skillId ?? '';
            return (
              <li
                key={key}
                data-testid="skill-row"
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <span className="text-sm font-medium text-ink">
                  {key} · {t('profile.levelLabel')}: {s.level ?? '–'}
                </span>
                <span className="flex items-center gap-3">
                  <Checkbox
                    id={`skill-primary-${key}`}
                    label={t('profile.primaryLabel')}
                    checked={s.isPrimary ?? false}
                    onChange={(e) => onTogglePrimary(key, e.target.checked)}
                    disabled={busy}
                  />
                  <button
                    type="button"
                    onClick={() => onRemove(key)}
                    disabled={busy}
                    className="text-sm font-medium text-status-error disabled:opacity-50"
                  >
                    {t('profile.removeSkill')}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
        <form onSubmit={onAdd} className="flex flex-col gap-3" noValidate>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Select
              id="skill-category"
              label={t('profile.skillLabel')}
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setSkillId('');
              }}
              options={[
                { value: '', label: '—' },
                ...categories.map((c) => ({
                  value: c.id ?? c._id ?? '',
                  label: skillName(c, locale),
                })),
              ]}
            />
            <Select
              id="skill-pick"
              label={t('profile.skillLabel')}
              value={skillId}
              onChange={(e) => setSkillId(e.target.value)}
              options={[
                { value: '', label: '—' },
                ...lookup.map((s) => ({
                  value: s.id ?? s._id ?? s.skillId ?? '',
                  label: skillName(s, locale),
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
              onChange={(e) => setLevel(e.target.value)}
            />
            <Input
              id="skill-years"
              label={t('profile.yearsLabel')}
              type="number"
              min={0}
              value={years}
              onChange={(e) => setYears(e.target.value)}
            />
          </div>
          <Checkbox
            id="skill-primary-new"
            label={t('profile.primaryLabel')}
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.target.checked)}
          />
          {add.isError || update.isError || remove.isError ? (
            <SectionError testId="skills-error" message={t('shared.genericError')} />
          ) : null}
          <div>
            <Button type="submit" disabled={busy || !skillId}>
              {t('profile.addSkill')}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}
