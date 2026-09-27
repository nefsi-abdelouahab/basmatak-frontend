'use client';

import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { Button } from '@/components/ui/Button';
import { useSessionQuery, getLoginHref } from '@/hooks/useSession';
import { useToggleTalentFavoriteMutation, isAuthError } from '@/hooks/useFavorites';
import type { TalentCard as TalentCardData } from '@/lib/api/feed';

function SaveTalentButton({
  username,
  favorited,
  count,
  next,
}: {
  username: string;
  favorited: boolean;
  count: number | null;
  next: string;
}) {
  const t = useTranslations('volunteerHome');
  const session = useSessionQuery();
  const router = useRouter();
  const toggle = useToggleTalentFavoriteMutation();
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
          { onError: (err) => { if (isAuthError(err)) goLogin(); } },
        );
      }}
    >
      {favorited ? t('talents.unsaveLabel') : t('talents.saveLabel')}
      {typeof count === 'number' ? ` (${count})` : null}
    </Button>
  );
}

function displayName(item: TalentCardData): string {
  const joined = [item.firstName, item.lastName].filter(Boolean).join(' ').trim();
  return joined !== '' ? joined : item.username;
}

// Public-projection card: stats/availability/portfolio counts from the
// talents payload plus lookup save state. No contact/invite UI exists.
export function TalentCard({
  item,
  favorited,
  favoriteCount,
  next,
}: {
  item: TalentCardData;
  favorited: boolean;
  favoriteCount: number | null;
  next: string;
}) {
  const t = useTranslations('volunteerHome');
  return (
    <Card>
      <div data-testid="talent-card" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`/volunteers/${item.username}`}
            className="text-base font-semibold text-ink hover:text-primary"
          >
            {displayName(item)}
          </Link>
          {item.hasAvailability ? <Pill tone="success">{t('talents.availableBadge')}</Pill> : null}
        </div>
        {item.headline ? <p className="text-sm text-ink-muted">{item.headline}</p> : null}
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          {typeof item.experienceCount === 'number' ? (
            <span>{t('talents.experiencesSuffix', { count: item.experienceCount })}</span>
          ) : null}
          {typeof item.portfolioCount === 'number' ? (
            <span>{t('talents.portfolioSuffix', { count: item.portfolioCount })}</span>
          ) : null}
        </div>
        <div>
          <SaveTalentButton
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
