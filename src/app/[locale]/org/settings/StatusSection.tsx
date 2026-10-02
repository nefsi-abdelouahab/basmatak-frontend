'use client';

import { useTranslations } from 'next-intl';
import { BadgeCheck, Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { useOrgAccountQuery } from '@/hooks/useOrgAccount';
import { SectionError } from './components';

// Account status (code.html §5, cleaned): real status + verification state
// only — GET /organizations/me {status, verificationStatus}. No legal or
// accreditation claims exist anywhere in this section.
export function StatusSection() {
  const t = useTranslations('orgAccount');
  const orgQuery = useOrgAccountQuery();

  if (orgQuery.isPending) {
    return (
      <Card title={t('settings.statusTitle')}>
        <Loader label={t('shared.loading')} />
      </Card>
    );
  }
  if (orgQuery.isError || !orgQuery.data) {
    return (
      <Card title={t('settings.statusTitle')}>
        <SectionError testId="status-error" message={t('shared.loadError')} />
      </Card>
    );
  }
  const org = orgQuery.data;
  const status = org.status === 'suspended' ? t('settings.statusSuspended') : t('settings.statusActive');
  const verification =
    org.verificationStatus === 'verified'
      ? t('profile.verificationVerified')
      : org.verificationStatus === 'rejected'
        ? t('profile.verificationRejected')
        : t('profile.verificationPending');

  return (
    <Card title={t('settings.statusTitle')}>
      <div data-testid="settings-status" className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink">
          <span>
            {t('settings.statusLabel')}: {status}
          </span>
          <Check size={16} aria-hidden="true" className="shrink-0" />
        </p>
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
          <span>
            {t('profile.verificationLabel')}: {verification}
          </span>
          {org.verificationStatus === 'verified' ? (
            <BadgeCheck size={16} aria-hidden="true" className="shrink-0 text-status-success" />
          ) : null}
        </p>
      </div>
    </Card>
  );
}
