'use client';

import { useEffect, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Loader } from '@/components/ui/Loader';
import { useSessionQuery, getLoginHref } from '@/hooks/useSession';

// Route-local shared bits for org/profile (F13-owned). Mirrors the F2
// volunteer pattern read-only: guest visits redirect to Login (decision 10).

export function RequireOrg({
  locale,
  next,
  children,
}: {
  locale: string;
  next: string;
  children: ReactNode;
}) {
  const t = useTranslations('orgAccount');
  const session = useSessionQuery();
  const router = useRouter();

  useEffect(() => {
    if (session.isError) router.replace(getLoginHref(locale, next));
  }, [session.isError, router, locale, next]);

  if (session.isPending) return <Loader label={t('shared.loading')} />;
  if (session.isError) return null;
  return <>{children}</>;
}

export function SectionError({ message, testId }: { message: string; testId: string }) {
  return (
    <p data-testid={testId} role="alert" className="text-sm text-status-error">
      {message}
    </p>
  );
}

export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  return (
    <div
      data-testid="upload-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label}
      className="h-1.5 w-full rounded-full bg-border-muted"
    >
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
