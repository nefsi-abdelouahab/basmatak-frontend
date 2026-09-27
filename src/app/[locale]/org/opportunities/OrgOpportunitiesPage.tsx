'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Pagination } from '@/components/ui/Pagination';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { Select } from '@/components/ui/Select';
import { ForbiddenScreen } from '@/components/system/ForbiddenScreen';
import { SessionExpiredScreen } from '@/components/system/SessionExpiredScreen';
import { errorStateFor, mapToApiError } from '@/lib/api/errors';
import { getLoginHref, useSessionQuery } from '@/hooks/useSession';
import {
  lifecycleAvailability,
  opportunityIdOf,
  opportunityRefOf,
  opportunityStatusOf,
  type OwnerOpportunity,
  type PublishGateStatus,
} from '@/lib/api/orgOpps';
import {
  useDeleteDraftOpportunityMutation,
  useDuplicateOpportunityMutation,
  useOwnOpportunitiesQuery,
  useOwnOrgGateQuery,
  usePublishGateQuery,
} from '@/hooks/useOrgOpps';

// F10-owned route-local shared bits for org/opportunities (+ new + [id]).
// Mirrors the F6 route-local guard pattern without editing other files.

// Guest guard (decision 10): unauthenticated visits redirect to Login.
export function RequireOrgOpps({
  locale,
  next,
  children,
}: {
  locale: string;
  next: string;
  children: ReactNode;
}) {
  const t = useTranslations('orgOpportunities');
  const session = useSessionQuery();
  const router = useRouter();

  useEffect(() => {
    if (session.isError) router.replace(getLoginHref(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isError, router, locale]);

  if (session.isPending) return <Loader label={t('list.loading')} />;
  if (session.isError) return null;
  return <>{children}</>;
}

export function OppSectionError({ message, testId }: { message: string; testId: string }) {
  return (
    <p data-testid={testId} role="alert" className="text-sm text-status-error">
      {message}
    </p>
  );
}

const STATUS_TONE: Record<string, PillTone> = {
  draft: 'neutral',
  published: 'success',
  in_progress: 'pending',
  completed: 'success',
  closed: 'neutral',
  cancelled: 'error',
};

export function OppStatusPill({ status }: { status: string }) {
  return <Pill tone={STATUS_TONE[status] ?? 'neutral'}>{status}</Pill>;
}

function PublishLockNote({
  verificationStatus,
  gate,
}: {
  verificationStatus: string | undefined;
  gate: PublishGateStatus | undefined;
}) {
  const t = useTranslations('orgOpportunities');
  const availability = lifecycleAvailability('draft', verificationStatus, gate?.locked);
  if (availability.publishLockedReason === null) return null;
  if (availability.publishLockedReason === 'unverified') {
    return (
      <p data-testid="publish-locked-unverified" className="text-sm text-status-pending">
        {t('list.publishLockedUnverifiedTitle')}: {t('list.publishLockedUnverifiedDescription')}
      </p>
    );
  }
  return (
    <p data-testid="publish-locked-gate" className="text-sm text-status-pending">
      {t('list.publishLockedGateTitle')}:{' '}
      {t('list.publishLockedGateDescription', {
        pendingCount: gate?.pendingCount ?? 0,
        threshold: gate?.threshold ?? 0,
      })}
    </p>
  );
}

function OppCard({
  locale,
  opp,
  gate,
  verificationStatus,
  onChanged,
}: {
  locale: string;
  opp: OwnerOpportunity;
  gate: PublishGateStatus | undefined;
  verificationStatus: string | undefined;
  onChanged: (message: string) => void;
}) {
  const t = useTranslations('orgOpportunities');
  const router = useRouter();
  const id = opportunityIdOf(opp);
  const status = opportunityStatusOf(opp);
  const availability = lifecycleAvailability(status, verificationStatus, gate?.locked);
  const duplicateMutation = useDuplicateOpportunityMutation();
  const deleteMutation = useDeleteDraftOpportunityMutation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const duplicate = async () => {
    try {
      const copy = await duplicateMutation.mutateAsync(id);
      onChanged(t('list.duplicated'));
      const copyId = opportunityIdOf(copy);
      // NOTE: next-intl useRouter prefixes the active locale itself — passing
      // a locale-prefixed path here would double it (/{locale}/{locale}/…).
      if (copyId) router.push(`/org/opportunities/${copyId}`);
    } catch {
      onChanged(t('list.genericError'));
    }
  };

  const remove = async () => {
    try {
      await deleteMutation.mutateAsync(id);
      setConfirmingDelete(false);
      onChanged(t('list.deleted'));
    } catch {
      onChanged(t('list.genericError'));
    }
  };

  return (
    <li
      data-testid="opportunity-row"
      className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">{opp.title}</h3>
          {opportunityRefOf(opp) ? (
            <p className="text-xs text-ink-muted">
              {t('list.refLabel')}: {opportunityRefOf(opp)}
            </p>
          ) : null}
        </div>
        <OppStatusPill status={status} />
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-ink-muted">
        <span>
          {t('list.applicationsLabel')}: {opp.applicationCount ?? 0}
        </span>
        <span>
          {t('list.participantsLabel')}: {opp.participantCount ?? 0}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          data-testid={`edit-opp-${id}`}
          href={`/${locale}/org/opportunities/${id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('list.editLabel')}
        </Link>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid={`duplicate-opp-${id}`}
          disabled={duplicateMutation.isPending}
          onClick={duplicate}
        >
          {t('list.duplicate')}
        </Button>
        {availability.canDeleteDraft ? (
          confirmingDelete ? (
            <span className="flex items-center gap-2">
              <Button
                type="button"
                variant="danger"
                size="sm"
                data-testid={`delete-opp-confirm-${id}`}
                disabled={deleteMutation.isPending}
                onClick={remove}
              >
                {t('list.deleteConfirm')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                {t('list.deleteCancel')}
              </Button>
            </span>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid={`delete-opp-${id}`}
              onClick={() => setConfirmingDelete(true)}
            >
              {t('list.delete')}
            </Button>
          )
        ) : null}
      </div>
      {status === 'draft' ? (
        <PublishLockNote verificationStatus={verificationStatus} gate={gate} />
      ) : null}
    </li>
  );
}

export function OrgOpportunitiesPage({ locale }: { locale: string }) {
  const t = useTranslations('orgOpportunities');
  const [draftQ, setDraftQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [sort, setSort] = useState('');
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [pageIdx, setPageIdx] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      q: appliedQ === '' ? undefined : appliedQ,
      sort: sort === '' ? undefined : sort,
      cursor: cursors[pageIdx],
      limit: 20,
    }),
    [appliedQ, sort, cursors, pageIdx],
  );
  const listQuery = useOwnOpportunitiesQuery(filters);
  const gateQuery = usePublishGateQuery();
  const orgGateQuery = useOwnOrgGateQuery();

  const applySearch = () => {
    setAppliedQ(draftQ.trim());
    setCursors([undefined]);
    setPageIdx(0);
  };

  const applySort = (value: string) => {
    setSort(value);
    setCursors([undefined]);
    setPageIdx(0);
  };

  const total = listQuery.data?.total ?? 0;
  const page = listQuery.data?.page ?? pageIdx + 1;
  const pages = listQuery.data?.pages ?? pageIdx + 1;

  const renderForbidden = (error: unknown) =>
    errorStateFor(mapToApiError(error)) === 'forbidden';

  return (
    <RequireOrgOpps locale={locale} next={`/${locale}/org/opportunities`}>
      <div data-testid="org-opportunities" className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-ink">{t('list.title')}</h1>
          <Link
            data-testid="create-opportunity-link"
            href={`/${locale}/org/opportunities/new`}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-base font-medium text-white hover:bg-primary-hover"
          >
            {t('list.createCta')}
          </Link>
        </div>

        <Card>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <Input
                id="opp-search"
                label={t('list.searchLabel')}
                placeholder={t('list.searchPlaceholder')}
                value={draftQ}
                onChange={(event) => setDraftQ(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applySearch();
                }}
              />
            </div>
            <div className="w-full md:w-56">
              <Select
                id="opp-sort"
                label={t('list.sortLabel')}
                value={sort}
                onChange={(event) => applySort(event.target.value)}
                options={[
                  { value: '', label: t('list.sortNewest') },
                  { value: 'newest', label: t('list.sortNewest') },
                  { value: 'oldest', label: t('list.sortOldest') },
                ]}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              data-testid="opp-search-apply"
              onClick={applySearch}
            >
              {t('list.searchLabel')}
            </Button>
          </div>
        </Card>

        {notice ? (
          <p data-testid="opp-notice" role="status" className="text-sm text-ink">
            {notice}
          </p>
        ) : null}

        {listQuery.isPending ? (
          <Card>
            <div data-testid="org-opportunities-loading">
              <Loader label={t('list.loading')} />
            </div>
          </Card>
        ) : listQuery.isError ? (
          (() => {
            const state = errorStateFor(mapToApiError(listQuery.error));
            if (state === 'session-expired') return <SessionExpiredScreen />;
            if (renderForbidden(listQuery.error)) return <ForbiddenScreen />;
            return (
              <Card>
                <OppSectionError message={t('list.genericError')} testId="org-opportunities-error" />
              </Card>
            );
          })()
        ) : listQuery.data.items.length === 0 ? (
          <Empty
            title={t('list.empty')}
            description={t('list.emptyDescription')}
            action={
              <Link
                href={`/${locale}/org/opportunities/new`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {t('list.createCta')}
              </Link>
            }
          />
        ) : (
          <>
            <p data-testid="org-opportunities-count" className="text-sm text-ink-muted">
              {t('list.count', { total })}
            </p>
            <ul className="flex flex-col gap-3">
              {listQuery.data.items.map((opp) => (
                <OppCard
                  key={opportunityIdOf(opp)}
                  locale={locale}
                  opp={opp}
                  gate={gateQuery.data}
                  verificationStatus={orgGateQuery.data?.verificationStatus}
                  onChanged={setNotice}
                />
              ))}
            </ul>
            <Pagination
              page={page}
              pages={Math.max(pages, 1)}
              statusText={t('list.count', { total })}
              previousLabel={t('list.previous')}
              nextLabel={t('list.next')}
              onPage={(target) => {
                if (target < 1) return;
                if (target === pageIdx + 1) return;
                if (target > pageIdx + 1 && listQuery.data.nextCursor) {
                  setCursors((c) => [...c, listQuery.data.nextCursor ?? undefined]);
                  setPageIdx(target - 1);
                } else if (target <= cursors.length) {
                  setPageIdx(target - 1);
                }
              }}
            />
          </>
        )}
      </div>
    </RequireOrgOpps>
  );
}
