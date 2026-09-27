'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { Button } from '@/components/ui/Button';
import { useSessionQuery, getLoginHref } from '@/hooks/useSession';
import { useToggleTalentFavoriteMutation, isAuthError } from '@/hooks/useFavorites';
import {
  invalidatePublicTalentDirectory,
  usePublicMediaQuery,
} from '@/hooks/usePublicTalent';
import { publicDisplayName, registryCode } from '@/lib/api/publicTalent';
import type { PublicTalentCard } from '@/lib/api/publicTalent';

// F17 public talent card. Renders EXCLUSIVELY the public projection the backend
// supplies: username (link, never an `@` key), first name, bio, wilaya, skills,
// avatar, `stats` when present, and the favorite count with its save state.
//
// Deliberately absent because `GET /talents` does not supply them: any
// per-card availability badge, experience count, portfolio count, headline, or
// joined/member-since line. Availability exists only as the `hasAvailability`
// request filter, never as a per-card claim. No contact/invite affordance.

function SaveCardButton({
  username,
  favorited,
  count,
  next,
}: {
  username: string;
  favorited: boolean;
  count: number;
  next: string;
}) {
  const t = useTranslations('publicTalent');
  const session = useSessionQuery();
  const queryClient = useQueryClient();
  const router = useRouter();
  const toggle = useToggleTalentFavoriteMutation();
  // `getLoginHref` returns a locale-less `/login` because the locale-aware
  // router adds the prefix; handing it a pre-prefixed path double-prefixed it.
  const goLogin = () => router.replace(getLoginHref(next));
  return (
    <Button
      type="button"
      variant={favorited ? 'secondary' : 'primary'}
      size="sm"
      aria-pressed={favorited}
      data-testid={`save-talent-${username}`}
      disabled={toggle.isPending}
      onClick={() => {
        if (!session.data) {
          goLogin();
          return;
        }
        toggle.mutate(
          { username, favorited },
          {
            // Refresh this session's own list/detail caches after a toggle.
            onSuccess: () => invalidatePublicTalentDirectory(queryClient),
            onError: (err) => {
              if (isAuthError(err)) goLogin();
            },
          },
        );
      }}
    >
      {favorited ? t('profile.unsaveLabel') : t('profile.saveLabel')}
      {typeof count === 'number' ? ` (${count})` : null}
    </Button>
  );
}

function CardAvatar({ mediaId, name }: { mediaId: string; name: string }) {
  const query = usePublicMediaQuery(mediaId);
  const url = query.data?.url ?? query.data?.media?.url ?? null;
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- guest-resolved signed URL on a public page
    <img
      data-testid="talent-card-avatar"
      src={url}
      alt={name}
      loading="lazy"
      className="h-12 w-12 shrink-0 rounded-full border border-border object-cover"
    />
  );
}

export function PublicTalentCard({
  item,
  locale,
  favorited,
  favoriteCount,
  wilayaName,
  next,
}: {
  item: PublicTalentCard;
  locale: string;
  favorited: boolean;
  favoriteCount: number;
  wilayaName: string | null;
  next: string;
}) {
  const name = publicDisplayName(item.firstName, item.username);
  const code = registryCode(item.registryId, 'VOL');
  return (
    <Card>
      <div data-testid="public-talent-card" className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          {item.avatar ? <CardAvatar mediaId={item.avatar} name={name} /> : null}
          <div className="flex flex-1 flex-col gap-1">
            <Link
              href={`/volunteers/${item.username}`}
              className="text-base font-semibold text-ink hover:text-primary"
            >
              {name}
            </Link>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              {code ? <span>{code}</span> : null}
              {wilayaName ? <span>{wilayaName}</span> : null}
            </div>
          </div>
        </div>
        {item.bio ? <p className="text-sm text-ink-muted">{item.bio}</p> : null}
        {(item.skills ?? []).length > 0 ? (
          <ul className="flex flex-wrap gap-1">
            {(item.skills ?? []).map((skill) => (
              <li key={skill.skillId}>
                <Pill tone="neutral">
                  {locale === 'ar' ? skill.nameAr : skill.nameFr}
                </Pill>
              </li>
            ))}
          </ul>
        ) : null}
        {item.stats ? (
          <ul data-testid="talent-card-stats" className="flex flex-wrap gap-3 text-xs text-ink-muted">
            <li>{item.stats.completedTasks}</li>
            <li>{item.stats.verifiedExperiences}</li>
            <li>{item.stats.volunteerHours}</li>
          </ul>
        ) : null}
        <div>
          <SaveCardButton
            username={item.username}
            favorited={favorited}
            count={favoriteCount}
            next={next}
          />
        </div>
      </div>
    </Card>
  );
}
