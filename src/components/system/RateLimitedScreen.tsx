'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { SystemScreen, secondaryActionClass } from './SystemScreen';

// 429 structure only: throttle buckets and resend/retry wiring land in FB/F1.
export function RateLimitedScreen() {
  const t = useTranslations('system');
  const c = useTranslations('common');

  return (
    <SystemScreen
      testId="system-rate-limited"
      code="429"
      title={t('rateLimited.title')}
      description={t('rateLimited.description')}
      actions={
        <Link href="/" className={secondaryActionClass}>
          {c('actions.goHome')}
        </Link>
      }
    />
  );
}
