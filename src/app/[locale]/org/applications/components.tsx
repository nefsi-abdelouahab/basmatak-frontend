'use client';

import { useEffect, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { useSessionQuery, getLoginHref } from '@/hooks/useSession';

// F11-owned route-local shared bits for org/applications. Mirrors the F6
// volunteer/components guard pattern without editing F6-owned files.

// Guest guard (decision 10): unauthenticated visits redirect to Login.
export function RequireOrg({
  locale,
  next,
  children,
}: {
  locale: string;
  next: string;
  children: ReactNode;
}) {
  const t = useTranslations('orgReview');
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

// Status discipline mirrors F6 (same entities, both sides): success marks
// verification/acceptance states, pending marks in-flight states, error marks
// terminal-negative states. No invented labels — labels come from tabs.*.
export function StatusPill({ status, label }: { status: string; label: string }) {
  const tone: PillTone =
    status === 'accepted' ||
    status === 'active' ||
    status === 'completed' ||
    status === 'verified'
      ? 'success'
      : status === 'pending' || status === 'under_review' || status === 'submitted'
        ? 'pending'
        : status === 'rejected' || status === 'withdrawn' || status === 'removed'
          ? 'error'
          : 'neutral';
  return <Pill tone={tone}>{label}</Pill>;
}

export function TabBar({
  tabs,
  active,
  onTab,
  testId,
}: {
  tabs: { value: string; label: string }[];
  active: string;
  onTab: (value: string) => void;
  testId: string;
}) {
  return (
    <div data-testid={testId} role="tablist" aria-label={testId} className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={active === tab.value}
          data-testid={`tab-${tab.value}`}
          onClick={() => onTab(tab.value)}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            active === tab.value
              ? 'border-primary bg-primary text-white'
              : 'border-border bg-surface text-ink hover:bg-surface-muted'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// Required-reason dialog: confirm stays disabled while the trimmed reason is
// empty (backend RejectDto would 400/422 otherwise). Inline, not a portal.
export function ReasonDialog({
  testId,
  title,
  reasonLabel,
  reasonPlaceholder,
  requiredMessage,
  reason,
  onReason,
  confirmLabel,
  cancelLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  testId: string;
  title: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  requiredMessage: string;
  reason: string;
  onReason: (value: string) => void;
  confirmLabel: string;
  cancelLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const valid = reason.trim().length > 0;
  return (
    <div
      data-testid={testId}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      className="rounded-lg border border-border bg-surface p-4"
    >
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <label htmlFor={`${testId}-reason`} className="mb-1 mt-3 block text-sm font-medium text-ink">
        {reasonLabel}
      </label>
      <textarea
        id={`${testId}-reason`}
        data-testid={`${testId}-reason`}
        rows={3}
        value={reason}
        onChange={(event) => onReason(event.target.value)}
        placeholder={reasonPlaceholder}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
      />
      {!valid ? (
        <p data-testid={`${testId}-required`} className="mt-1 text-sm text-status-error">
          {requiredMessage}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={pending || !valid}
          onClick={onConfirm}
          data-testid={`${testId}-confirm`}
        >
          {confirmLabel}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}

// Locale-aware display name for backend join embeds (fr/ar + generic).
export function joinName(
  join: {
    nameFr?: string | null;
    nameAr?: string | null;
    name?: string | null;
    title?: string | null;
    slug?: string | null;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null | undefined,
  locale: string,
): string {
  if (!join) return '—';
  const nameParts = [join.firstName, join.lastName].filter(
    (part): part is string => typeof part === 'string' && part.length > 0,
  );
  const fullName = nameParts.length > 0 ? nameParts.join(' ') : undefined;
  if (locale === 'ar') {
    return (
      join.nameAr ?? fullName ?? join.nameFr ?? join.name ?? join.title ?? join.username ?? join.slug ?? '—'
    );
  }
  return (
    join.nameFr ?? fullName ?? join.nameAr ?? join.name ?? join.title ?? join.username ?? join.slug ?? '—'
  );
}
