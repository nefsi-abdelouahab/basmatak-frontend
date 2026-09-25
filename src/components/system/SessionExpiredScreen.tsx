'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { SystemScreen, primaryActionClass, secondaryActionClass } from './SystemScreen';

// 401 structure lives here; the sign-in copy/route it points at ships in F1.
export function SessionExpiredScreen() {
  const t = useTranslations('system');
  const c = useTranslations('common');

  return (
    <SystemScreen
      testId="system-session-expired"
      code="401"
      title={t('sessionExpired.title')}
      description={t('sessionExpired.description')}
      actions={
        <>
          <Link href="/login" className={primaryActionClass}>
            {c('actions.signIn')}
          </Link>
          <Link href="/" className={secondaryActionClass}>
            {c('actions.goHome')}
          </Link>
        </>
      }
    />
  );
}
