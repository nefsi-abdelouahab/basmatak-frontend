'use client';

import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePublicMediaQuery } from '@/hooks/usePublicTalent';
import { isImageMedia, isLinkMedia, mediaUrlOf, type PublicMedia } from '@/lib/api/publicTalent';

// F17 route-local guest media renderer. One `usePublicMediaQuery` per media row
// (the F0/F5 house pattern for a single-id read), so TanStack Query dedupes
// repeated ids across the profile.
//
// Privacy: a public media read 404s for non-public media, and a link-type row
// renders as a plain anchor only. There is no player, iframe, or <video>
// element on this public surface, and no broken-image placeholder.

export function PublicMediaImage({
  media,
  className = '',
  fallbackSrc,
}: {
  media: PublicMedia;
  className?: string;
  fallbackSrc?: string;
}) {
  const [failed, setFailed] = useState(false);
  const mediaId = media.mediaId ?? media.id ?? media._id ?? '';
  const query = usePublicMediaQuery(mediaId);
  const resolved = failed ? null : mediaUrlOf(query.data);
  if (query.isPending) return null;
  const src = resolved ?? fallbackSrc ?? null;
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- guest-resolved signed URL on a public page
    <img
      data-testid="public-media-image"
      src={src}
      alt={media.filename ?? ''}
      loading="lazy"
      onError={() => {
        if (fallbackSrc && !failed) setFailed(true);
      }}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

/** Link-type media row: a plain anchor, never an embed. */
export function PublicMediaLink({ media }: { media: PublicMedia }) {
  const t = useTranslations('publicTalent');
  if (!isLinkMedia(media)) return null;
  return (
    <a
      data-testid="public-media-link"
      href={media.url ?? ''}
      target="_blank"
      rel="noreferrer noopener"
      className="text-sm font-medium text-primary hover:underline"
    >
      {t('portfolio.openLink')}
    </a>
  );
}

/**
 * Image-first preview for link-type media (remote images). The backend media
 * model only knows `file | link`, so a remote image can only ever arrive as a
 * `link` row — classifying it as a link unconditionally (as `isLinkMedia`
 * does) would hide every remote portfolio image behind a text anchor. The
 * embedded URL is already the final public file, so no `/media/:id` fetch is
 * needed; when the URL does not resolve to an image (video links), the
 * `onError` fallback restores the plain anchor.
 */
export function PublicLinkPreview({ media }: { media: PublicMedia }) {
  const [failed, setFailed] = useState(false);
  const url = media.url ?? '';
  if (!isLinkMedia(media)) return null;
  if (!failed && url) {
    return (
      <div className="h-40 w-full overflow-hidden rounded-md bg-surface-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- embedded public URL of a link media row */}
        <img
          data-testid="public-media-image"
          src={url}
          alt={media.filename ?? ''}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }
  return <PublicMediaLink media={media} />;
}

/** Neutral stand-in for a portfolio item with genuinely no media attached. */
export function PortfolioPlaceholder() {
  return (
    <div
      data-testid="portfolio-placeholder"
      aria-hidden="true"
      className="flex h-40 w-full items-center justify-center rounded-md bg-surface-muted"
    >
      <ImageIcon size={28} className="text-ink-muted" aria-hidden="true" />
    </div>
  );
}

/** Evidence thumbnail for a verified experience. */
export function PublicEvidenceMedia({ media }: { media: PublicMedia }) {
  if (!isImageMedia(media)) return null;
  return (
    <div className="h-20 w-20 overflow-hidden rounded-md border border-border bg-surface-muted">
      <PublicMediaImage media={media} />
    </div>
  );
}
