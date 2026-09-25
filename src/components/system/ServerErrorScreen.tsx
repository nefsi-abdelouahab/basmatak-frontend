'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '../ui/Button';
import { SystemScreen, secondaryActionClass } from './SystemScreen';

export function ServerErrorScreen({ onRetry }: { onRetry?: () => void }) {
  const t = useTranslations('system');
  const c = useTranslations('common');

  return (
    <SystemScreen
      testId="system-server-error"
      code="500"
      title={t('serverError.title')}
      description={t('serverError.description')}
      actions={
        <>
          {onRetry ? (
            <Button type="button" onClick={onRetry}>
              {c('actions.retry')}
            </Button>
          ) : null}
          <Link href="/" className={secondaryActionClass}>
            {c('actions.goHome')}
          </Link>
        </>
      }
    />
  );
}
