'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { SystemScreen, secondaryActionClass } from './SystemScreen';

// Driven by GET /system/status (maintenance flag); guarded reads 503 otherwise.
export function MaintenanceScreen({ message }: { message?: string }) {
  const t = useTranslations('system');
  const c = useTranslations('common');

  return (
    <SystemScreen
      testId="system-maintenance"
      code="503"
      title={t('maintenance.title')}
      description={message || t('maintenance.description')}
      actions={
        <Link href="/" className={secondaryActionClass}>
          {c('actions.goHome')}
        </Link>
      }
    />
  );
}
