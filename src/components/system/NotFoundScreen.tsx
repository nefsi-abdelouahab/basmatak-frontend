'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { SystemScreen, secondaryActionClass } from './SystemScreen';

export function NotFoundScreen() {
  const t = useTranslations('system');
  const c = useTranslations('common');

  return (
    <SystemScreen
      testId="system-not-found"
      code="404"
      title={t('notFound.title')}
      description={t('notFound.description')}
      actions={
        <Link href="/" className={secondaryActionClass}>
          {c('actions.goHome')}
        </Link>
      }
    />
  );
}
