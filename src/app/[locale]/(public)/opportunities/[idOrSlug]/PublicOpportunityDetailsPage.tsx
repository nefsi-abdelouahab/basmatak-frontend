'use client';

import { useMemo, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { Pill } from '@/components/ui/Pill';
import { mapToApiError } from '@/lib/api/errors';
import { useSessionQuery, getLoginHref } from '@/hooks/useSession';
import { useToggleOpportunityFavoriteMutation, isAuthError } from '@/hooks/useFavorites';
import {
  applyGateFor,
  hoursFromMinutes,
  labelFor,
  mediaUrlOf,
  oppDisplayCode,
  oppIdOf,
  oppSlugOf,
  orgDisplayName,
  orgSlugOf,
  positionIdOf,
  relatedSlugOf,
  type PublicPosition,
} from '@/lib/api/publicOrgs';
import {
  usePublicMediaQuery,
  usePublicOppDetailQuery,
  useRelatedPublicOppsQuery,
} from '@/hooks/usePublicOrgs';

// Public opportunity details (F18-owned). Meta, positions, and publisher render
// from the detail embeds only (no N+1); related resolves through the embedded
// org slug (published-only). Guests redirect to Login for Apply/Save
// (decision 10); authenticated Apply navigates to the volunteer detail route
// where the F5 apply flow lives. No perks/logistics/authority copy.

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '';
  return new Date(iso).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function MetaItem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">{title}</span>
      <div className="text-sm font-medium text-ink">{children}</div>
    </div>
  );
}

function PositionCard({
  locale,
  position,
  detailStatus,
  deadline,
  idOrSlug,
}: {
  locale: string;
  position: PublicPosition;
  detailStatus: string | undefined;
  deadline: string | null | undefined;
  idOrSlug: string;
}) {
  const t = useTranslations('publicOrgs');
  const router = useRouter();
  const pathname = usePathname();
  const session = useSessionQuery();
  const next = pathname || `/opportunities/${idOrSlug}`;

  const gate = applyGateFor({ status: detailStatus, applicationDeadline: deadline ?? null }, position);
  const gateNote =
    gate === 'full'
      ? t('oppDetails.fullNote')
      : gate === 'deadline'
        ? t('oppDetails.deadlineNote')
        : gate === 'closed'
          ? t('oppDetails.closedNote')
          : null;
  const assigned = useMemo(() => position.assigned ?? [], [position]);
  const skillNames = useMemo(() => position.skillNames ?? [], [position]);

  return (
    <div data-testid="position-card">
      <Card>
        <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-ink">{position.title ?? ''}</h3>
        {position.description ? <p className="text-sm text-ink-muted">{position.description}</p> : null}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
          {typeof position.requiredCount === 'number' ? (
            <span>
              {t('oppDetails.seats', {
                filled: position.filledCount ?? 0,
                required: position.requiredCount,
              })}
            </span>
          ) : null}
          {typeof position.applicationCount === 'number' ? (
            <span>{t('oppDetails.applications', { count: position.applicationCount })}</span>
          ) : null}
        </div>
        {skillNames.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-ink-muted">{t('oppDetails.skills')}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {skillNames.map((skill) => (
                <Pill key={skill.skillId}>{labelFor(skill, locale)}</Pill>
              ))}
            </div>
          </div>
        ) : null}
        {assigned.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-ink-muted">{t('oppDetails.assigned')}</p>
            <ul className="mt-1 flex flex-col gap-1 text-sm text-ink">
              {assigned.map((person) => (
                <li key={person.volunteerId}>{person.fullName ?? person.username ?? ''}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {gateNote ? (
          <p role="note" className="text-sm text-ink-muted">
            {gateNote}
          </p>
        ) : null}
        {gate ? (
          <Button data-testid="apply-cta" disabled>
            {t('oppDetails.apply')}
          </Button>
        ) : session.data ? (
          <Link
            href={`/volunteer/opportunities/${idOrSlug}`}
            data-testid="apply-cta"
            className="inline-flex items-center self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            {t('oppDetails.apply')}
          </Link>
        ) : (
          <Button data-testid="apply-cta" onClick={() => router.push(getLoginHref(next))}>
            {t('oppDetails.apply')}
          </Button>
        )}
        </div>
      </Card>
    </div>
  );
}

export function PublicOpportunityDetailsPage({
  locale,
  idOrSlug,
}: {
  locale: string;
  idOrSlug: string;
}) {
  const t = useTranslations('publicOrgs');
  const c = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const session = useSessionQuery();
  const toggleSave = useToggleOpportunityFavoriteMutation();

  const detailQuery = usePublicOppDetailQuery(idOrSlug);
  const detail = detailQuery.data ?? null;
  const relatedSlug = relatedSlugOf(detail);
  const relatedQuery = useRelatedPublicOppsQuery(relatedSlug, detail ? oppIdOf(detail) : undefined);
  const coverQuery = usePublicMediaQuery(detail?.coverMediaId);
  const coverUrl = mediaUrlOf(coverQuery.data);

  const next = pathname || `/opportunities/${idOrSlug}`;

  if (detailQuery.isPending) {
    return <Loader label={t('shared.loading')} />;
  }

  if (detailQuery.isError) {
    const err = mapToApiError(detailQuery.error);
    if (err.statusCode === 404) {
      return (
        <div
          data-testid="public-opp-details"
          className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4"
        >
          <Empty
            title={t('oppDetails.notFoundTitle')}
            description={t('oppDetails.notFoundBody')}
            action={
              <Link href="/" className="text-sm font-medium text-primary">
                {t('oppDetails.backToLanding')}
              </Link>
            }
          />
        </div>
      );
    }
    return (
      <div
        data-testid="public-opp-details"
        className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4"
      >
        <p data-testid="detail-error" role="alert" className="text-sm text-status-error">
          {t('shared.loadError')}
        </p>
        <div>
          <Button variant="secondary" onClick={() => detailQuery.refetch()}>
            {t('shared.retry')}
          </Button>
        </div>
      </div>
    );
  }

  if (!detail) return <Loader label={t('shared.loading')} />;

  const ref = oppDisplayCode(detail.registryId);
  const hours = hoursFromMinutes(detail.durationMinutes);
  const positions = detail.positions ?? [];
  const orgName = orgDisplayName(detail.organization, locale);
  const orgSlug = orgSlugOf(detail.organization);
  const verified = detail.organization?.verificationStatus === 'verified';
  const favorited = detail.isFavorited === true;
  const opportunityId = oppIdOf(detail);

  function onSave() {
    if (!session.data) {
      router.push(getLoginHref(next));
      return;
    }
    toggleSave.mutate(
      { id: opportunityId, favorited },
      {
        onError: (err) => {
          if (isAuthError(err)) router.push(getLoginHref(next));
        },
      },
    );
  }

  return (
    <div
      data-testid="public-opp-details"
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4"
    >
      <nav aria-label={c('a11y.breadcrumb')} className="flex flex-wrap items-center gap-2 text-sm">
        {orgSlug ? (
          <Link href={`/orgs/${orgSlug}`} className="font-medium text-ink-muted">
            {t('oppDetails.backToOrg')}
          </Link>
        ) : null}
      </nav>

      <div data-testid="detail-header" className="flex flex-col gap-2">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="h-52 w-full rounded-lg object-cover" />
        ) : null}
        <h1 className="text-2xl font-bold text-ink">{detail.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {ref ? (
            <span data-testid="detail-ref" className="text-sm text-ink-muted">
              {t('oppDetails.code', { code: ref })}
            </span>
          ) : null}
          {verified ? <Pill tone="success">{t('oppDetails.verifiedOrg')}</Pill> : null}
        </div>
        {detail.description ? <p className="text-sm text-ink">{detail.description}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button data-testid="save-cta" variant="secondary" onClick={onSave}>
            {favorited ? t('shared.saved') : t('shared.save')}
          </Button>
        </div>
      </div>

      <Card>
        <div data-testid="detail-meta" className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {detail.mode ? <MetaItem title={t('oppDetails.mode')}>{detail.mode}</MetaItem> : null}
          {detail.endDate ? (
            <MetaItem title={t('oppDetails.endDate')}>{formatDate(detail.endDate, locale)}</MetaItem>
          ) : null}
          {hours !== null ? (
            <MetaItem title={t('oppDetails.duration')}>{t('oppDetails.hours', { hours })}</MetaItem>
          ) : null}
          {detail.applicationDeadline ? (
            <MetaItem title={t('oppDetails.deadline')}>
              {formatDate(detail.applicationDeadline, locale)}
            </MetaItem>
          ) : null}
        </div>
        {detail.prerequisites && detail.prerequisites.length > 0 ? (
          <div className="mt-4">
            <h2 className="mb-2 text-lg font-semibold text-ink">{t('oppDetails.prerequisites')}</h2>
            <ul className="flex list-disc flex-col gap-1 ps-5 text-sm text-ink">
              {detail.prerequisites.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">{t('oppDetails.positions')}</h2>
        {positions.length === 0 ? (
          <Empty title={t('oppDetails.positions')} description={t('oppDetails.closedNote')} />
        ) : (
          positions.map((position, index) => (
            <PositionCard
              key={positionIdOf(position) || index}
              locale={locale}
              position={position}
              detailStatus={detail.status}
              deadline={detail.applicationDeadline}
              idOrSlug={idOrSlug}
            />
          ))
        )}
      </div>

      <Card>
        <div data-testid="detail-org" className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-ink">{t('oppDetails.publisher')}</h2>
          {detail.organization ? (
            <>
              <p className="text-base font-medium text-ink">{orgName}</p>
              {verified ? (
                <p className="text-sm text-ink-muted">{t('oppDetails.verifiedOrg')}</p>
              ) : null}
              {orgSlug ? (
                <Link href={`/orgs/${orgSlug}`} className="text-sm font-medium text-primary">
                  {t('landing.viewOrg')}
                </Link>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-ink-muted">{t('oppDetails.relatedEmpty')}</p>
          )}
        </div>
      </Card>

      <Card>
        <div data-testid="detail-related" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink">{t('oppDetails.related')}</h2>
          {relatedQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
          {relatedQuery.isError ? (
            <p role="alert" className="text-sm text-status-error">
              {t('shared.loadError')}
            </p>
          ) : null}
          {relatedQuery.isSuccess && (relatedQuery.data?.length ?? 0) === 0 ? (
            <Empty title={t('oppDetails.related')} description={t('oppDetails.relatedEmpty')} />
          ) : null}
          {relatedQuery.isSuccess && (relatedQuery.data?.length ?? 0) > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(relatedQuery.data ?? []).map((item) => (
                <div key={oppIdOf(item)} data-testid="related-card">
                  <Card>
                    <div className="flex flex-col gap-1">
                      <p className="text-base font-semibold text-ink">{item.title ?? ''}</p>
                      <Link
                        href={`/opportunities/${oppSlugOf(item)}`}
                        className="text-sm font-medium text-primary"
                      >
                        {t('landing.viewOpp')}
                      </Link>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
