'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Loader } from '@/components/ui/Loader';
import { SaveBar, SectionCard, TimeRangeRow } from '@/components/profile';
import { DAY_KEYS, emptyAvailability, type Availability } from '@/lib/api/volunteers';
import { useMyAvailabilityQuery, usePutMyAvailabilityMutation } from '@/hooks/useVolunteerAccount';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function AvailabilityEditor() {
  const t = useTranslations('volunteerAccount');
  const availQuery = useMyAvailabilityQuery();
  const put = usePutMyAvailabilityMutation();
  const [draft, setDraft] = useState<Availability | null>(null);
  const [invalid, setInvalid] = useState(false);

  if (availQuery.isPending) {
    return (
      <SectionCard id="profile-availability" title={t('profile.availabilityTitle')} testId="profile-availability">
        <Loader label={t('shared.loading')} />
      </SectionCard>
    );
  }
  if (availQuery.isError) {
    return (
      <SectionCard id="profile-availability" title={t('profile.availabilityTitle')} testId="profile-availability">
        <p role="alert" className="text-sm text-status-error">
          {t('shared.loadError')}
        </p>
      </SectionCard>
    );
  }

  const current: Availability = draft ?? availQuery.data ?? emptyAvailability();

  function setSlot(day: (typeof DAY_KEYS)[number], index: number, field: 'from' | 'to', value: string) {
    setInvalid(false);
    setDraft((previous) => {
      const base = previous ?? availQuery.data ?? emptyAvailability();
      const slots = [...base[day]];
      slots[index] = { ...slots[index], [field]: value };
      return { ...base, [day]: slots };
    });
  }

  function addSlot(day: (typeof DAY_KEYS)[number]) {
    setInvalid(false);
    setDraft((previous) => {
      const base = previous ?? availQuery.data ?? emptyAvailability();
      return { ...base, [day]: [...base[day], { from: '09:00', to: '12:00' }] };
    });
  }

  function removeSlot(day: (typeof DAY_KEYS)[number], index: number) {
    setInvalid(false);
    setDraft((previous) => {
      const base = previous ?? availQuery.data ?? emptyAvailability();
      return { ...base, [day]: base[day].filter((_, slotIndex) => slotIndex !== index) };
    });
  }

  const valid = DAY_KEYS.every((day) =>
    current[day].every((slot) => HHMM.test(slot.from) && HHMM.test(slot.to)),
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid) {
      setInvalid(true);
      return;
    }
    try {
      await put.mutateAsync(current);
      setDraft(null);
    } catch {
      // Global mutation meta surfaces the failure toast.
    }
  }

  return (
    <SectionCard
      id="profile-availability"
      title={t('profile.availabilityTitle')}
      description={t('profile.availabilityHint')}
      testId="profile-availability"
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {DAY_KEYS.map((day) => (
          <fieldset key={day} className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-ink">{t(`days.${day}`)}</legend>
            {current[day].length === 0 ? (
              <p className="text-sm text-ink-muted">{t('profile.noSlots')}</p>
            ) : null}
            {current[day].map((slot, index) => (
              <TimeRangeRow
                key={`${day}-${index}`}
                idPrefix={`avail-${day}-${index}`}
                from={slot.from}
                to={slot.to}
                fromLabel={t('profile.slotFrom')}
                toLabel={t('profile.slotTo')}
                removeLabel={t('profile.removeSlot')}
                onChange={(field, value) => setSlot(day, index, field, value)}
                onRemove={() => removeSlot(day, index)}
                disabled={put.isPending}
              />
            ))}
            <div>
              <button
                type="button"
                onClick={() => addSlot(day)}
                disabled={put.isPending}
                className="text-sm font-medium text-gold-strong hover:underline disabled:opacity-50"
              >
                {t('profile.addSlot')}
              </button>
            </div>
          </fieldset>
        ))}
        {invalid ? (
          <p role="alert" className="text-sm text-status-error">
            {t('profile.invalidTime')}
          </p>
        ) : null}
        {put.isError ? (
          <p data-testid="availability-error" role="alert" className="text-sm text-status-error">
            {t('shared.genericError')}
          </p>
        ) : null}
        <SaveBar
          saving={put.isPending}
          saveLabel={t('shared.save')}
          savingLabel={t('shared.saving')}
          disabled={!valid}
        />
      </form>
    </SectionCard>
  );
}
