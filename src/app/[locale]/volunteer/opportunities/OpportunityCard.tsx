'use client';

import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { Button } from '@/components/ui/Button';
import { useSessionQuery, getLoginHref } from '@/hooks/useSession';
import { useToggleOpportunityFavoriteMutation, isAuthError } from '@/hooks/useFavorites';
import { hoursLabel, isOrgVerified, opportunityRef, orgDisplayName } from '@/hooks/useFeed';
import type { OpportunityCard as OpportunityCardData } from '@/lib/api/feed';

function SaveOpportunityButton({
  id,
  favorited,
  count,
  locale,
  next,
  testId,
}: {
  id: string;
  favorited: boolean;
  count: number | null;
  locale: string;
  next: string;
  testId: string;
}) {
  const t = useTranslations('volunteerHome');
  const session = useSessionQuery();
  const router = useRouter();
  const toggle = useToggleOpportunityFavoriteMutation();
  const goLogin = () => router.replace(getLoginHref(locale, next));
  return (
    <Button
      type="button"
      variant={favorited ? 'secondary' : 'primary'}
      size="sm"
      aria-pressed={favorited}
      data-testid={`${testId}`}
      disabled={toggle.isPending}
      onClick={() => {
        if (!session.data) {
          goLogin();
          return;
        }
        toggle.mutate(
          { id, favorited },
          { onError: (err) => { if (isAuthError(err)) goLogin(); } },
        );
      }}
    >
      {favorited ? t('opportunities.unsaveLabel') : t('opportunities.saveLabel')}
      {typeof count === 'number' ? ` (${count})` : null}
    </Button>
  );
}

// Embed-only card (no N+1): org name + verified badge + OPP-<registryId>
// come from the list payload; hours derive from durationMinutes.
export function OpportunityCard({
  item,
  locale,
  favorited,
  favoriteCount,
  next,
  saveTestIdPrefix = 'save-opp',
}: {
  item: OpportunityCardData;
  locale: string;
  favorited: boolean;
  favoriteCount: number | null;
  next: string;
  saveTestIdPrefix?: string;
}) {
  const t = useTranslations('volunteerHome');
  const id = item.id ?? item._id ?? '';
  const detailId = item.slug ?? item.idOrSlug ?? id;
  const ref = opportunityRef(item.registryId ?? null);
  const hours = hoursLabel(item.durationMinutes ?? null);
  return (
    <Card>
      <div data-testid="opportunity-card" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`/volunteer/opportunities/${detailId}`}
            className="text-base font-semibold text-ink hover:text-primary"
          >
            {item.title ?? detailId}
          </Link>
          {isOrgVerified(item.organization) ? (
            <Pill tone="success">{t('opportunities.verifiedBadge')}</Pill>
          ) : null}
        </div>
        <p data-testid="opportunity-org" className="text-sm text-ink-muted">
          {orgDisplayName(item.organization, locale)}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          {ref ? <span data-testid="opportunity-ref">{t('opportunities.refLabel', { ref })}</span> : null}
          {item.mode ? <span>{item.mode}</span> : null}
          {hours ? <span data-testid="opportunity-hours">{t('opportunities.hoursSuffix', { hours })}</span> : null}
        </div>
        {id ? (
          <div>
            <SaveOpportunityButton id={id} favorited={favorited} count={favoriteCount} locale={locale} next={next} testId={`${saveTestIdPrefix}-${id}`} />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
