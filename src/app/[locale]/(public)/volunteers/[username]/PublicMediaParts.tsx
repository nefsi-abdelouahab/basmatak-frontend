'use client';

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
}: {
  media: PublicMedia;
  className?: string;
}) {
  const mediaId = media.mediaId ?? media.id ?? media._id ?? '';
  const query = usePublicMediaQuery(mediaId);
  const resolved = mediaUrlOf(query.data);
  if (query.isPending) return null;
  if (!resolved) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- guest-resolved signed URL on a public page
    <img
      data-testid="public-media-image"
      src={resolved}
      alt={media.filename ?? ''}
      loading="lazy"
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

/** Evidence thumbnail for a verified experience. */
export function PublicEvidenceMedia({ media }: { media: PublicMedia }) {
  if (!isImageMedia(media)) return null;
  return (
    <div className="h-20 w-20 overflow-hidden rounded-md border border-border bg-surface-muted">
      <PublicMediaImage media={media} />
    </div>
  );
}
