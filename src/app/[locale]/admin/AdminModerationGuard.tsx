'use client';

import { useEffect, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Loader } from '@/components/ui/Loader';
import { getLoginHref, useSessionQuery } from '@/hooks/useSession';

// F16-owned route-local guard for admin/reports + admin/settings. Mirrors
// the F12 route-local guard pattern without editing other files.
// Guest guard (decision 10): unauthenticated visits redirect to Login.
// Non-admin roles see the shared neutral 403 state (no data fetched).
export function RequireAdminModeration({
  locale,
  next,
  children,
}: {
  locale: string;
  next: string;
  children: ReactNode;
}) {
  const t = useTranslations('adminModeration');
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
        data-testid="admin-moderation-forbidden"
        className="mx-auto flex w-full max-w-3xl flex-col gap-2 p-4"
      >
        <h1 className="text-2xl font-bold text-ink">{t('shared.forbiddenTitle')}</h1>
        <p className="text-sm text-ink-muted">{t('shared.forbiddenDescription')}</p>
      </div>
    );
  }
  return <>{children}</>;
}
