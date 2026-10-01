'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { DAY_KEYS, emptyAvailability, type Availability } from '@/lib/api/volunteers';
import { useMyAvailabilityQuery, usePutMyAvailabilityMutation } from '@/hooks/useVolunteerAccount';
import { SectionError } from '../components';
import { SettingsCard } from './settings-ui';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Design Availability section, wired to the real weekly-availability
// contract (same endpoints as the profile availability editor, reused here).
export function AvailabilitySection() {
  const t = useTranslations('volunteerAccount');
  const availQuery = useMyAvailabilityQuery();
  const put = usePutMyAvailabilityMutation();
  const [draft, setDraft] = useState<Availability | null>(null);
  const [saved, setSaved] = useState(false);

  if (availQuery.isPending) {
    return (
      <SettingsCard id="section-availability" title={t('profile.availabilityTitle')}>
        <Loader label={t('shared.loading')} />
      </SettingsCard>
    );
  }
  if (availQuery.isError) {
    return (
      <SettingsCard id="section-availability" title={t('profile.availabilityTitle')}>
        <SectionError testId="settings-availability-error" message={t('shared.loadError')} />
      </SettingsCard>
    );
  }
  const current: Availability = draft ?? availQuery.data ?? emptyAvailability();

  function setSlot(day: (typeof DAY_KEYS)[number], index: number, field: 'from' | 'to', val: string) {
    setSaved(false);
    setDraft((prev) => {
      const base = prev ?? availQuery.data ?? emptyAvailability();
      const slots = [...base[day]];
      slots[index] = { ...slots[index], [field]: val };
      return { ...base, [day]: slots };
    });
  }

  function addSlot(day: (typeof DAY_KEYS)[number]) {
    setSaved(false);
    setDraft((prev) => {
      const base = prev ?? availQuery.data ?? emptyAvailability();
      return { ...base, [day]: [...base[day], { from: '09:00', to: '12:00' }] };
    });
  }

  function removeSlot(day: (typeof DAY_KEYS)[number], index: number) {
    setSaved(false);
    setDraft((prev) => {
      const base = prev ?? availQuery.data ?? emptyAvailability();
      return { ...base, [day]: base[day].filter((_, i) => i !== index) };
    });
  }

  const valid = DAY_KEYS.every((day) =>
    current[day].every((s) => HHMM.test(s.from) && HHMM.test(s.to)),
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setSaved(false);
    try {
      await put.mutateAsync(current);
      setDraft(null);
      setSaved(true);
    } catch {
      // surfaced below via put.isError
    }
  }

  return (
    <SettingsCard
      id="section-availability"
      title={t('profile.availabilityTitle')}
      hint={t('profile.availabilityHint')}
    >
      <form data-testid="settings-availability" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {DAY_KEYS.map((day) => (
          <fieldset key={day} className="flex flex-col gap-2 rounded-lg bg-surface-muted p-3.5">
            <legend className="px-1 text-label-sm font-semibold text-ink">{t(`days.${day}`)}</legend>
            {current[day].map((slot, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <Input
                  id={`settings-avail-${day}-${i}-from`}
                  label={t('profile.slotFrom')}
                  type="time"
                  value={slot.from}
                  onChange={(e) => setSlot(day, i, 'from', e.target.value)}
                />
                <Input
                  id={`settings-avail-${day}-${i}-to`}
                  label={t('profile.slotTo')}
                  type="time"
                  value={slot.to}
                  onChange={(e) => setSlot(day, i, 'to', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeSlot(day, i)}
                  className="pb-2 text-label-sm font-medium text-status-error"
                >
                  {t('profile.removeSlot')}
                </button>
              </div>
            ))}
            <div>
              <button
                type="button"
                onClick={() => addSlot(day)}
                className="text-label-sm font-medium text-primary"
              >
                {t('profile.addSlot')}
              </button>
            </div>
          </fieldset>
        ))}
        {put.isError ? (
          <SectionError testId="settings-availability-error" message={t('shared.genericError')} />
        ) : null}
        {saved && !put.isError ? (
          <p data-testid="settings-availability-saved" className="text-body-sm text-status-success">
            {t('shared.saved')}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={put.isPending || !valid}>
            {put.isPending ? t('shared.saving') : t('shared.save')}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}
