'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import {
  PUBLIC_TOGGLE_KEYS,
  type PublicToggleKey,
} from '@/lib/api/volunteers';
import {
  usePatchPublicSettingsMutation,
  useVolunteerMeQuery,
} from '@/hooks/useVolunteerAccount';
import { SectionError, Toggle } from '../components';

// Opt-out panel (OQ2 copy): every toggle renders ON by default
// (public-by-default); switching off hides the block. Toggles are read from
// GET /volunteers/me (no backend GET public-settings) and written via
// PATCH /volunteers/me/public-settings.
export function VisibilityToggles() {
  const t = useTranslations('volunteerAccount');
  const meQuery = useVolunteerMeQuery();
  const patch = usePatchPublicSettingsMutation();

  if (meQuery.isPending) {
    return (
      <Card title={t('profile.visibilityTitle')}>
        <Loader label={t('shared.loading')} />
      </Card>
    );
  }

  const flags = meQuery.data?.publicProfile ?? {};

  async function onToggle(key: PublicToggleKey, next: boolean) {
    try {
      await patch.mutateAsync({ publicProfile: { [key]: next } });
    } catch {
      // surfaced below via patch.isError
    }
  }

  return (
    <Card title={t('profile.visibilityTitle')}>
      <div data-testid="profile-visibility" className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{t('profile.visibilityHint')}</p>
        <ul className="flex flex-col gap-2">
          {PUBLIC_TOGGLE_KEYS.map((key) => (
            <li
              key={key}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <span className="text-sm text-ink">
                {t('profile.showPublicly', { field: t(`toggles.${key}`) })}
              </span>
              <Toggle
                checked={flags[key] ?? true}
                onChange={(next) => onToggle(key, next)}
                label={t('profile.showPublicly', { field: t(`toggles.${key}`) })}
                testId={`toggle-${key}`}
              />
            </li>
          ))}
        </ul>
        {patch.isError ? (
          <SectionError testId="visibility-error" message={t('shared.genericError')} />
        ) : null}
        {patch.isPending ? (
          <div>
            <Button type="button" variant="secondary" disabled>
              {t('shared.saving')}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
