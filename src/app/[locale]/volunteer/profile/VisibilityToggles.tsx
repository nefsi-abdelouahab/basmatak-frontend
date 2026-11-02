'use client';

import { useTranslations } from 'next-intl';
import { Loader } from '@/components/ui/Loader';
import { SectionCard, VisibilityRow } from '@/components/profile';
import {
  PUBLIC_TOGGLE_DEFAULTS,
  PUBLIC_TOGGLE_KEYS,
  type PublicToggleKey,
} from '@/lib/api/volunteers';
import {
  usePatchPublicSettingsMutation,
  useVolunteerMeQuery,
} from '@/hooks/useVolunteerAccount';

/**
 * Visibility panel. State always comes from `publicProfile` on
 * `GET /volunteers/me`; backend privacy-safe defaults are shown as-is.
 */
export function VisibilityToggles() {
  const t = useTranslations('volunteerAccount');
  const meQuery = useVolunteerMeQuery();
  const patch = usePatchPublicSettingsMutation();

  if (meQuery.isPending) {
    return (
      <SectionCard id="profile-visibility" title={t('profile.visibilityTitle')}>
        <Loader label={t('shared.loading')} />
      </SectionCard>
    );
  }

  const flags = meQuery.data?.publicProfile ?? {};

  async function onToggle(key: PublicToggleKey, next: boolean) {
    try {
      await patch.mutateAsync({ publicProfile: { [key]: next } });
    } catch {
      // Global mutation meta surfaces the failure toast.
    }
  }

  return (
    <SectionCard
      id="profile-visibility"
      title={t('profile.visibilityTitle')}
      description={t('profile.visibilityHint')}
      testId="profile-visibility"
    >
      <div className="flex flex-col gap-3">
        <ul className="flex flex-col gap-2">
          {PUBLIC_TOGGLE_KEYS.map((key) => (
            <VisibilityRow
              key={key}
              id={`visibility-${key}`}
              label={t(`toggles.${key}`)}
              description={t(`toggleHints.${key}`)}
              checked={flags[key] ?? PUBLIC_TOGGLE_DEFAULTS[key]}
              onChange={(next) => onToggle(key, next)}
              disabled={patch.isPending}
              testId={`toggle-${key}`}
            />
          ))}
        </ul>
        {patch.isError ? (
          <p role="alert" className="text-sm text-status-error">
            {t('shared.genericError')}
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}
