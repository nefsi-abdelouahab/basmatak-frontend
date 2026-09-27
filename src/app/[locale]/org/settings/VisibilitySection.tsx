'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { useOrgAccountQuery, usePatchOrgAccountMutation } from '@/hooks/useOrgAccount';
import { SectionError, Toggle } from './components';

// Neutral org visibility: publicProfile.enabled only. Orgs are not in the
// talent directory, so no directory wording appears here.
export function VisibilitySection() {
  const t = useTranslations('orgAccount');
  const orgQuery = useOrgAccountQuery();
  const patch = usePatchOrgAccountMutation();
  const [saved, setSaved] = useState(false);

  if (orgQuery.isPending) {
    return (
      <Card title={t('settings.visibilityTitle')}>
        <Loader label={t('shared.loading')} />
      </Card>
    );
  }
  if (orgQuery.isError || !orgQuery.data) {
    return (
      <Card title={t('settings.visibilityTitle')}>
        <SectionError testId="visibility-error" message={t('shared.loadError')} />
      </Card>
    );
  }
  const enabled = orgQuery.data.publicProfile?.enabled ?? true;

  async function onToggle(next: boolean) {
    setSaved(false);
    try {
      await patch.mutateAsync({ publicProfile: { enabled: next } });
      setSaved(true);
    } catch {
      // surfaced below via patch.isError
    }
  }

  return (
    <Card title={t('settings.visibilityTitle')}>
      <div data-testid="settings-visibility" className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{t('settings.visibilityHint')}</p>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
          <span className="text-sm text-ink">
            {enabled ? t('settings.visibilityOn') : t('settings.visibilityOff')}
          </span>
          <Toggle
            checked={enabled}
            onChange={onToggle}
            label={t('settings.visibilityTitle')}
            testId="visibility-toggle"
          />
        </div>
        {patch.isError ? (
          <SectionError testId="visibility-error" message={t('shared.genericError')} />
        ) : null}
        {saved && !patch.isError ? (
          <p data-testid="visibility-saved" className="text-sm text-status-success">
            {t('settings.visibilitySaved')}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
