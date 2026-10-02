'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowUpRight,
  Camera,
  Check,
  ClipboardList,
  Clock,
  Download,
  Eye,
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Lock,
  Maximize,
  Megaphone,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { backendMessageOf } from '@/lib/api/errors';
import {
  SUBMISSION_INBOX_STATUSES,
  canDecideSubmission,
  canStartReviewSubmission,
  evidenceIdsOf,
  evidenceUrlOf,
  type InboxSubmission,
} from '@/lib/api/orgInbox';
import {
  useEvidenceMediaQuery,
  useOrgSubmissionQuery,
  useRejectSubmissionMutation,
  useStartReviewSubmissionMutation,
  useVerifySubmissionMutation,
} from '@/hooks/useOrgInbox';
import { useOwnOpportunityQuery } from '@/hooks/useOrgOpps';
import {
  ApplicantAvatar,
  SectionError,
  StatusPill,
  inboxApplicantName,
  inboxAvatarMediaId,
  joinName,
} from '../applications/components';

// Contributions detail rebuilt from
// `design/Basmatak Tatatoua - Contributions/` (code.html + screen.png):
// volunteer header + opportunity context, submission statement, expected vs
// submitted deliverables (two plain real-data lists — the API stores flat
// position requirement strings and flat submission deliverables, so no
// compliance-evaluation column is rendered), evidence carousel with
// thumbnails (images only, no EXIF — media rows carry filename/size/mime
// only), per-file asset manifest (signed-URL view/download — no bulk zip
// endpoint exists), Review Decision (start-review / approve-and-issue /
// request-changes with required reason), corrected privacy note. No flag
// action (no org-side flag-review workflow exists) and no invented copy.

type DetailRecord = Record<string, unknown>;

function recordOf(value: unknown): DetailRecord {
  return value && typeof value === 'object' ? (value as DetailRecord) : {};
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function stringListOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function formatDate(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(time));
}

function formatBytes(size: unknown): string | null {
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(url);
}

// Neutral `review` notes: plain strings and { comment } shapes only — never
// "Compliance" vocabulary (deleted per V2 §B#14).
function reviewTextOf(review: unknown): string | null {
  if (typeof review === 'string' && review.trim().length > 0) return review;
  if (review && typeof review === 'object') {
    const comment = (review as Record<string, unknown>).comment;
    if (typeof comment === 'string' && comment.trim().length > 0) return comment;
  }
  return null;
}

export function statusLabelOf(status: string, t: ReturnType<typeof useTranslations>): string {
  if ((SUBMISSION_INBOX_STATUSES as readonly string[]).includes(status)) {
    return t(`tabs.${status as (typeof SUBMISSION_INBOX_STATUSES)[number]}`);
  }
  if (status === 'approved') return t('tabs.approved');
  return status;
}

function manifestIcon(mime: string | null, url: string): LucideIcon {
  if ((mime && mime.startsWith('image/')) || isImageUrl(url)) return FileImage;
  if (mime && mime.startsWith('video/')) return FileVideo;
  if (mime && mime.startsWith('audio/')) return FileAudio;
  if (mime && (mime.includes('zip') || mime.includes('archive') || /\.zip(\?|#|$)/i.test(url))) {
    return FileArchive;
  }
  if (mime && (mime.includes('pdf') || mime.startsWith('text/') || mime.includes('document'))) {
    return FileText;
  }
  return File;
}

// ---------------------------------------------------------------------------
// Evidence carousel (real submission evidence only).
// ---------------------------------------------------------------------------

function EvidenceMain({ mediaId, testIdPrefix }: { mediaId: string; testIdPrefix: string }) {
  const t = useTranslations('orgReview');
  const mediaQuery = useEvidenceMediaQuery(mediaId);
  const [zoomed, setZoomed] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setZoomed(false);
  }, [mediaId]);

  if (mediaQuery.isPending) return <Loader label={t('shared.loading')} />;
  const url = evidenceUrlOf(mediaQuery.data);
  if (mediaQuery.isError || !url) {
    return (
      <p data-testid={`${testIdPrefix}-evidence-unavailable`} className="text-sm text-ink-muted">
        {t('contributions.fileUnavailable')}
      </p>
    );
  }

  const media = recordOf(mediaQuery.data?.media);
  const filename = textOf(media.filename) ?? mediaId;
  const image = isImageUrl(url) || textOf(media.mimeType)?.startsWith('image/') === true;

  const openFullscreen = () => {
    const frame = frameRef.current;
    if (frame && typeof frame.requestFullscreen === 'function') {
      void frame.requestFullscreen().catch(() => undefined);
    }
  };

  if (!image) {
    const Icon = manifestIcon(textOf(media.mimeType), url);
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-inverse-surface p-6 text-inverse-on-surface">
        <span className="flex min-w-0 items-center gap-3">
          <Icon size={28} aria-hidden="true" className="shrink-0" />
          <span className="truncate text-sm font-medium">{filename}</span>
        </span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium underline"
        >
          <Eye size={16} aria-hidden="true" />
          <span>{t('contributions.openOriginal')}</span>
        </a>
      </div>
    );
  }

  return (
    <div ref={frameRef} className="relative w-full overflow-hidden rounded-xl bg-inverse-surface">
      {/* eslint-disable-next-line @next/next/no-img-element -- owning-org evidence URL */}
      <img
        src={url}
        alt=""
        loading="lazy"
        className={`max-h-[400px] w-full object-cover transition-transform ${zoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'}`}
        onClick={() => setZoomed((value) => !value)}
      />
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-lg bg-inverse-surface/80 p-3 text-inverse-on-surface backdrop-blur">
        <span className="flex min-w-0 items-center gap-2">
          <Camera size={18} aria-hidden="true" className="shrink-0" />
          <span className="truncate text-sm">{filename}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={zoomed ? t('contributions.zoomOut') : t('contributions.zoomIn')}
            onClick={() => setZoomed((value) => !value)}
            className="rounded-lg p-1.5 transition-colors hover:bg-inverse-on-surface/20"
          >
            {zoomed ? <ZoomOut size={18} aria-hidden="true" /> : <ZoomIn size={18} aria-hidden="true" />}
          </button>
          <button
            type="button"
            aria-label={t('contributions.fullscreenView')}
            onClick={openFullscreen}
            className="rounded-lg p-1.5 transition-colors hover:bg-inverse-on-surface/20"
          >
            <Maximize size={18} aria-hidden="true" />
          </button>
        </span>
      </div>
    </div>
  );
}

function EvidenceThumbButton({
  mediaId,
  total,
  index,
  active,
  onSelect,
}: {
  mediaId: string;
  total: number;
  index: number;
  active: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations('orgReview');
  const mediaQuery = useEvidenceMediaQuery(mediaId);
  const url = evidenceUrlOf(mediaQuery.data);
  const image = !!url && isImageUrl(url);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={t('contributions.viewerOf', { index: index + 1, total })}
      aria-pressed={active}
      className={`relative h-20 overflow-hidden rounded-lg text-start transition-opacity hover:opacity-90 ${
        active ? 'ring-2 ring-primary ring-offset-2' : ''
      }`}
    >
      {image && url ? (
        // eslint-disable-next-line @next/next/no-img-element -- owning-org evidence URL
        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-surface-muted text-ink-muted">
          <FileText size={24} aria-hidden="true" />
        </span>
      )}
    </button>
  );
}

function EvidenceViewer({
  mediaIds,
  testIdPrefix,
}: {
  mediaIds: string[];
  testIdPrefix: string;
}) {
  const t = useTranslations('orgReview');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [mediaIds.join('|')]);

  const current = mediaIds[Math.min(index, mediaIds.length - 1)];
  if (!current) return null;

  return (
    <div className="flex flex-col gap-2">
      <EvidenceMain mediaId={current} testIdPrefix={testIdPrefix} />
      <p className="text-xs text-ink-muted">
        {t('contributions.viewerOf', { index: Math.min(index, mediaIds.length - 1) + 1, total: mediaIds.length })}
      </p>
      {mediaIds.length > 1 ? (
        <div className="grid grid-cols-4 gap-3">
          {mediaIds.map((mediaId, position) => (
            <EvidenceThumbButton
              key={mediaId}
              mediaId={mediaId}
              total={mediaIds.length}
              index={position}
              active={position === Math.min(index, mediaIds.length - 1)}
              onSelect={() => setIndex(position)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Asset manifest row (real filename/size/mime from the media read only).
// ---------------------------------------------------------------------------

function ManifestRow({ mediaId, testIdPrefix }: { mediaId: string; testIdPrefix: string }) {
  const t = useTranslations('orgReview');
  const mediaQuery = useEvidenceMediaQuery(mediaId);

  if (mediaQuery.isPending) return <Loader label={t('shared.loading')} />;
  const url = evidenceUrlOf(mediaQuery.data);
  if (mediaQuery.isError || !url) {
    return (
      <p data-testid={`${testIdPrefix}-evidence-unavailable`} className="text-sm text-ink-muted">
        {t('contributions.fileUnavailable')}
      </p>
    );
  }

  const media = recordOf(mediaQuery.data?.media);
  const filename = textOf(media.filename) ?? mediaId;
  const size = formatBytes(media.size);
  const mime = textOf(media.mimeType);
  const Icon = manifestIcon(mime, url);

  return (
    <div
      data-testid={`${testIdPrefix}-evidence-item`}
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-muted p-3"
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon size={22} aria-hidden="true" className="shrink-0 text-ink-muted" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-ink" title={filename}>
            {filename}
          </span>
          <span className="truncate text-xs text-ink-muted">
            {[size, mime].filter(Boolean).join(' · ')}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-ink hover:text-primary"
        >
          <Eye size={16} aria-hidden="true" />
          <span>{t('contributions.openOriginal')}</span>
        </a>
        <a
          href={url}
          download={filename}
          className="inline-flex items-center gap-1 text-sm font-medium text-ink hover:text-primary"
        >
          <Download size={16} aria-hidden="true" />
          <span>{t('contributions.downloadFile')}</span>
        </a>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail panel.
// ---------------------------------------------------------------------------

export function SubmissionDetail({
  locale,
  submissionId,
  testIdPrefix,
}: {
  locale: string;
  submissionId: string;
  testIdPrefix: string;
}) {
  const t = useTranslations('orgReview');
  const detailQuery = useOrgSubmissionQuery(submissionId);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    setFeedback('');
  }, [submissionId]);

  if (detailQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (detailQuery.isError) {
    return <SectionError testId={`${testIdPrefix}-error`} message={t('shared.loadError')} />;
  }

  const detail = detailQuery.data as InboxSubmission;
  const status = detail.status;
  const statusLabel = statusLabelOf(status, t);
  const evidenceIds = evidenceIdsOf(detail);
  const reviewText = reviewTextOf(detail.review);
  const record = recordOf(detail);
  const opportunityId = textOf(record.opportunityId);
  const positionId = textOf(record.positionId);
  const createdAt = textOf(record.createdAt);
  const submittedLabel = createdAt && formatDate(createdAt, locale)
    ? t('contributions.submittedOn', { date: formatDate(createdAt, locale) as string })
    : null;
  const volunteerJoin = (detail.volunteer ?? null) as Parameters<typeof joinName>[0] & {
    fullName?: string | null;
    username?: string | null;
  };
  const volunteerName = inboxApplicantName(volunteerJoin, locale);
  const username = textOf(volunteerJoin?.username);
  const geographicBase = textOf((volunteerJoin as DetailRecord | null)?.geographicBase);

  return (
    <div data-testid={testIdPrefix} className="flex min-w-0 flex-col gap-6">
      <SubmissionIdentity
        locale={locale}
        detail={detail}
        volunteerName={volunteerName}
        username={username}
        geographicBase={geographicBase}
        opportunityId={opportunityId}
        positionId={positionId}
        status={status}
        statusLabel={statusLabel}
        submittedLabel={submittedLabel}
        testIdPrefix={testIdPrefix}
      />

      <DeliverablesSection
        detail={detail}
        opportunityId={opportunityId}
        positionId={positionId}
        reviewText={reviewText}
        testIdPrefix={testIdPrefix}
      />

      <section
        aria-label={t('contributions.evidenceTitle')}
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-ink">{t('contributions.evidenceTitle')}</h3>
            <p className="mt-0.5 text-sm text-ink-muted">
              {evidenceIds.length === 1
                ? t('contributions.filesOne')
                : t('contributions.filesCount', { count: evidenceIds.length })}
            </p>
          </div>
          <StatusPill status={status} label={statusLabel} />
        </div>
        {evidenceIds.length === 0 ? (
          <p data-testid={`${testIdPrefix}-evidence-empty`} className="text-sm text-ink-muted">
            {t('contributions.evidenceEmpty')}
          </p>
        ) : (
          <EvidenceViewer mediaIds={evidenceIds} testIdPrefix={testIdPrefix} />
        )}
        {evidenceIds.length > 0 ? (
          <div className="flex flex-col gap-2 pt-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              {t('contributions.manifestTitle')}
            </span>
            <div className="flex flex-col gap-2">
              {evidenceIds.map((mediaId) => (
                <ManifestRow key={mediaId} mediaId={mediaId} testIdPrefix={testIdPrefix} />
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <ReviewDecisionSection
        submissionId={submissionId}
        status={status}
        feedback={feedback}
        onFeedback={setFeedback}
        testIdPrefix={testIdPrefix}
      />

      <p className="flex items-start gap-2 px-2 text-xs leading-relaxed text-ink-muted">
        <Lock size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>{t('contributions.privacyNote')}</span>
      </p>
    </div>
  );
}

function SubmissionIdentity({
  locale,
  detail,
  volunteerName,
  username,
  geographicBase,
  opportunityId,
  positionId,
  status,
  statusLabel,
  submittedLabel,
  testIdPrefix,
}: {
  locale: string;
  detail: InboxSubmission;
  volunteerName: string;
  username: string | null;
  geographicBase: string | null;
  opportunityId: string | null;
  positionId: string | null;
  status: string;
  statusLabel: string;
  submittedLabel: string | null;
  testIdPrefix: string;
}) {
  const t = useTranslations('orgReview');
  const opportunityQuery = useOwnOpportunityQuery(opportunityId ?? undefined);
  const oppRecord = recordOf(opportunityQuery.data);
  const positions = Array.isArray(oppRecord.positions) ? (oppRecord.positions as unknown[]) : [];
  const positionTitle = (() => {
    for (const entry of positions) {
      const candidate = recordOf(entry);
      if (textOf(candidate.id) === positionId || textOf(candidate._id) === positionId) {
        return textOf(candidate.title);
      }
    }
    return null;
  })();
  const opportunityTitle = textOf(oppRecord.title) ?? joinName(detail.opportunity, locale);
  const description = textOf(detail.description);

  return (
    <section
      aria-label={volunteerName}
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6"
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <ApplicantAvatar
            mediaId={inboxAvatarMediaId(detail.volunteer)}
            name={volunteerName}
            size={56}
            testId={`${testIdPrefix}-avatar`}
          />
          <div className="flex min-w-0 flex-col">
            <h2 className="text-xl font-semibold tracking-tight text-ink">{volunteerName}</h2>
            {geographicBase ? <span className="mt-0.5 text-sm text-ink-muted">{geographicBase}</span> : null}
            {positionTitle ? (
              <span className="mt-1 text-sm font-medium text-ink">{positionTitle}</span>
            ) : null}
            <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-ink-muted">
              <Clock size={14} aria-hidden="true" />
              {submittedLabel ?? statusLabel}
            </span>
          </div>
        </div>
        {username ? (
          <Link
            href={`/org/volunteers/${username}`}
            data-testid={`${testIdPrefix}-public-profile`}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <span>{t('participants.viewPublicProfile')}</span>
            <ArrowUpRight size={14} aria-hidden="true" className="rtl:rotate-180" />
          </Link>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 rounded-lg bg-surface-muted p-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex min-w-0 items-center gap-2.5">
          <Megaphone size={20} aria-hidden="true" className="shrink-0 text-ink-muted" />
          <span className="flex min-w-0 flex-col">
            <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
              {t('contributions.associatedOpportunity')}
            </span>
            <span className="truncate text-sm font-semibold text-ink">{opportunityTitle}</span>
          </span>
        </span>
        {opportunityId ? (
          <Link
            href={`/org/opportunities/${encodeURIComponent(opportunityId)}`}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <span>{t('contributions.viewOpportunity')}</span>
            <ArrowUpRight size={14} aria-hidden="true" className="rtl:rotate-180" />
          </Link>
        ) : null}
      </div>

      {detail.title ? (
        <h3 data-testid={`${testIdPrefix}-title`} className="text-lg font-semibold text-ink">
          {detail.title}
        </h3>
      ) : null}
      <div className="rounded-lg bg-surface p-4">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
          {t('contributions.descriptionLabel')}
        </span>
        {description ? (
          <p className="text-sm leading-relaxed text-ink">{description}</p>
        ) : (
          <p className="text-sm text-ink-muted">{t('contributions.descriptionEmpty')}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={status} label={statusLabel} />
        {status === 'verified' ? (
          <p data-testid={`${testIdPrefix}-verified`} role="status" className="text-sm font-medium text-status-success">
            {t('contributions.verifiedState')}
          </p>
        ) : null}
        {status === 'approved' ? (
          <p data-testid={`${testIdPrefix}-verified`} role="status" className="text-sm text-ink-muted">
            {t('contributions.approvedState')}
            {' · '}
            <Link href="/org/experiences" className="font-medium text-primary hover:underline">
              {t('contributions.openArchive')}
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}

function DeliverablesSection({
  detail,
  opportunityId,
  positionId,
  reviewText,
  testIdPrefix,
}: {
  detail: InboxSubmission;
  opportunityId: string | null;
  positionId: string | null;
  reviewText: string | null;
  testIdPrefix: string;
}) {
  const t = useTranslations('orgReview');
  const opportunityQuery = useOwnOpportunityQuery(opportunityId ?? undefined);
  const oppRecord = recordOf(opportunityQuery.data);
  const positions = Array.isArray(oppRecord.positions) ? (oppRecord.positions as unknown[]) : [];
  const expected = (() => {
    for (const entry of positions) {
      const candidate = recordOf(entry);
      if (textOf(candidate.id) === positionId || textOf(candidate._id) === positionId) {
        return stringListOf(candidate.deliverables);
      }
    }
    return [];
  })();

  const submitted = (() => {
    const raw = recordOf(detail).deliverables;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry) => {
        const item = recordOf(entry);
        return { title: textOf(item.title), description: textOf(item.description) };
      })
      .filter((entry) => entry.title !== null || entry.description !== null);
  })();

  return (
    <section
      aria-label={t('contributions.submittedTitle')}
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6"
    >
      <h3 className="flex items-center gap-2 text-lg font-semibold text-ink">
        <ClipboardList size={18} aria-hidden="true" className="text-ink-muted" />
        <span>{t('contributions.submittedTitle')}</span>
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg bg-surface-muted p-4">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {t('contributions.expectedTitle')}
          </span>
          {opportunityQuery.isPending ? (
            <Loader label={t('shared.loading')} />
          ) : expected.length > 0 ? (
            <ul className="flex list-disc flex-col gap-1.5 ps-5 text-sm text-ink">
              {expected.map((entry, index) => (
                <li key={`${entry}-${index}`}>{entry}</li>
              ))}
            </ul>
          ) : (
            <p data-testid={`${testIdPrefix}-expected-empty`} className="text-sm text-ink-muted">
              {t('contributions.deliverablesEmpty')}
            </p>
          )}
        </div>
        <div className="rounded-lg bg-surface-muted p-4">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {t('contributions.submittedTitle')}
          </span>
          {submitted.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {submitted.map((entry, index) => (
                <li
                  key={`${entry.title ?? 'item'}-${index}`}
                  data-testid={`${testIdPrefix}-deliverable`}
                  className="text-sm text-ink"
                >
                  {entry.title ? <span className="font-medium">{entry.title}</span> : null}
                  {entry.description ? (
                    <span className="block text-ink-muted">{entry.description}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p data-testid={`${testIdPrefix}-deliverables-empty`} className="text-sm text-ink-muted">
              {t('contributions.deliverablesEmpty')}
            </p>
          )}
        </div>
      </div>
      {reviewText ? (
        <div>
          <h4 className="text-sm font-medium text-ink">{t('contributions.reviewLabel')}</h4>
          <p data-testid={`${testIdPrefix}-review`} className="mt-1 text-sm text-ink-muted">
            {reviewText}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function ReviewDecisionSection({
  submissionId,
  status,
  feedback,
  onFeedback,
  testIdPrefix,
}: {
  submissionId: string;
  status: string;
  feedback: string;
  onFeedback: (value: string) => void;
  testIdPrefix: string;
}) {
  const t = useTranslations('orgReview');
  const startReview = useStartReviewSubmissionMutation();
  const verify = useVerifySubmissionMutation();
  const reject = useRejectSubmissionMutation();
  const feedbackValid = feedback.trim().length > 0;

  return (
    <section
      aria-label={t('contributions.reviewDecision')}
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-ink">{t('contributions.reviewDecision')}</h3>
        <p className="text-sm text-ink-muted">{t('contributions.reviewHint')}</p>
      </div>

      {canDecideSubmission(status) ? (
        <div className="flex flex-wrap items-center gap-3">
          {canStartReviewSubmission(status) ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={startReview.isPending}
              onClick={() => startReview.mutate({ submissionId })}
              data-testid={`${testIdPrefix}-start-review`}
            >
              {t('contributions.startReview')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={verify.isPending}
            onClick={() => verify.mutate({ submissionId })}
            data-testid={`${testIdPrefix}-approve`}
          >
            <Check size={16} aria-hidden="true" />
            <span>{t('contributions.approve')}</span>
          </Button>
        </div>
      ) : null}

      {canDecideSubmission(status) ? (
        <div className="rounded-lg bg-surface-muted p-4">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink">
            {t('contributions.nextStepTitle')}
          </span>
          <p data-testid={`${testIdPrefix}-mint-note`} className="text-sm leading-relaxed text-ink-muted">
            {t('contributions.nextStepBody')}
          </p>
        </div>
      ) : null}

      {canDecideSubmission(status) ? (
        <div className="flex flex-col gap-2 pt-1">
          <label htmlFor={`${testIdPrefix}-feedback`} className="text-sm font-medium text-ink">
            {t('contributions.feedbackLabel')}
          </label>
          <textarea
            id={`${testIdPrefix}-feedback`}
            data-testid={`${testIdPrefix}-feedback`}
            rows={3}
            value={feedback}
            onChange={(event) => onFeedback(event.target.value)}
            placeholder={t('contributions.feedbackPlaceholder')}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
          />
          {!feedbackValid ? (
            <p data-testid={`${testIdPrefix}-feedback-required`} className="text-sm text-status-error">
              {t('contributions.reasonRequired')}
            </p>
          ) : null}
          <div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={reject.isPending || !feedbackValid}
              onClick={() => reject.mutate({ submissionId, reason: feedback.trim() })}
              data-testid={`${testIdPrefix}-request-changes`}
            >
              {t('contributions.requestChanges')}
            </Button>
          </div>
        </div>
      ) : null}

      {startReview.isError || verify.isError ? (
        <SectionError
          testId={`${testIdPrefix}-action-error`}
          message={backendMessageOf(startReview.error ?? verify.error) ?? t('shared.actionError')}
        />
      ) : null}
      {reject.isError ? (
        <SectionError
          testId={`${testIdPrefix}-reject-error`}
          message={backendMessageOf(reject.error) ?? t('shared.actionError')}
        />
      ) : null}
    </section>
  );
}

export function SubmissionDetailCard({
  locale,
  submissionId,
  testIdPrefix,
}: {
  locale: string;
  submissionId: string;
  testIdPrefix: string;
}) {
  return (
    <Card>
      <SubmissionDetail locale={locale} submissionId={submissionId} testIdPrefix={testIdPrefix} />
    </Card>
  );
}

export function ContributionsEmpty() {
  const t = useTranslations('orgReview');
  return <Empty title={t('shared.empty')} />;
}
