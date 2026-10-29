'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import {
  copyVerificationLink,
  useAttestationDownloadMutation,
  useExperienceDetailQuery,
  usePatchExperienceVisibilityMutation,
} from '@/hooks/useExperiences';
import { useVerificationQuery } from '@/hooks/useOrgInbox';
import { orgDisplayName, type EnrichedExperience } from '@/lib/api/experiences';
import {
  hoursFromMinutes,
  humanExperienceSkillLabels,
  registryCode,
} from '@/lib/api/publicTalent';
import { SectionError, Toggle } from '../components';

function formatDate(iso: string, locale: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(time));
}

interface EvidenceFile {
  mediaId: string;
  filename: string;
  mimeType: string | null;
  linkType: string | null;
  url: string | null;
}

// Evidence rows come from GET /experiences/:id only (media read + signed
// URL). Every field is real: filename/mime from storage metadata, URL from
// the media read. Missing URL -> filename only; missing rows -> section
// omitted. No invented specs, durations, or decorative graphics.
function toEvidenceFile(item: {
  mediaId: string;
  media?: unknown;
  url?: string | null;
}): EvidenceFile {
  const media =
    item.media && typeof item.media === 'object'
      ? (item.media as Record<string, unknown>)
      : null;
  const pickString = (value: unknown): string | null =>
    typeof value === 'string' && value !== '' ? value : null;
  const nestedUrl = media ? pickString(media.url) : null;
  return {
    mediaId: item.mediaId,
    filename: (media ? pickString(media.filename) : null) ?? item.mediaId,
    mimeType: media ? pickString(media.mimeType) : null,
    linkType: media ? pickString(media.type) : null,
    url: item.url ?? nestedUrl,
  };
}

function isImageFile(file: EvidenceFile): boolean {
  return file.mimeType !== null && file.mimeType.startsWith('image/');
}

function isPdfFile(file: EvidenceFile): boolean {
  return file.mimeType === 'application/pdf';
}

function isAudioFile(file: EvidenceFile): boolean {
  return file.mimeType !== null && file.mimeType.startsWith('audio/');
}

function EvidenceGallery({ experienceId }: { experienceId: string }) {
  const t = useTranslations('volunteerCredentials');
  const detailQuery = useExperienceDetailQuery(experienceId);
  if (detailQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (detailQuery.isError || !detailQuery.data)
    return (
      <SectionError testId={`exp-detail-error-${experienceId}`} message={t('experiences.detailError')} />
    );
  const files = (detailQuery.data.evidence ?? []).map(toEvidenceFile);
  if (files.length === 0) return null;
  const images = files.filter((file) => isImageFile(file) && file.url);
  const pdfs = files.filter((file) => isPdfFile(file));
  const audios = files.filter((file) => isAudioFile(file));
  const rest = files.filter(
    (file) => !isImageFile(file) && !isPdfFile(file) && !isAudioFile(file),
  );
  return (
    <div className="flex flex-col gap-4">
      {images.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {images.map((file) => (
            <figure key={file.mediaId} className="flex min-w-0 flex-col gap-1.5">
              <span className="block aspect-[4/3] overflow-hidden rounded-lg bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- session-resolved signed evidence URL */}
                <img
                  src={file.url as string}
                  alt={file.filename}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </span>
              <figcaption className="truncate text-label-xs text-ink-muted">{file.filename}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      {pdfs.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {pdfs.map((file) => (
            <li
              key={file.mediaId}
              className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2.5 text-ink"
            >
              <FileText size={18} aria-hidden="true" className="shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1 truncate text-body-sm font-medium">{file.filename}</span>
              {file.url ? (
                <a
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-label-sm font-medium text-primary hover:underline"
                >
                  <span>{t('experiences.evidenceOpen')}</span>
                  <ExternalLink size={14} aria-hidden="true" className="rtl:rotate-180" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {audios.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {audios.map((file) => (
            <li key={file.mediaId} className="flex flex-col gap-1.5 rounded-lg bg-surface-muted p-3">
              <span className="truncate text-body-sm font-medium text-ink">{file.filename}</span>
              <span className="text-label-xs text-ink-muted">{t('experiences.evidenceAudioLabel')}</span>
              {file.url ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption -- filename + label above identify the track
                <audio controls preload="none" src={file.url} className="w-full">
                  {t('experiences.audioUnsupported')}
                </audio>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {rest.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {rest.map((file) => (
            <li key={file.mediaId} className="text-body-sm">
              {file.url ? (
                <a
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center gap-1 font-medium text-primary hover:underline"
                >
                  <span className="truncate">
                    {t('experiences.evidenceOpen')}: {file.filename}
                  </span>
                  <ExternalLink size={14} aria-hidden="true" className="shrink-0 rtl:rotate-180" />
                </a>
              ) : (
                <span className="text-ink-muted">{file.filename}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <span className="sr-only">{t('experiences.evidenceTitle')}</span>
    </div>
  );
}

function HeroImage({ experienceId }: { experienceId: string }) {
  const detailQuery = useExperienceDetailQuery(experienceId);
  if (detailQuery.isPending || detailQuery.isError || !detailQuery.data) return null;
  const first = (detailQuery.data.evidence ?? [])
    .map(toEvidenceFile)
    .find((file) => isImageFile(file) && file.url);
  if (!first?.url) return null;
  return (
    <div className="w-full overflow-hidden rounded-lg bg-surface-muted">
      {/* eslint-disable-next-line @next/next/no-img-element -- session-resolved signed evidence URL */}
      <img
        src={first.url}
        alt={first.filename}
        loading="lazy"
        className="aspect-[16/9] w-full object-cover"
      />
    </div>
  );
}

// One enriched experience record in the editorial stream: title + org link,
// org/date/hours meta from the real payload, description when present, skill
// names resolved from the real catalog as plain text (never badges), the
// neutral "Verified by <org> on <date>" line + real EXP record + verification
// code, visibility toggle, attestation download, verify-link copy, and an
// expandable evidence section (images / PDF / audio / links from detail).
export function ExperienceCard({
  experience,
  locale,
  skillNames,
  featured = false,
  defaultExpanded = false,
}: {
  experience: EnrichedExperience;
  locale: string;
  /** Skill-id -> locale display name from the real /skills catalog. */
  skillNames: Map<string, string>;
  featured?: boolean;
  defaultExpanded?: boolean;
}) {
  const t = useTranslations('volunteerCredentials');
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'fallback'>('idle');
  const [downloadError, setDownloadError] = useState(false);
  const visibilityMutation = usePatchExperienceVisibilityMutation();
  const attestationMutation = useAttestationDownloadMutation();
  // Owner-only verification read: `verificationId` is absent on public views,
  // so this query stays disabled unless the volunteer owns the experience.
  const verificationQuery = useVerificationQuery(experience.verificationId ?? undefined);
  const organizationNotes = verificationQuery.data?.notes?.trim()
    ? verificationQuery.data.notes
    : null;

  const orgName = orgDisplayName(experience.organization, locale) || t('experiences.unknownOrg');
  const date = formatDate(experience.verifiedAt, locale);
  const hours = hoursFromMinutes(experience.duration);
  const skillLabels = humanExperienceSkillLabels(experience.skills, skillNames);
  const record = registryCode(experience.registryId, 'EXP');
  const deepLink = `/verify/${experience.verificationCode}`;
  const orgSlug = experience.organization?.slug ?? '';

  const meta = [
    orgName,
    date !== '' ? date : null,
    hours ? t('experiences.hoursShort', { hours }) : null,
  ].filter((part): part is string => part !== null && part !== '');

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
    <article
      data-testid="exp-card"
      data-id={experience.id}
      className={featured ? 'flex flex-col gap-5 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6' : 'flex flex-col gap-4'}
    >
      {featured ? (
        <p className="text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
          {t('experiences.featuredLabel')}
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3
            className={
              featured
                ? 'text-title-md font-semibold tracking-tight text-ink'
                : 'text-title-sm font-semibold tracking-tight text-ink'
            }
          >
            {experience.title}
          </h3>
          {orgSlug !== '' ? (
            <Link
              href={`/orgs/${orgSlug}`}
              className="inline-flex shrink-0 items-center gap-0.5 text-label-sm font-medium text-primary hover:underline"
            >
              <span>{t('experiences.viewOrganization')}</span>
              <ArrowUpRight size={14} aria-hidden="true" className="rtl:rotate-180" />
            </Link>
          ) : null}
        </div>
        {meta.length > 0 ? (
          <p className="text-body-sm text-ink-muted">{meta.join(' · ')}</p>
        ) : null}
      </div>

      {featured ? <HeroImage experienceId={experience.id} /> : null}

      {experience.description ? (
        <p className="text-body-md leading-relaxed text-ink">{experience.description}</p>
      ) : null}

      {skillLabels.length > 0 ? (
        <p className="text-body-sm text-ink-muted">
          <span>{t('experiences.skillsLabel')}: </span>
          <span className="font-medium text-ink">{skillLabels.join(' · ')}</span>
        </p>
      ) : null}

      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-body-sm text-ink-muted">
        <BadgeCheck size={16} aria-hidden="true" className="shrink-0 text-status-success" />
        <span className="font-medium text-status-success">
          {date !== '' ? t('experiences.verifiedBy', { org: orgName, date }) : orgName}
        </span>
        {record ? (
          <>
            <span aria-hidden="true" className="text-border">
              ·
            </span>
            <span className="font-mono text-label-sm text-ink-muted">
              {t('experiences.registryLabel')} {record}
            </span>
          </>
        ) : null}
      </p>
      <p className="font-mono text-label-sm text-ink-muted">
        {t('experiences.codeLabel')}: {experience.verificationCode}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-body-sm text-ink-muted">
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
        <p className="text-body-sm text-ink-muted">
          {t('experiences.reviewLabel')}: {experience.review.rating}/5
          {experience.review.notes ? ` — ${experience.review.notes}` : ''}
        </p>
      ) : null}

      {organizationNotes ? (
        <p
          data-testid={`exp-org-notes-${experience.id}`}
          className="text-body-sm text-ink-muted"
        >
          {t('experiences.organizationNotesLabel')}: {organizationNotes}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid={`exp-download-${experience.id}`}
          onClick={onDownload}
          disabled={attestationMutation.isPending}
        >
          <Download size={16} aria-hidden="true" />
          {attestationMutation.isPending ? t('shared.downloading') : t('experiences.attestationCta')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid={`exp-copy-${experience.id}`}
          onClick={onCopy}
        >
          {copyState === 'done' ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Copy size={16} aria-hidden="true" />
          )}
          {t('experiences.copyLink')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid={`exp-detail-${experience.id}`}
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? t('experiences.hideDetails') : t('experiences.showDetails')}
        </Button>
      </div>

      {downloadError ? (
        <p role="alert" className="text-body-sm text-status-error">
          {t('experiences.attestationError')}
        </p>
      ) : null}
      {copyState === 'done' ? (
        <p data-testid={`exp-copied-${experience.id}`} role="status" className="text-body-sm text-status-success">
          {t('experiences.copied')}
        </p>
      ) : null}
      {copyState === 'fallback' ? (
        <p data-testid={`exp-copy-fallback-${experience.id}`} className="text-body-sm text-ink-muted">
          {t('experiences.copyFallback')} <code>{deepLink}</code>
        </p>
      ) : null}
      {expanded ? (
        <div data-testid={`exp-expanded-${experience.id}`} className="flex flex-col gap-3">
          <h4 className="text-title-sm font-semibold text-ink">{t('experiences.evidenceTitle')}</h4>
          <EvidenceGallery experienceId={experience.id} />
        </div>
      ) : null}
    </article>
  );
}
