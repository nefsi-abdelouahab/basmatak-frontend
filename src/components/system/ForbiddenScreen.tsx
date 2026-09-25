'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { SystemScreen, secondaryActionClass } from './SystemScreen';

// Backend 403 variants: FORBIDDEN / ACCOUNT_SUSPENDED / ACCOUNT_INACCESSIBLE /
// EMAIL_NOT_VERIFIED — each renders its own sub-state, never a collapsed 403.
const VARIANT_BY_CODE: Record<string, 'forbidden' | 'suspended' | 'inaccessible' | 'emailNotVerified'> = {
  FORBIDDEN: 'forbidden',
  ACCOUNT_SUSPENDED: 'suspended',
  ACCOUNT_INACCESSIBLE: 'inaccessible',
  EMAIL_NOT_VERIFIED: 'emailNotVerified',
};

export function ForbiddenScreen({ code }: { code?: string }) {
  const t = useTranslations('system');
  const c = useTranslations('common');
  const variant = (code && VARIANT_BY_CODE[code]) || 'forbidden';

  return (
    <SystemScreen
      testId="system-forbidden"
      code={code ?? '403'}
      title={t(`${variant}.title`)}
      description={t(`${variant}.description`)}
      actions={
        <Link href="/" className={secondaryActionClass}>
          {c('actions.goHome')}
        </Link>
      }
    />
  );
}
