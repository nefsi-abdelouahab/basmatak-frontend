'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { Pill } from '@/components/ui/Pill';
import {
  copyVerificationLink,
  useAttestationDownloadMutation,
  useExperienceDetailQuery,
  usePatchExperienceVisibilityMutation,
} from '@/hooks/useExperiences';
import { orgDisplayName, type EnrichedExperience } from '@/lib/api/experiences';
import { SectionError, Toggle } from '../components';

function formatDate(iso: string, locale: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(time));
}

function EvidenceList({ experienceId }: { experienceId: string }) {
  const t = useTranslations('volunteerCredentials');
  const detailQuery = useExperienceDetailQuery(experienceId);
  if (detailQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (detailQuery.isError || !detailQuery.data)
    return <SectionError testId={`exp-detail-error-${experienceId}`} message={t('experiences.detailError')} />;
  const evidence = detailQuery.data.evidence ?? [];
  if (evidence.length === 0) return null;
  return (
    <div className="mt-3">
      <h4 className="text-sm font-semibold text-ink">{t('experiences.evidenceTitle')}</h4>
      <ul className="mt-2 flex flex-col gap-2">
        {evidence.map((item) => {
          const media = (item.media ?? {}) as { filename?: string; mimeType?: string };
          const label = media.filename ?? item.mediaId;
          const isImage =
            typeof media.mimeType === 'string' && media.mimeType.startsWith('image/');
          return (
            <li key={item.mediaId} className="flex items-center gap-3">
              {isImage && item.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={label} className="h-12 w-12 rounded-md border border-border object-cover" />
              ) : null}
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-primary"
                >
                  {t('experiences.evidenceOpen')}: {label}
                </a>
              ) : (
                <span className="text-sm text-ink-muted">{label}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// One enriched experience record: verified-by line + inline code +
// EXP-registryId, visibility toggle, attestation download, verify-link copy,
// expandable detail (evidence + embedded review). No audio player anywhere.
export function ExperienceCard({
  experience,
  locale,
}: {
  experience: EnrichedExperience;
  locale: string;
}) {
  const t = useTranslations('volunteerCredentials');
  const [expanded, setExpanded] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'fallback'>('idle');
  const [downloadError, setDownloadError] = useState(false);
  const visibilityMutation = usePatchExperienceVisibilityMutation();
  const attestationMutation = useAttestationDownloadMutation();

  const orgName = orgDisplayName(experience.organization, locale) || t('experiences.unknownOrg');
  const deepLink = `/verify/${experience.verificationCode}`;

  const onToggle = (next: boolean) => {
    setDownloadError(false);
    visibilityMutation.mutate({
      experienceId: experience.id,
      publicVisibility: next ? 'public' : 'private',
    });
  };

  const onDownload = () => {
    setDownloadError(false);
    attestationMutation.mutate(experience.id, {
      onError: () => setDownloadError(true),
    });
  };

  const onCopy = async () => {
    const ok = await copyVerificationLink(experience.verificationCode, deepLink);
    setCopyState(ok ? 'done' : 'fallback');
  };

  return (
    <Card>
      <article data-testid="exp-card" data-id={experience.id} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-ink">{experience.title}</h3>
            <p className="mt-1 text-sm text-status-success">
              {t('experiences.verifiedBy', {
                org: orgName,
                date: formatDate(experience.verifiedAt, locale),
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="neutral">
              {t('experiences.codeLabel')}: {experience.verificationCode}
            </Pill>
            <Pill tone="neutral">{experience.registryId}</Pill>
          </div>
        </div>
        {experience.description ? (
          <p className="text-sm text-ink-muted">{experience.description}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-muted">
          <span>{t('experiences.durationLabel', { minutes: experience.duration })}</span>
          <span className="flex items-center gap-2">
            <Toggle
              checked={experience.publicVisibility === 'public'}
              onChange={onToggle}
              label={t('experiences.visibilityLabel')}
              testId={`visibility-toggle-${experience.id}`}
            />
            {t('experiences.visibilityLabel')}
          </span>
        </div>
        {experience.review ? (
          <p className="text-sm text-ink-muted">
            {t('experiences.reviewLabel')}: {experience.review.rating}/5
            {experience.review.notes ? ` — ${experience.review.notes}` : ''}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid={`exp-download-${experience.id}`}
            onClick={onDownload}
            disabled={attestationMutation.isPending}
          >
            {attestationMutation.isPending ? t('shared.downloading') : t('experiences.attestationCta')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid={`exp-copy-${experience.id}`}
            onClick={onCopy}
          >
            {t('experiences.copyLink')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid={`exp-detail-${experience.id}`}
            onClick={() => setExpanded((prev) => !prev)}
          >
            {t('shared.details') ?? ''}
          </Button>
        </div>
        {downloadError ? (
          <p role="alert" className="text-sm text-status-error">
            {t('experiences.attestationError')}
          </p>
        ) : null}
        {copyState === 'done' ? (
          <p data-testid={`exp-copied-${experience.id}`} className="text-sm text-status-success">
            {t('experiences.copied')}
          </p>
        ) : null}
        {copyState === 'fallback' ? (
          <p data-testid={`exp-copy-fallback-${experience.id}`} className="text-sm text-ink-muted">
            {t('experiences.copyFallback')} <code>{deepLink}</code>
          </p>
        ) : null}
        {expanded ? (
          <div data-testid={`exp-expanded-${experience.id}`}>
            <EvidenceList experienceId={experience.id} />
          </div>
        ) : null}
      </article>
    </Card>
  );
}
