'use client';

import { useTranslations } from 'next-intl';
import { Button } from '../ui/Button';
import { SystemScreen } from './SystemScreen';

export function NetworkErrorScreen({ onRetry }: { onRetry?: () => void }) {
  const t = useTranslations('system');
  const c = useTranslations('common');

  return (
    <SystemScreen
      testId="system-network-error"
      title={t('networkError.title')}
      description={t('networkError.description')}
      actions={
        onRetry ? (
          <Button type="button" onClick={onRetry}>
            {c('actions.retry')}
          </Button>
        ) : undefined
      }
    />
  );
}
