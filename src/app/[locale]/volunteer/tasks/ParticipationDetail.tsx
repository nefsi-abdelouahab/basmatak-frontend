'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { Button } from '@/components/ui/Button';
import {
  canWithdrawParticipation,
  participationTimeline,
  rowId,
} from '@/lib/api/tasks';
import {
  useDownloadAttestationMutation,
  useParticipationQuery,
  useWithdrawParticipationMutation,
} from '@/hooks/useTasks';
import {
  ConfirmDialog,
  SectionError,
  StatusPill,
  StatusTimeline,
  joinName,
} from '../applications/components';

// Backend participation rows carry `schedule: { startDate, endDate }` and a
// position-level `startAt` (the opportunity embed has no dates). Read the
// schedule first, then fall back to the position start, keeping the legacy
// schedule/opportunity spellings tolerated by older fixtures.
export function formatSchedule(
  schedule: unknown,
  opportunity: unknown,
  locale: string,
  position?: unknown,
): string {
  if (typeof schedule === 'string' && schedule.trim() !== '') return schedule;
  const record =
    schedule !== null && typeof schedule === 'object'
      ? (schedule as Record<string, unknown>)
      : null;
  const opp = opportunity as Record<string, unknown> | null | undefined;
  const pos = position as Record<string, unknown> | null | undefined;
  const asIso = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() !== '' ? value : null;

  const start =
    asIso(record?.startDate) ??
    asIso(record?.startAt) ??
    asIso(pos?.startAt) ??
    asIso(opp?.startDate);
  const end =
    asIso(record?.endDate) ?? asIso(record?.endAt) ?? asIso(opp?.endDate);

  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale);
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return fmt(start);
  if (end) return fmt(end);
  return '—';
}

// Location labels arrive as `{ wilaya: { nameFr, nameAr } | null,
// municipality: { nameFr, nameAr } | null }` (backend
// resolveLocationLabels); older rows/tests join a flat label object.
function formatLocation(
  locationLabels: unknown,
  locale: string,
): string {
  if (locationLabels !== null && typeof locationLabels === 'object') {
    const labels = locationLabels as {
      wilaya?: { nameFr?: string | null; nameAr?: string | null } | null;
      municipality?: { nameFr?: string | null; nameAr?: string | null } | null;
    };
    if ('wilaya' in labels || 'municipality' in labels) {
      const parts = [labels.municipality, labels.wilaya]
        .map((part) => joinName(part ?? null, locale))
        .filter((part) => part !== '—' && part !== '');
      return parts.length > 0 ? parts.join(' · ') : '—';
    }
  }
  return joinName(
    locationLabels as {
      nameFr?: string | null;
      nameAr?: string | null;
      name?: string | null;
      title?: string | null;
      slug?: string | null;
    } | null | undefined,
    locale,
  );
}

// F6-owned participation detail: joined context, neutral timeline,
// leave-with-confirm, conditional attestation blob download, onward link
// to the F7 submit route. No submission editing, no messaging UI.
export function ParticipationDetail({
  participationId,
  locale,
  onLeft,
}: {
  participationId: string;
  locale: string;
  onLeft?: () => void;
}) {
  const t = useTranslations('volunteerTasks');
  const detailQuery = useParticipationQuery(participationId);
  const withdraw = useWithdrawParticipationMutation();
  const attestation = useDownloadAttestationMutation();
  const [confirming, setConfirming] = useState(false);
  const [left, setLeft] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  if (detailQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (detailQuery.isError || !detailQuery.data)
    return <SectionError testId="participation-detail-error" message={t('participations.detailError')} />;

  const row = detailQuery.data;
  const timeline = participationTimeline(row.status);
  const terminalNote =
    timeline.terminal === 'withdrawn'
      ? t('timeline.withdrawnNote')
      : timeline.terminal === 'removed'
        ? t('timeline.removedNote')
        : null;

  const deliverables = Array.isArray((row.position as { deliverables?: unknown } | null)?.deliverables)
    ? ((row.position as { deliverables?: unknown }).deliverables as unknown[])
    : [];
  const experienceId = row.experienceId ?? null;

  const statusLabels: Record<string, string> = {
    accepted: t('tabs.accepted'),
    active: t('tabs.active'),
    completed: t('tabs.completed'),
    withdrawn: t('tabs.withdrawn'),
    removed: t('tabs.removed'),
  };

  const onLeave = () => {
    withdraw.mutate(participationId, {
      onSuccess: () => {
        setConfirming(false);
        setLeft(true);
        onLeft?.();
      },
    });
  };

  const onDownload = () => {
    if (!experienceId) return;
    attestation.mutate(experienceId, {
      onSuccess: () => setDownloaded(true),
    });
  };

  return (
    <Card>
      <div data-testid="participation-detail" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">{joinName(row.opportunity, locale)}</p>
          <StatusPill status={row.status} label={statusLabels[row.status] ?? row.status} />
        </div>

        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-muted">{t('participations.organizationLabel')}</dt>
            <dd className="font-medium text-ink">{joinName(row.organization, locale)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">{t('participations.positionLabel')}</dt>
            <dd className="font-medium text-ink">{joinName(row.position, locale)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">{t('participations.scheduleLabel')}</dt>
            <dd className="font-medium text-ink">
              {formatSchedule(row.schedule, row.opportunity, locale, row.position)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">{t('participations.locationLabel')}</dt>
            <dd className="font-medium text-ink">{formatLocation(row.locationLabels, locale)}</dd>
          </div>
        </dl>

        <div>
          <p className="text-sm text-ink-muted">{t('participations.deliverablesLabel')}</p>
          {deliverables.length > 0 ? (
            <ul className="mt-1 flex flex-col gap-1">
              {deliverables.map((item, index) => (
                <li key={index} data-testid="deliverable-item" className="text-sm text-ink">
                  {typeof item === 'string' ? item : JSON.stringify(item)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink">—</p>
          )}
        </div>

        <StatusTimeline
          steps={timeline.steps}
          labels={[t('timeline.taskAccepted'), t('timeline.taskActive'), t('timeline.taskCompleted')]}
          terminalNote={terminalNote}
          testId="participation-timeline"
        />

        {row.reason ? (
          <p data-testid="participation-reason" className="text-sm text-ink-muted">
            {row.reason}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link
            data-testid="submit-link"
            href={`/volunteer/tasks/${rowId(row)}/submit`}
            className="text-sm font-medium text-gold-strong"
          >
            {t('participations.submitCta')}
          </Link>
        </div>

        {experienceId ? (
          <div className="flex flex-col gap-2">
            {attestation.isError ? (
              <SectionError testId="attestation-error" message={t('participations.attestationError')} />
            ) : null}
            {downloaded ? (
              <p data-testid="attestation-success" role="status" className="text-sm text-status-success">
                {t('participations.attestationDownloaded')}
              </p>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="attestation-download"
              disabled={attestation.isPending}
              onClick={onDownload}
            >
              {attestation.isPending
                ? t('participations.attestationDownloading')
                : t('participations.attestationCta')}
            </Button>
          </div>
        ) : (
          <p data-testid="attestation-unavailable" className="text-sm text-ink-muted">
            {t('participations.attestationUnavailable')}
          </p>
        )}

        {withdraw.isError ? (
          <SectionError testId="leave-error" message={t('participations.withdrawError')} />
        ) : null}
        {left ? (
          <p data-testid="leave-success" role="status" className="text-sm text-status-success">
            {t('participations.withdrawn')}
          </p>
        ) : null}

        {canWithdrawParticipation(row.status) && !left ? (
          confirming ? (
            <ConfirmDialog
              testId="leave-confirm"
              title={t('participations.withdrawTitle')}
              body={t('participations.withdrawBody')}
              confirmLabel={t('participations.withdrawCta')}
              cancelLabel={t('shared.cancel')}
              pendingLabel={t('participations.withdrawing')}
              pending={withdraw.isPending}
              onConfirm={onLeave}
              onCancel={() => setConfirming(false)}
            />
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="leave-button"
              onClick={() => setConfirming(true)}
            >
              {t('participations.withdrawCta')}
            </Button>
          )
        ) : null}
      </div>
    </Card>
  );
}
