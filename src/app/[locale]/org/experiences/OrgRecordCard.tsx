'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  BadgeCheck,
  CalendarCheck,
  Check,
  Clock,
  Copy,
  Download,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import {
  copyOrgVerificationLink,
  useOrgAttestationDownloadMutation,
} from '@/hooks/useOrgRecords';
import {
  buildVerifyDeepLink,
  type OrgExperienceRow,
} from '@/lib/api/orgRecords';
import { orgDisplayName } from '@/lib/api/experiences';

function formatDate(iso: string, locale: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(time));
}

// Verified-experience list row: record identity only (title, verified date,
// EXP-registryId, duration, volunteer-owned visibility badge, org review
// excerpt). The org list payload carries NO volunteer join, NO opportunity
// join, and NO evidence — so no avatar, no role, no deliverable preview, and
// no invented IDs render here. All neutral copy; nothing unverifiable.
export function OrgRecordCard({
  record,
  locale,
  selected,
  onSelect,
}: {
  record: OrgExperienceRow;
  locale: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations('orgRecords');
  const visibilityPublic = record.publicVisibility === 'public';
  const VisibilityIcon = visibilityPublic ? Eye : EyeOff;

  return (
    <li data-testid="org-record-card" data-id={record.id}>
      <article
        className={`relative rounded-xl border bg-surface p-4 shadow-sm transition-colors ${
          selected ? 'border-primary' : 'border-border hover:bg-surface-muted'
        }`}
      >
        {selected ? (
          <span aria-hidden="true" className="absolute inset-y-3 start-0 w-1 rounded-e bg-primary" />
        ) : null}
        <button
          type="button"
          data-testid={`org-record-select-${record.id}`}
          aria-expanded={selected}
          onClick={onSelect}
          className="flex w-full min-w-0 flex-col gap-2 text-start"
        >
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0 flex-1 truncate text-base font-semibold text-ink">
              {record.title}
            </span>
            {selected ? (
              <span className="shrink-0 text-xs font-medium text-primary">
                {t('list.selected')}
              </span>
            ) : null}
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone="neutral">{record.registryId}</Pill>
            <Pill tone={visibilityPublic ? 'success' : 'neutral'}>
              <span className="inline-flex items-center gap-1">
                <VisibilityIcon size={13} aria-hidden="true" />
                <span>
                  {t('archive.visibilityDisplayLabel')}:{' '}
                  {visibilityPublic ? t('archive.visibilityPublic') : t('archive.visibilityPrivate')}
                </span>
              </span>
            </Pill>
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <CalendarCheck size={14} aria-hidden="true" />
              <span>{t('archive.verifiedOn', { date: formatDate(record.verifiedAt, locale) })}</span>
            </span>
            <span className="inline-flex items-center gap-1" data-testid={`org-duration-${record.id}`}>
              <Clock size={14} aria-hidden="true" />
              <span>{t('archive.durationLabel', { minutes: record.duration })}</span>
            </span>
          </span>
          {record.review ? (
            <span className="truncate text-xs text-ink-muted">
              {t('archive.reviewLabel')}: {record.review.rating}/5
              {record.review.notes ? ` — ${record.review.notes}` : ''}
            </span>
          ) : null}
        </button>
      </article>
    </li>
  );
}

// Detail panel for the selected record: verification details from the same
// row (verifier org identity, verified date, duration, EXP-registryId,
// verification code + inline /verify/:code copy, volunteer-owned visibility
// note, attestation download). No volunteer header (no volunteer join in the
// org payload — no invented names/roles/avatars, no public-profile link
// without a handle), no opportunity card (no opportunity join), no submission
// summary, no evidence player, no asset manifest (evidence lives behind the
// owner-only detail route). Real data only — nothing invented, nothing
// unverifiable.
export function OrgExperienceDetail({
  record,
  locale,
  testIdPrefix,
}: {
  record: OrgExperienceRow;
  locale: string;
  testIdPrefix: string;
}) {
  const t = useTranslations('orgRecords');
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'fallback'>('idle');
  const [downloadError, setDownloadError] = useState(false);
  const attestationMutation = useOrgAttestationDownloadMutation();

  const deepLink = buildVerifyDeepLink(record.verificationCode);
  const visibilityPublic = record.publicVisibility === 'public';
  const VisibilityIcon = visibilityPublic ? Eye : EyeOff;
  const verifierName = orgDisplayName(record.organization, locale);

  const onDownload = () => {
    setDownloadError(false);
    attestationMutation.mutate(record.id, {
      onError: () => setDownloadError(true),
    });
  };

  const onCopy = async () => {
    const ok = await copyOrgVerificationLink(record.verificationCode, deepLink);
    setCopyState(ok ? 'done' : 'fallback');
  };

  return (
    <div data-testid={testIdPrefix} className="flex min-w-0 flex-col gap-6">
      {/* Record header */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-ink">{record.title}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-status-success">
              <BadgeCheck size={16} aria-hidden="true" />
              <span>{t('archive.verifiedOn', { date: formatDate(record.verifiedAt, locale) })}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="neutral">{record.registryId}</Pill>
            <Pill tone={visibilityPublic ? 'success' : 'neutral'}>
              <span className="inline-flex items-center gap-1">
                <VisibilityIcon size={13} aria-hidden="true" />
                <span>
                  {visibilityPublic ? t('archive.visibilityPublic') : t('archive.visibilityPrivate')}
                </span>
              </span>
            </Pill>
          </div>
        </div>
        {record.description ? (
          <p className="text-sm leading-relaxed text-ink">{record.description}</p>
        ) : null}
      </section>

      {/* Verification details (neutral rename of the design's institutional
          box; every unverifiable row from code.html was deleted) */}
      <section
        aria-label={t('detail.verificationTitle')}
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6"
      >
        <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
          <BadgeCheck size={18} aria-hidden="true" className="text-primary" />
          <span>{t('detail.verificationTitle')}</span>
        </h3>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-ink-muted">{t('detail.verifiedBy')}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">{verifierName || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">{t('detail.verifiedOnLabel')}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">{formatDate(record.verifiedAt, locale)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">{t('detail.durationLabel')}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">
              {t('archive.durationLabel', { minutes: record.duration })}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">{t('detail.statusLabel')}</dt>
            <dd className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-status-success">
              <BadgeCheck size={15} aria-hidden="true" />
              <span>{t('detail.statusVerified')}</span>
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-ink-muted">{t('archive.codeLabel')}</dt>
            <dd className="mt-0.5 font-mono text-sm text-ink">{record.verificationCode}</dd>
          </div>
        </dl>
        {record.review ? (
          <p className="rounded-lg bg-surface-muted p-3 text-sm text-ink-muted">
            {t('archive.reviewLabel')}: {record.review.rating}/5
            {record.review.notes ? ` — ${record.review.notes}` : ''}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid={`org-copy-${record.id}`}
            onClick={onCopy}
          >
            <Copy size={14} aria-hidden="true" />
            <span>{t('archive.copyLink')}</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid={`org-download-${record.id}`}
            disabled={attestationMutation.isPending}
            onClick={onDownload}
          >
            <Download size={14} aria-hidden="true" />
            <span>{attestationMutation.isPending ? t('shared.downloading') : t('archive.attestationCta')}</span>
          </Button>
        </div>
        {copyState === 'done' ? (
          <p data-testid={`org-copied-${record.id}`} role="status" className="inline-flex items-center gap-1 text-sm text-status-success">
            <Check size={14} aria-hidden="true" />
            <span>{t('archive.copied')}</span>
          </p>
        ) : null}
        {copyState === 'fallback' ? (
          <p data-testid={`org-copy-fallback-${record.id}`} className="text-sm text-ink-muted">
            {t('archive.copyFallback')} {record.verificationCode} {deepLink}
          </p>
        ) : null}
        {downloadError ? (
          <p data-testid={`org-download-error-${record.id}`} role="alert" className="text-sm text-status-error">
            {t('archive.attestationError')}
          </p>
        ) : null}
      </section>

      {/* Visibility note: real toggle state only (the toggle itself lives on
          the volunteer's own experience — PATCH is volunteer-owned). */}
      <p
        data-testid={`${testIdPrefix}-visibility-note`}
        className="rounded-lg bg-surface-muted p-3 text-xs leading-relaxed text-ink-muted"
      >
        {t('archive.visibilityDisplayLabel')}:{' '}
        {visibilityPublic ? t('archive.visibilityPublic') : t('archive.visibilityPrivate')} ·{' '}
        {t('detail.visibilityNote')}
      </p>
    </div>
  );
}
