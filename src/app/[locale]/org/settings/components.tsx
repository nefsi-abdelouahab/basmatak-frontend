'use client';

import { useEffect, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Loader } from '@/components/ui/Loader';
import { useSessionQuery, getLoginHref } from '@/hooks/useSession';

// Route-local shared bits for org/settings (F13-owned). Mirrors the F2
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

export function Toggle({
  checked,
  onChange,
  label,
  testId,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        checked ? 'justify-end bg-primary' : 'justify-start bg-border-muted'
      }`}
    >
      <span className="h-5 w-5 rounded-full bg-surface shadow" />
    </button>
  );
}
