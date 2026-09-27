'use client';

import { useEffect, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Loader } from '@/components/ui/Loader';
import { useSessionQuery, getLoginHref } from '@/hooks/useSession';

// Route-local shared bits for volunteer/* (F2-owned). Toggle shape follows
// the Admin Settings code.html pattern (role=switch, rounded-full track +
// knob), token-mapped. ProgressBar is the OQ1-approved thin token bar.

// Guest guard (decision 10): unauthenticated visits redirect to Login.
export function RequireVolunteer({
  locale,
  next,
  children,
}: {
  locale: string;
  next: string;
  children: ReactNode;
}) {
  const t = useTranslations('volunteerAccount');
  const session = useSessionQuery();
  const router = useRouter();

  useEffect(() => {
    if (session.isError) router.replace(getLoginHref(next));
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

// OQ1-approved: thin token-driven determinate bar (+ Loader for indeterminate).
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
