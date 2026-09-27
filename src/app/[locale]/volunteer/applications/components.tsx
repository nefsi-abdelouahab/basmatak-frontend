'use client';

import { useEffect, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { useSessionQuery, getLoginHref } from '@/hooks/useSession';
import { useVolunteerActivityQuery } from '@/hooks/useTasks';
import type { TimelineStepState } from '@/lib/api/tasks';

// F6-owned route-local shared bits for volunteer/applications +
// volunteer/tasks (both dirs belong to this session). Mirrors the F2
// volunteer/components guard pattern without editing F2-owned files.

// Guest guard (decision 10): unauthenticated visits redirect to Login.
export function RequireTasks({
  locale,
  next,
  children,
}: {
  locale: string;
  next: string;
  children: ReactNode;
}) {
  const t = useTranslations('volunteerTasks');
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

export function StatusPill({ status, label }: { status: string; label: string }) {
  const tone: PillTone =
    status === 'accepted' || status === 'active' || status === 'completed'
      ? 'success'
      : status === 'pending' || status === 'under_review'
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

export function StatusTimeline({
  steps,
  labels,
  terminalNote,
  testId,
}: {
  steps: TimelineStepState[];
  labels: [string, string, string];
  terminalNote: string | null;
  testId: string;
}) {
  return (
    <div data-testid={testId}>
      <ol className="flex items-center gap-0">
        {steps.map((state, index) => (
          <li key={labels[index]} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                data-testid={`${testId}-step-${index}`}
                data-state={state}
                aria-current={state === 'current' ? 'step' : undefined}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  state === 'done'
                    ? 'bg-status-success text-white'
                    : state === 'current'
                      ? 'bg-primary text-white'
                      : 'bg-border-muted text-ink-muted'
                }`}
              >
                {state === 'done' ? '✓' : index + 1}
              </span>
              <span className="whitespace-nowrap text-xs text-ink-muted">{labels[index]}</span>
            </div>
            {index < steps.length - 1 ? (
              <span
                aria-hidden
                className={`mx-1 h-0.5 w-full ${state === 'done' ? 'bg-status-success' : 'bg-border-muted'}`}
              />
            ) : null}
          </li>
        ))}
      </ol>
      {terminalNote ? (
        <p data-testid={`${testId}-terminal`} role="note" className="mt-2 text-sm text-ink-muted">
          {terminalNote}
        </p>
      ) : null}
    </div>
  );
}

export function ConfirmDialog({
  testId,
  title,
  body,
  confirmLabel,
  cancelLabel,
  pendingLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  testId: string;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  pendingLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      data-testid={testId}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      className="rounded-lg border border-border bg-surface p-4"
    >
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={onConfirm}
          data-testid={`${testId}-confirm`}
        >
          {pending ? pendingLabel : confirmLabel}
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
  } | null | undefined,
  locale: string,
): string {
  if (!join) return '—';
  if (locale === 'ar') return join.nameAr ?? join.nameFr ?? join.name ?? join.title ?? join.slug ?? '—';
  return join.nameFr ?? join.nameAr ?? join.name ?? join.title ?? join.slug ?? '—';
}

export function ActivityStrip({ locale }: { locale: string }) {
  const t = useTranslations('volunteerTasks');
  const activityQuery = useVolunteerActivityQuery();
  return (
    <Card title={t('activity.title')}>
      <div data-testid="activity-strip">
        {activityQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {activityQuery.isError ? (
          <SectionError testId="activity-error" message={t('activity.error')} />
        ) : null}
        {activityQuery.data && activityQuery.data.items.length === 0 ? (
          <p data-testid="activity-empty" className="text-sm text-ink-muted">
            {t('activity.empty')}
          </p>
        ) : null}
        {activityQuery.data && activityQuery.data.items.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {activityQuery.data.items.map((item, index) => (
              <li
                key={item.id ?? item._id ?? index}
                data-testid="activity-item"
                className="flex items-start justify-between gap-3 text-sm"
              >
                <span className="text-ink">
                  {joinName(
                    { name: item.title ?? item.type ?? item.kind ?? undefined },
                    locale,
                  )}
                </span>
                {item.createdAt ? (
                  <time className="shrink-0 text-xs text-ink-muted">
                    {new Date(item.createdAt).toLocaleDateString(locale)}
                  </time>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
}
