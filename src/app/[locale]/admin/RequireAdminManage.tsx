'use client';

import { useEffect, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { getLoginHref, useSessionQuery } from '@/hooks/useSession';

// F15-owned route-local admin guard for every admin/* route. Mirrors the
// F9–F13 route-local guard pattern without editing other files.
// Guest guard (decision 10): unauthenticated visits redirect to Login.
// Non-admin roles render the 403 state (never the tables).
export function RequireAdminManage({
  locale,
  next,
  children,
}: {
  locale: string;
  next: string;
  children: ReactNode;
}) {
  const t = useTranslations('adminManage');
  const session = useSessionQuery();
  const router = useRouter();

  useEffect(() => {
    if (session.isError) router.replace(getLoginHref(locale, next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isError, router, locale]);

  if (session.isPending) return <Loader label={t('shared.loading')} />;
  if (session.isError) return null;
  if (session.data?.role !== 'admin') {
    return (
      <div
        data-testid="admin-forbidden"
        className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4"
      >
        <Card title={t('guard.forbiddenTitle')}>
          <p className="text-sm text-ink-muted">{t('guard.forbiddenBody')}</p>
        </Card>
      </div>
    );
  }
  return <>{children}</>;
}
