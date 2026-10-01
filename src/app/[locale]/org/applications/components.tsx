'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  Undo2,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { usePublicMediaQuery } from '@/hooks/usePublicTalent';
import { mediaUrlOf } from '@/lib/api/publicTalent';
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

// Square status-filter boxes (h-8, rounded-md = 8px per theme tokens) with a
// per-status icon and primary-color active fill. Same visual contract as the
// volunteer My Applications filter tabs (icon + label, horizontally
// scrollable on narrow screens); same test contract as TabBar
// (`{testId}` / `tab-{value}` testIDs, tablist/tab roles, aria-selected).
// New shared component — no existing screen's appearance changes.
export function StatusFilterTabs({
  tabs,
  active,
  onTab,
  testId,
}: {
  tabs: { value: string; label: string; Icon: LucideIcon }[];
  active: string;
  onTab: (value: string) => void;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      role="tablist"
      aria-label={testId}
      className="flex items-center gap-2 overflow-x-auto pb-1"
    >
      {tabs.map((tab) => {
        const selected = active === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            data-testid={`tab-${tab.value}`}
            onClick={() => onTab(tab.value)}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-label-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              selected
                ? 'bg-primary text-white'
                : 'bg-surface-muted text-ink-muted hover:bg-border-muted hover:text-ink'
            }`}
          >
            <tab.Icon size={16} aria-hidden="true" className="shrink-0" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Shared two-pane (list | detail) layout for the org review screens — the
// single place the split behavior lives, so both consumers stay identical:
// - Desktop (lg+): the grid is capped to the viewport below the navbar
//   (same 7rem offset as the sidebar/volunteer pattern) and each pane
//   scrolls independently with visually hidden scrollbars + overscroll
//   containment. Below lg the document scrolls normally.
// - Mobile: list-only until a row is selected, then detail-only with a
//   "back to list" control (same view-state toggle the org Applications
//   screen established). Inner card styling stays per-screen: this component
//   owns layout/scroll/visibility only, via listClassName/detailClassName.
export function MasterDetail({
  listLabel,
  detailLabel,
  list,
  detail,
  listClassName = '',
  detailClassName = '',
  hasSelection,
  onBack,
  backLabel,
}: {
  listLabel: string;
  detailLabel: string;
  list: ReactNode;
  detail: ReactNode;
  listClassName?: string;
  detailClassName?: string;
  hasSelection: boolean;
  onBack: () => void;
  backLabel: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:h-[calc(100dvh-7rem)] lg:grid-cols-12 lg:items-stretch lg:overflow-hidden">
      <section
        aria-label={listLabel}
        className={`min-w-0 lg:col-span-5 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:[-ms-overflow-style:none] lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden ${listClassName} ${
          hasSelection ? 'hidden lg:block' : ''
        }`}
      >
        {list}
      </section>
      <div
        aria-label={detailLabel}
        className={`min-w-0 lg:col-span-7 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:[-ms-overflow-style:none] lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden ${detailClassName} ${
          hasSelection ? '' : 'hidden lg:block'
        }`}
      >
        {hasSelection ? (
          <button
            type="button"
            onClick={onBack}
            data-testid="master-detail-back"
            className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline lg:hidden"
          >
            <ArrowLeft size={16} aria-hidden="true" className="rtl:rotate-180" />
            <span>{backLabel}</span>
          </button>
        ) : null}
        {detail}
      </div>
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

// Status indicator without any pill/badge box: the word "Status" followed by
// a small status icon + plain label. Icon/color mapping mirrors the
// volunteer side (My Applications DetailStatusLine / My Participations
// statusMeta) with DESIGN.md status colors: pending amber, accepted green,
// rejected red, withdrawn muted.
const APPLICATION_STATUS_META: Record<string, { Icon: LucideIcon; tone: string }> = {
  pending: { Icon: Clock, tone: 'text-status-pending' },
  under_review: { Icon: Eye, tone: 'text-status-pending' },
  accepted: { Icon: CheckCircle2, tone: 'text-status-success' },
  rejected: { Icon: XCircle, tone: 'text-status-error' },
  withdrawn: { Icon: Undo2, tone: 'text-ink-muted' },
};

export function ApplicationStatusLine({ status, label }: { status: string; label: string }) {
  const t = useTranslations('orgReview');
  const meta = APPLICATION_STATUS_META[status];
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs">
      <span className="font-medium text-ink-muted">{t('shared.statusLabel')}</span>
      {meta ? (
        <meta.Icon size={14} aria-hidden="true" className={`shrink-0 ${meta.tone}`} />
      ) : null}
      <span className={`font-medium ${meta?.tone ?? 'text-ink-muted'}`}>{label}</span>
    </span>
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

// Applicant display name: the inbox joiner ships `fullName` (not first/last
// parts), so prefer it before the generic join fallbacks. Never empty —
// falls back to the username, never an invented label.
export function inboxApplicantName(
  join: Parameters<typeof joinName>[0] & { fullName?: string | null } | null | undefined,
  locale: string,
): string {
  if (!join) return '—';
  if (typeof join.fullName === 'string' && join.fullName.length > 0) return join.fullName;
  return joinName(join, locale);
}

export function inboxAvatarMediaId(join: unknown): string | null {
  if (!join || typeof join !== 'object') return null;
  const id = (join as { avatarMediaId?: unknown }).avatarMediaId;
  return typeof id === 'string' && id !== '' ? id : null;
}

// Person avatar for applicant rows: real photo when the access-controlled
// media read resolves, public/user.jpg otherwise. Never hidden, never a
// broken-image placeholder. An opted-out or missing photo resolves to the
// neutral fallback (no photo leaks — the read itself enforces visibility).
export function ApplicantAvatar({
  mediaId,
  name,
  size,
  testId,
}: {
  mediaId: string | null;
  name: string;
  size: number;
  testId?: string;
}) {
  const [failed, setFailed] = useState(false);
  const mediaQuery = usePublicMediaQuery(mediaId);
  const resolved = failed ? null : mediaUrlOf(mediaQuery.data);
  const src = resolved ?? '/user.jpg';
  return (
    // eslint-disable-next-line @next/next/no-img-element -- access-controlled media URL with local fallback
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      data-testid={testId}
      onError={() => {
        if (!failed) setFailed(true);
      }}
      className="shrink-0 rounded-full bg-surface-muted object-cover"
      style={{ width: size, height: size }}
    />
  );
}
