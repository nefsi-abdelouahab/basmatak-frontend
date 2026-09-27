'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Pill } from '@/components/ui/Pill';
import { Select } from '@/components/ui/Select';
import { backendMessageOf } from '@/lib/api/errors';
import { useSessionQuery, getLoginHref } from '@/hooks/useSession';
import {
  useToggleOpportunityFavoriteMutation,
  useToggleTalentFavoriteMutation,
  isAuthError,
} from '@/hooks/useFavorites';
import {
  expDisplayCode,
  hoursFromMinutes,
  oppDisplayCode,
  oppSlugOf,
  orgDisplayCode,
  orgDisplayName,
  orgSlugOf,
  type PublicOppCard,
  type PublicOrgCard,
} from '@/lib/api/publicOrgs';
import {
  usePublicOppsQuery,
  usePublicOrgsQuery,
  usePublicSkillCategoriesQuery,
  usePublicWilayasQuery,
  useTalentSamplesQuery,
} from '@/hooks/usePublicOrgs';

// Public landing (F18-owned). Guests may view everything; Apply/Save redirect
// guests to Login with `next` (decision 10 — backend only 401s). Authenticated
// Apply navigates to the volunteer detail route where the F5 apply flow lives;
// Save toggles through F4 useFavorites read-only (never reimplemented here).

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

function SectionError({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p role="alert" className="text-sm text-status-error">
        {message}
      </p>
      <Button variant="secondary" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}

function OppCard({
  locale,
  card,
  next,
}: {
  locale: string;
  card: PublicOppCard;
  next: string;
}) {
  const t = useTranslations('publicOrgs');
  const router = useRouter();
  const session = useSessionQuery();
  const toggleSave = useToggleOpportunityFavoriteMutation();
  const [saveNote, setSaveNote] = useState<string | null>(null);

  const orgName = orgDisplayName(card.organization, locale);
  const verified = card.organization?.verificationStatus === 'verified';
  const ref = oppDisplayCode(card.registryId);
  const hours = hoursFromMinutes(card.durationMinutes);
  const favorited = card.isFavorited === true;
  const idOrSlug = oppSlugOf(card);
  const orgSlug = orgSlugOf(card.organization);

  function guestThen(): boolean {
    if (!session.data) {
      router.push(getLoginHref(next));
      return true;
    }
    return false;
  }

  function onSave() {
    if (guestThen()) return;
    setSaveNote(null);
    toggleSave.mutate(
      { id: card._id ?? card.id ?? '', favorited },
      { onError: (err) => (isAuthError(err) ? router.push(getLoginHref(next)) : setSaveNote(t('shared.loadError'))) },
    );
  }

  return (
    <div data-testid="opp-card">
      <Card>
        <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-ink">{card.title ?? ''}</h3>
          {verified ? (
            <Pill tone="success">{t('landing.verifiedBadge')}</Pill>
          ) : null}
        </div>
        {orgName ? (
          <p className="text-sm text-ink-muted">
            {orgSlug ? (
              <Link href={`/orgs/${orgSlug}`} className="font-medium text-primary">
                {orgName}
              </Link>
            ) : (
              orgName
            )}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
          {ref ? <span data-testid="opp-ref">{t('landing.ref', { ref })}</span> : null}
          {hours !== null ? <span>{t('landing.hours', { hours })}</span> : null}
          {card.endDate ? <span>{formatDate(card.endDate, locale)}</span> : null}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {session.data ? (
            <Link
              href={`/volunteer/opportunities/${idOrSlug}`}
              data-testid="apply-cta"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              {t('landing.apply')}
            </Link>
          ) : (
            <Button data-testid="apply-cta" onClick={() => router.push(getLoginHref(next))}>
              {t('landing.apply')}
            </Button>
          )}
          <Button data-testid="save-cta" variant="secondary" onClick={onSave}>
            {favorited ? t('shared.saved') : t('shared.save')}
          </Button>
          <Link href={`/opportunities/${idOrSlug}`} className="inline-flex items-center px-2 py-2 text-sm font-medium text-primary">
            {t('landing.viewOpp')}
          </Link>
        </div>
        {saveNote ? (
          <p role="alert" className="text-sm text-status-error">
            {saveNote}
          </p>
        ) : null}
        </div>
      </Card>
    </div>
  );
}

function OrgResult({ locale, org }: { locale: string; org: PublicOrgCard }) {
  const t = useTranslations('publicOrgs');
  const name = orgDisplayName(org, locale);
  const slug = orgSlugOf(org);
  const code = orgDisplayCode(org.registryId);
  return (
    <div data-testid="org-result">
      <Card>
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-ink">{name}</h3>
          {code ? <p className="text-sm text-ink-muted">{t('orgProfile.code', { code })}</p> : null}
          {slug ? (
            <Link href={`/orgs/${slug}`} className="text-sm font-medium text-primary">
              {t('landing.viewOrg')}
            </Link>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

export function PublicLandingPage({ locale }: { locale: string }) {
  const t = useTranslations('publicOrgs');
  const pathname = usePathname();
  const [draft, setDraft] = useState('');
  const [submittedQ, setSubmittedQ] = useState('');
  const [oppDraft, setOppDraft] = useState('');
  const [oppCategory, setOppCategory] = useState('');
  const [oppWilaya, setOppWilaya] = useState('');
  const [oppFilters, setOppFilters] = useState({ q: '', categoryId: '', wilayaId: '' });
  const [oppCursor, setOppCursor] = useState<string | undefined>(undefined);
  const [oppStack, setOppStack] = useState<string[]>([]);

  const next = pathname || `/`;
  const orgsQuery = usePublicOrgsQuery(
    useMemo(() => ({ q: submittedQ || undefined, limit: 6 }), [submittedQ]),
  );
  const oppsQuery = usePublicOppsQuery(
    useMemo(
      () => ({
        q: oppFilters.q || undefined,
        categoryId: oppFilters.categoryId || undefined,
        wilayaId: oppFilters.wilayaId || undefined,
        cursor: oppCursor,
        limit: 9,
      }),
      [oppFilters, oppCursor],
    ),
  );
  const categoriesQuery = usePublicSkillCategoriesQuery();
  const wilayasQuery = usePublicWilayasQuery();
  const samplesQuery = useTalentSamplesQuery();
  const toggleTalentSave = useToggleTalentFavoriteMutation();
  const router = useRouter();
  const session = useSessionQuery();

  const orgItems = orgsQuery.data?.items ?? [];
  const oppItems = oppsQuery.data?.items ?? [];
  const sampleItems = samplesQuery.data?.items ?? [];

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setSubmittedQ(draft.trim());
  }

  function submitOppFilters(event: React.FormEvent) {
    event.preventDefault();
    setOppStack([]);
    setOppCursor(undefined);
    setOppFilters({ q: oppDraft.trim(), categoryId: oppCategory, wilayaId: oppWilaya });
  }

  const categoryOptions = useMemo(
    () => [
      { value: '', label: t('landing.allOption') },
      ...((categoriesQuery.data ?? []).map((category) => ({
        value: category._id ?? category.id ?? '',
        label:
          locale === 'ar'
            ? (category.nameAr ?? category.nameFr ?? '')
            : (category.nameFr ?? category.nameAr ?? ''),
      })).filter((option) => option.value !== '')),
    ],
    [categoriesQuery.data, locale, t],
  );

  const wilayaOptions = useMemo(
    () => [
      { value: '', label: t('landing.allOption') },
      ...((wilayasQuery.data ?? []).map((wilaya) => ({
        value: wilaya._id ?? wilaya.id ?? wilaya.code ?? '',
        label:
          locale === 'ar'
            ? (wilaya.nameAr ?? wilaya.nameFr ?? '')
            : (wilaya.nameFr ?? wilaya.nameAr ?? ''),
      })).filter((option) => option.value !== '')),
    ],
    [wilayasQuery.data, locale, t],
  );

  function nextOpps() {
    const cursor = oppsQuery.data?.nextCursor;
    if (!cursor) return;
    setOppStack((stack) => (oppCursor ? [...stack, oppCursor] : stack));
    setOppCursor(cursor);
  }

  function prevOpps() {
    setOppStack((stack) => {
      const rest = [...stack];
      const previous = rest.pop();
      setOppCursor(previous);
      return rest;
    });
  }

  return (
    <div data-testid="public-landing" className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">{t('landing.title')}</h1>
        <p className="text-ink-muted">{t('landing.subtitle')}</p>
      </div>

      <Card title={t('landing.orgSearchLabel')}>
        <form data-testid="landing-search" onSubmit={submitSearch} className="flex flex-col gap-3">
          <Input
            id="landing-org-q"
            label={t('landing.orgSearchLabel')}
            placeholder={t('landing.orgSearchPlaceholder')}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div>
            <Button type="submit" data-testid="search-button">
              {t('landing.orgSearchButton')}
            </Button>
          </div>
        </form>
        <div className="mt-4 flex flex-col gap-3" data-testid="org-results">
          {orgsQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
          {orgsQuery.isError ? (
            <SectionError
              message={backendMessageOf(orgsQuery.error) ?? t('shared.loadError')}
              retryLabel={t('shared.retry')}
              onRetry={() => orgsQuery.refetch()}
            />
          ) : null}
          {orgsQuery.isSuccess ? (
            <>
              <p data-testid="org-count" className="text-sm text-ink-muted">
                {t('landing.orgCount', { total: orgsQuery.data.total })}
              </p>
              {orgItems.length === 0 ? (
                <Empty title={t('landing.orgEmptyTitle')} description={t('landing.orgEmptyBody')} />
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {orgItems.map((org, index) => (
                    <OrgResult key={org._id ?? org.id ?? index} locale={locale} org={org} />
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      </Card>

      <Card title={t('landing.feedTitle')}>
        <form data-testid="feed-filters" onSubmit={submitOppFilters} className="mb-3 flex flex-col gap-3">
          <Input
            id="landing-opp-q"
            label={t('landing.oppSearchLabel')}
            placeholder={t('landing.oppSearchPlaceholder')}
            value={oppDraft}
            onChange={(event) => setOppDraft(event.target.value)}
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Select
              id="landing-opp-category"
              label={t('landing.categoryLabel')}
              options={categoryOptions}
              value={oppCategory}
              onChange={(event) => setOppCategory(event.target.value)}
            />
            <Select
              id="landing-opp-wilaya"
              label={t('landing.wilayaLabel')}
              options={wilayaOptions}
              value={oppWilaya}
              onChange={(event) => setOppWilaya(event.target.value)}
            />
          </div>
          <div>
            <Button type="submit">{t('landing.filterButton')}</Button>
          </div>
        </form>
        <div data-testid="opp-feed" className="flex flex-col gap-3">
          {oppsQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
          {oppsQuery.isError ? (
            <SectionError
              message={backendMessageOf(oppsQuery.error) ?? t('shared.loadError')}
              retryLabel={t('shared.retry')}
              onRetry={() => oppsQuery.refetch()}
            />
          ) : null}
          {oppsQuery.isSuccess ? (
            <>
              <p data-testid="feed-count" className="text-sm text-ink-muted">
                {t('landing.feedCount', { total: oppsQuery.data.total })}
              </p>
              {oppItems.length === 0 ? (
                <Empty title={t('landing.feedEmptyTitle')} description={t('landing.feedEmptyBody')} />
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {oppItems.map((card, index) => (
                    <OppCard
                      key={card._id ?? card.id ?? index}
                      locale={locale}
                      card={card}
                      next={next}
                    />
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" disabled={oppCursor === undefined && oppStack.length === 0} onClick={prevOpps}>
                  {t('shared.previous')}
                </Button>
                <Button
                  variant="secondary"
                  disabled={!oppsQuery.data.nextCursor}
                  onClick={nextOpps}
                >
                  {t('shared.next')}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </Card>

      <Card title={t('landing.samplesTitle')}>
        <div data-testid="talent-samples" className="flex flex-col gap-3">
          {samplesQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
          {samplesQuery.isError ? (
            <SectionError
              message={t('shared.loadError')}
              retryLabel={t('shared.retry')}
              onRetry={() => samplesQuery.refetch()}
            />
          ) : null}
          {samplesQuery.isSuccess && sampleItems.length === 0 ? (
            <Empty title={t('landing.samplesTitle')} description={t('landing.samplesEmpty')} />
          ) : null}
          {samplesQuery.isSuccess && sampleItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sampleItems.map((sample) => (
                <div key={sample.username} data-testid="sample-card">
                  <Card>
                    <div className="flex flex-col gap-1">
                      <p className="text-base font-semibold text-ink">
                        {sample.firstName ?? sample.username}
                      </p>
                      {sample.bio ? <p className="text-sm text-ink-muted">{sample.bio}</p> : null}
                      <Button
                        variant="secondary"
                        data-testid="sample-save-cta"
                        onClick={() => {
                          if (!session.data) {
                            router.push(getLoginHref(next));
                            return;
                          }
                          toggleTalentSave.mutate({
                            username: sample.username,
                            favorited: sample.isFavorited === true,
                          });
                        }}
                      >
                        {sample.isFavorited === true ? t('shared.saved') : t('shared.save')}
                      </Button>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          ) : null}
          <div data-testid="sample-record-card">
            <Card>
              <div className="flex flex-col gap-1">
                <p className="text-base font-semibold text-ink">{t('landing.sampleTitle')}</p>
                <p className="text-sm text-ink-muted">{t('landing.sampleBody')}</p>
                <p className="text-sm text-ink-muted">
                  {t('landing.code', { code: expDisplayCode('EXP-000084') ?? '' })} · {t('landing.verified')}
                </p>
              </div>
            </Card>
          </div>
        </div>
      </Card>
    </div>
  );
}
