'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { Pill } from '@/components/ui/Pill';
import { mapToApiError } from '@/lib/api/errors';
import {
  aggregatesOf,
  archiveCountFor,
  hoursFromMinutes,
  labelFor,
  mediaUrlOf,
  oppDisplayCode,
  oppSlugOf,
  orgDisplayCode,
  orgDisplayName,
  parseArchiveStatus,
  reliabilityRateOf,
  type ArchiveStatus,
  type PublicOppCard,
} from '@/lib/api/publicOrgs';
import {
  usePublicMediaQuery,
  usePublicOrgOppsQuery,
  usePublicOrgProfileQuery,
  usePublicOrgReliabilityQuery,
} from '@/hooks/usePublicOrgs';

// Public organization profile (F18-owned). Aggregates ride the profile payload;
// per-status archives page through GET /organizations/:slug/opportunities;
// reliability renders as a neutral response rate. No authority/audit copy.

const TABS: ArchiveStatus[] = ['published', 'completed', 'closed'];

function ArchiveCard({ locale, card }: { locale: string; card: PublicOppCard }) {
  const t = useTranslations('publicOrgs');
  const ref = oppDisplayCode(card.registryId);
  const hours = hoursFromMinutes(card.durationMinutes);
  const category = labelFor(card.categoryName, locale);
  return (
    <div data-testid="archive-card">
      <Card>
        <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-ink">{card.title ?? ''}</h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
          {category ? <span>{category}</span> : null}
          {ref ? <span>{t('orgProfile.code', { code: ref })}</span> : null}
          {hours !== null ? <span>{t('oppDetails.hours', { hours })}</span> : null}
          {card.endDate ? (
            <span>
              {new Date(card.endDate).toLocaleDateString(locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          ) : null}
        </div>
        <Link href={`/opportunities/${oppSlugOf(card)}`} className="text-sm font-medium text-primary">
          {t('landing.viewOpp')}
        </Link>
        </div>
      </Card>
    </div>
  );
}

export function PublicOrgProfilePage({ locale, slug }: { locale: string; slug: string }) {
  const t = useTranslations('publicOrgs');
  const [tab, setTab] = useState<ArchiveStatus>('published');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [stack, setStack] = useState<string[]>([]);

  const profileQuery = usePublicOrgProfileQuery(slug);
  const archiveQuery = usePublicOrgOppsQuery(
    slug,
    useMemo(() => ({ status: tab, cursor, limit: 9 }), [tab, cursor]),
  );
  const reliabilityQuery = usePublicOrgReliabilityQuery(slug);
  const profile = profileQuery.data ?? null;
  const coverQuery = usePublicMediaQuery(profile?.coverMediaId);
  const coverUrl = mediaUrlOf(coverQuery.data);

  function selectTab(next: string) {
    const parsed = parseArchiveStatus(next);
    if (!parsed) return;
    setTab(parsed);
    setCursor(undefined);
    setStack([]);
  }

  if (profileQuery.isPending) {
    return <Loader label={t('shared.loading')} />;
  }

  if (profileQuery.isError) {
    const err = mapToApiError(profileQuery.error);
    if (err.statusCode === 404) {
      return (
        <div data-testid="public-org-profile" className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
          <Empty
            title={t('shared.notFoundTitle')}
            description={t('shared.notFoundBody')}
            action={
              <Link href="/" className="text-sm font-medium text-primary">
                {t('shared.backHome')}
              </Link>
            }
          />
        </div>
      );
    }
    return (
      <div data-testid="public-org-profile" className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
        <p role="alert" className="text-sm text-status-error">
          {t('shared.loadError')}
        </p>
        <div>
          <Button variant="secondary" onClick={() => profileQuery.refetch()}>
            {t('shared.retry')}
          </Button>
        </div>
      </div>
    );
  }

  if (!profile) return <Loader label={t('shared.loading')} />;

  const name = orgDisplayName(profile, locale);
  const code = orgDisplayCode(profile.registryId);
  const verified = profile.verificationStatus === 'verified';
  const aggregates = aggregatesOf(profile);
  const ribbonHours = hoursFromMinutes(aggregates?.verifiedHours ?? null);
  const rate = reliabilityRateOf(reliabilityQuery.data);
  const archiveItems = archiveQuery.data?.page.items ?? [];
  const counts = archiveQuery.data?.counts ?? null;
  const activeCount =
    archiveQuery.data != null ? archiveCountFor(counts, tab, archiveQuery.data.page.total) : null;

  return (
    <div data-testid="public-org-profile" className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
      <Card>
        <div data-testid="org-facts" className="flex flex-col gap-3">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="h-40 w-full rounded-md object-cover" />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-ink">{name}</h1>
            {verified ? <Pill tone="success">{t('orgProfile.verified')}</Pill> : null}
          </div>
          {code ? (
            <p data-testid="org-code" className="text-sm text-ink-muted">
              {t('orgProfile.code', { code })}
            </p>
          ) : null}
          {profile.description ? <p className="text-sm text-ink">{profile.description}</p> : null}
          <dl className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            {profile.location ? (
              <div>
                <dt className="font-medium text-ink-muted">{t('orgProfile.location')}</dt>
                <dd className="text-ink">
                  {[profile.location.address, profile.location.wilayaId, profile.location.municipalityId]
                    .filter(Boolean)
                    .join(' · ')}
                </dd>
              </div>
            ) : null}
            {profile.website ? (
              <div>
                <dt className="font-medium text-ink-muted">{t('orgProfile.website')}</dt>
                <dd className="text-ink">{profile.website}</dd>
              </div>
            ) : null}
            {typeof profile.foundedYear === 'number' ? (
              <div>
                <dt className="font-medium text-ink-muted">{t('orgProfile.founded')}</dt>
                <dd className="text-ink">{t('orgProfile.activeSince', { year: profile.foundedYear })}</dd>
              </div>
            ) : null}
            {profile.contact ? (
              <div data-testid="org-contact">
                <dt className="font-medium text-ink-muted">{t('orgProfile.contact')}</dt>
                <dd className="text-ink">
                  {[profile.contact.email, profile.contact.phone].filter(Boolean).join(' · ')}
                </dd>
              </div>
            ) : null}
          </dl>
          {profile.focusDisciplines && profile.focusDisciplines.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-ink-muted">{t('orgProfile.focus')}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {profile.focusDisciplines.map((discipline) => (
                  <Pill key={discipline}>{discipline}</Pill>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {aggregates ? (
        <Card>
          <div data-testid="org-ribbon" className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {typeof aggregates.opportunitiesActive === 'number' ? (
              <div>
                <p className="text-2xl font-bold text-ink">{aggregates.opportunitiesActive}</p>
                <p className="text-sm text-ink-muted">{t('orgProfile.statsActive')}</p>
              </div>
            ) : null}
            {typeof aggregates.opportunitiesCompleted === 'number' ? (
              <div>
                <p className="text-2xl font-bold text-ink">{aggregates.opportunitiesCompleted}</p>
                <p className="text-sm text-ink-muted">{t('orgProfile.statsCompleted')}</p>
              </div>
            ) : null}
            {typeof (aggregates.participantsActive ?? aggregates.volunteersCount) === 'number' ? (
              <div>
                <p className="text-2xl font-bold text-ink">
                  {aggregates.participantsActive ?? aggregates.volunteersCount}
                </p>
                <p className="text-sm text-ink-muted">{t('orgProfile.statsVolunteers')}</p>
              </div>
            ) : null}
            {ribbonHours !== null ? (
              <div>
                <p className="text-2xl font-bold text-ink">{ribbonHours}</p>
                <p className="text-sm text-ink-muted">{t('orgProfile.statsHours')}</p>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {rate !== null ? (
        <Card>
          <div data-testid="org-reliability" className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-ink">{t('orgProfile.reliability')}</h2>
            <p className="text-2xl font-bold text-ink">{`${Math.round(rate * 100)}%`}</p>
          </div>
        </Card>
      ) : null}

      <Card title={t('orgProfile.archive')}>
        <div className="flex flex-col gap-3">
          <div data-testid="archive-tabs" role="tablist" className="flex flex-wrap gap-2">
            {TABS.map((status) => (
              <Button
                key={status}
                variant={tab === status ? 'primary' : 'secondary'}
                role="tab"
                aria-selected={tab === status}
                data-testid={`tab-${status}`}
                onClick={() => selectTab(status)}
              >
                {t(`orgProfile.tab${status === 'published' ? 'Published' : status === 'completed' ? 'Completed' : 'Closed'}`)}
              </Button>
            ))}
          </div>
          {archiveQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
          {archiveQuery.isError ? (
            <div className="flex flex-col items-start gap-2">
              <p role="alert" className="text-sm text-status-error">
                {t('shared.loadError')}
              </p>
              <Button variant="secondary" onClick={() => archiveQuery.refetch()}>
                {t('shared.retry')}
              </Button>
            </div>
          ) : null}
          {archiveQuery.isSuccess ? (
            <>
              {activeCount !== null ? (
                <p data-testid="archive-count" className="text-sm text-ink-muted">
                  {t('orgProfile.archiveCount', { total: activeCount })}
                </p>
              ) : null}
              {archiveItems.length === 0 ? (
                <Empty
                  title={t('orgProfile.archiveEmptyTitle')}
                  description={t('orgProfile.archiveEmptyBody')}
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {archiveItems.map((card, index) => (
                    <ArchiveCard key={card._id ?? card.id ?? index} locale={locale} card={card} />
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={cursor === undefined && stack.length === 0}
                  onClick={() =>
                    setStack((prev) => {
                      const rest = [...prev];
                      setCursor(rest.pop());
                      return rest;
                    })
                  }
                >
                  {t('shared.previous')}
                </Button>
                <Button
                  variant="secondary"
                  disabled={!archiveQuery.data.page.nextCursor}
                  onClick={() => {
                    const nextCursor = archiveQuery.data?.page.nextCursor;
                    if (!nextCursor) return;
                    setStack((prev) => (cursor ? [...prev, cursor] : prev));
                    setCursor(nextCursor);
                  }}
                >
                  {t('shared.next')}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
