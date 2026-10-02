'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { useOrgAccountQuery, usePatchOrgAccountMutation } from '@/hooks/useOrgAccount';
import { SectionError, Toggle } from './components';

// Privacy & visibility (code.html §4, cleaned): neutral
// publicProfile.enabled only. The design's other three toggles (public
// contact info, public verified activity, Discover Talents indexing) map to
// no real org-visibility field — reported as gaps and omitted, never built.
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
      <div data-testid="settings-visibility" className="flex flex-col gap-2">
        <p className="mb-2 text-sm text-ink-muted">{t('settings.visibilityHint')}</p>
        <div className="flex items-start justify-between gap-6 py-4">
          <div className="min-w-0 flex-1 pe-4">
            <p className="text-sm font-medium text-ink">{t('settings.visibilityPublicTitle')}</p>
            <p className="mt-0.5 text-sm text-ink-muted">{t('settings.visibilityPublicDesc')}</p>
          </div>
          <Toggle
            checked={enabled}
            onChange={onToggle}
            label={t('settings.visibilityPublicTitle')}
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
