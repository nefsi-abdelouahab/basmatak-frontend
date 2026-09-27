'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { mapToApiError } from '@/lib/api/errors';
import {
  PARTICIPANT_STATUSES,
  canRemoveParticipation,
  rowId,
  type InboxParticipant,
  type ParticipantStatus,
} from '@/lib/api/orgInbox';
import { useOrgParticipantsQuery, useRemoveParticipationMutation } from '@/hooks/useOrgInbox';
import { ReasonDialog, RequireOrg, SectionError, StatusPill, TabBar, joinName } from '../applications/components';

// F11-owned Participants roster: aggregate (?q=&opportunityId=&status=) incl.
// completed, submission-state/files join per row, inline expansion +
// deep-linkable [participationId] (initial-expanded row), remove with
// required reason. No messaging UI.
export function OrgParticipantsPage({
  locale,
  initialExpanded,
}: {
  locale: string;
  initialExpanded?: string;
}) {
  const t = useTranslations('orgReview');
  const [tab, setTab] = useState<ParticipantStatus>('active');
  const [q, setQ] = useState('');
  const [opportunityId, setOpportunityId] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<InboxParticipant[]>([]);
  const [expanded, setExpanded] = useState<string | null>(initialExpanded ?? null);
  // No single-read endpoint exists for org participations, so the panel for
  // a removed row renders from the last-known row plus the decided outcome.
  const rowCache = useRef(new Map<string, InboxParticipant>());
  const [outcome, setOutcome] = useState<{ id: string; status: string } | null>(null);

  const listQuery = useOrgParticipantsQuery({
    q: q || undefined,
    opportunityId: opportunityId || undefined,
    status: tab,
    cursor,
  });

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
    setExpanded(initialExpanded ?? null);
    setOutcome(null);
  }, [tab, q, opportunityId, initialExpanded]);

  useEffect(() => {
    if (listQuery.data) {
      const pageItems = listQuery.data.items as InboxParticipant[];
      for (const row of pageItems) rowCache.current.set(rowId(row), row);
      if (cursor === undefined) setItems(pageItems);
      else setItems((prev) => [...prev, ...pageItems]);
    }
  }, [listQuery.data, cursor]);

  const tabs = PARTICIPANT_STATUSES.map((value) => ({
    value,
    label: t(`tabs.${value}`),
  }));
  const statusLabels: Record<string, string> = Object.fromEntries(
    tabs.map((tabEntry) => [tabEntry.value, tabEntry.label]),
  );
  const forbidden =
    listQuery.isError && mapToApiError(listQuery.error).statusCode === 403;
  // A removed row leaves the current tab (server-side filter), which would
  // unmount its own panel mid-flow. The panel below persists outside the
  // list with the decided outcome so the removal is visible.
  const detached =
    expanded !== null && !items.some((row) => rowId(row) === expanded);
  const detachedRow =
    detached && expanded
      ? (() => {
          const cached = rowCache.current.get(expanded);
          if (!cached) return undefined;
          return outcome && outcome.id === expanded
            ? { ...cached, status: outcome.status }
            : cached;
        })()
      : undefined;

  return (
    <RequireOrg locale={locale} next={`/${locale}/org/participants`}>
      <div data-testid="org-participants" className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('participants.title')}</h1>
          <p className="text-sm text-ink-muted">{t('participants.subtitle')}</p>
        </div>

        <TabBar
          tabs={tabs}
          active={tab}
          onTab={(value) => setTab(value as ParticipantStatus)}
          testId="participant-tabs"
        />

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-52 flex-1">
            <Input
              id="participants-q"
              label={t('shared.searchLabel')}
              placeholder={t('shared.searchPlaceholder')}
              value={q}
              onChange={(event) => setQ(event.target.value)}
              data-testid="participants-search"
            />
          </div>
          <div className="min-w-52 flex-1">
            <Input
              id="participants-opportunity"
              label={t('shared.opportunityLabel')}
              placeholder={t('shared.allOpportunities')}
              value={opportunityId}
              onChange={(event) => setOpportunityId(event.target.value.trim())}
              data-testid="participants-opportunity"
            />
          </div>
          {q || opportunityId ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="participants-clear"
              onClick={() => {
                setQ('');
                setOpportunityId('');
              }}
            >
              {t('shared.clearFilters')}
            </Button>
          ) : null}
        </div>

        {listQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {forbidden ? (
          <SectionError testId="participants-forbidden" message={t('shared.loadError')} />
        ) : listQuery.isError ? (
          <SectionError testId="participants-error" message={t('shared.loadError')} />
        ) : (
          <Card>
            <p data-testid="participants-count" className="mb-3 text-sm font-medium text-ink">
              {t('participants.count', { total: listQuery.data?.total ?? items.length })}
            </p>
            {items.length === 0 && !detachedRow ? (
              <Empty title={t('shared.empty')} />
            ) : (
              <>
                {items.length > 0 ? (
                  <ul className="flex flex-col gap-3">
                    {items.map((row) => {
                      const id = rowId(row);
                      const isOpen = expanded === id;
                      return (
                        <li
                          key={id}
                          data-testid="participant-row"
                          className="rounded-md border border-border-muted bg-surface-muted p-3"
                        >
                          <button
                            type="button"
                            data-testid={`participant-expand-${id}`}
                            aria-expanded={isOpen}
                            onClick={() => setExpanded(isOpen ? null : id)}
                            className="flex w-full flex-wrap items-center justify-between gap-2 text-start"
                          >
                            <span className="font-medium text-ink">{joinName(row.volunteer, locale)}</span>
                            <StatusPill status={row.status} label={statusLabels[row.status] ?? row.status} />
                          </button>
                          <span className="mt-1 block text-sm text-ink-muted">
                            {joinName(row.opportunity, locale)}
                            {submissionStateOf(row) ? ` · ${submissionStateOf(row)}` : ''}
                          </span>
                          {isOpen ? (
                            <div className="mt-3">
                              <ParticipantPanel
                                row={row}
                                testIdPrefix="participant-detail"
                                onDecided={(decidedId) => setOutcome({ id: decidedId, status: 'removed' })}
                              />
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {detachedRow ? (
                  <div className="mt-3">
                    <ParticipantPanel
                      row={detachedRow}
                      testIdPrefix="participant-detail"
                      onDecided={(decidedId) => setOutcome({ id: decidedId, status: 'removed' })}
                    />
                  </div>
                ) : null}
              </>
            )}
            {listQuery.data?.nextCursor ? (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={listQuery.isFetching}
                  onClick={() => setCursor(listQuery.data?.nextCursor ?? undefined)}
                  data-testid="participants-more"
                >
                  {t('shared.next')}
                </Button>
              </div>
            ) : null}
          </Card>
        )}
      </div>
    </RequireOrg>
  );
}

// Joined submission state/files on the roster row: real submission vocabulary
// only (the row carries the join — no extra endpoint is called).
export function submissionStateOf(row: InboxParticipant): string | null {
  const submission = row.submission;
  if (submission && typeof submission === 'object') {
    const status = (submission as Record<string, unknown>).status;
    if (typeof status === 'string' && status.length > 0) return status;
  }
  return null;
}

export function ParticipantPanel({
  row,
  testIdPrefix,
  onDecided,
}: {
  row: InboxParticipant;
  testIdPrefix: string;
  onDecided?: (participationId: string) => void;
}) {
  const t = useTranslations('orgReview');
  const [removeOpen, setRemoveOpen] = useState(false);
  const [reason, setReason] = useState('');
  const remove = useRemoveParticipationMutation();
  const id = rowId(row);
  const submissionState = submissionStateOf(row);

  return (
    <div data-testid={testIdPrefix} className="flex flex-col gap-3">
      {submissionState ? (
        <p data-testid={`${testIdPrefix}-submission`} className="text-sm text-ink-muted">
          {t('participants.submissionLabel')}: {submissionState}
        </p>
      ) : null}
      {canRemoveParticipation(row.status) && !removeOpen ? (
        <div>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => {
              setReason('');
              setRemoveOpen(true);
            }}
            data-testid={`${testIdPrefix}-remove`}
          >
            {t('participants.remove')}
          </Button>
        </div>
      ) : null}
      {removeOpen ? (
        <ReasonDialog
          testId={`${testIdPrefix}-remove-dialog`}
          title={t('participants.removeTitle')}
          reasonLabel={t('participants.reasonLabel')}
          reasonPlaceholder={t('participants.reasonPlaceholder')}
          requiredMessage={t('participants.reasonRequired')}
          reason={reason}
          onReason={setReason}
          confirmLabel={t('participants.confirm')}
          cancelLabel={t('participants.cancel')}
          pending={remove.isPending}
          onConfirm={() =>
            remove.mutate(
              { participationId: id, reason: reason.trim() },
              {
                onSuccess: () => {
                  setRemoveOpen(false);
                  onDecided?.(id);
                },
              },
            )
          }
          onCancel={() => setRemoveOpen(false)}
        />
      ) : null}
      {remove.isError ? (
        <SectionError
          testId={`${testIdPrefix}-remove-error`}
          message={mapToApiError(remove.error).message}
        />
      ) : null}
    </div>
  );
}
