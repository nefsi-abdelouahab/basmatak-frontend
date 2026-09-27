'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import {
  copyOrgVerificationLink,
  useOrgAttestationDownloadMutation,
} from '@/hooks/useOrgRecords';
import { buildVerifyDeepLink, type OrgExperienceRow } from '@/lib/api/orgRecords';

function formatDate(iso: string, locale: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(time));
}

// One verified experience record: verified-on line + inline code +
// EXP-registryId + visibility display, verify-link copy, attestation
// download, embedded org-authored review. No ledger/SHA copy, no audio,
// no volunteer-name invention (the org-list payload carries no volunteer
// join — record identity only).
export function OrgRecordCard({
  record,
  locale,
}: {
  record: OrgExperienceRow;
  locale: string;
}) {
  const t = useTranslations('orgRecords');
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'fallback'>('idle');
  const [downloadError, setDownloadError] = useState(false);
  const attestationMutation = useOrgAttestationDownloadMutation();

  const deepLink = buildVerifyDeepLink(record.verificationCode);

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
    <Card>
      <article data-testid="org-record-card" data-id={record.id} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-ink">{record.title}</h3>
            <p className="mt-1 text-sm text-status-success">
              {t('archive.verifiedOn', { date: formatDate(record.verifiedAt, locale) })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="neutral">
              {t('archive.codeLabel')}: {record.verificationCode}
            </Pill>
            <Pill tone="neutral">{record.registryId}</Pill>
            <Pill tone={record.publicVisibility === 'public' ? 'success' : 'neutral'}>
              {t('archive.visibilityDisplayLabel')}:{' '}
              {record.publicVisibility === 'public'
                ? t('archive.visibilityPublic')
                : t('archive.visibilityPrivate')}
            </Pill>
          </div>
        </div>
        {record.description ? (
          <p className="text-sm text-ink-muted">{record.description}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-muted">
          <span data-testid={`org-duration-${record.id}`}>
            {t('archive.durationLabel', { minutes: record.duration })}
          </span>
        </div>
        {record.review ? (
          <p className="text-sm text-ink-muted">
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
            {t('archive.copyLink')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid={`org-download-${record.id}`}
            disabled={attestationMutation.isPending}
            onClick={onDownload}
          >
            {attestationMutation.isPending ? t('shared.downloading') : t('archive.attestationCta')}
          </Button>
        </div>
        {copyState === 'done' ? (
          <p data-testid={`org-copied-${record.id}`} role="status" className="text-sm text-status-success">
            {t('archive.copied')}
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
      </article>
    </Card>
  );
}
