'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowUpRight, Check, CircleCheck, Info, MapPin, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { backendMessageOf } from '@/lib/api/errors';
import {
  canAcceptApplication,
  canRejectApplication,
  canStartReviewApplication,
  rowId,
} from '@/lib/api/orgInbox';
import {
  useAcceptApplicationMutation,
  useApplicantProfileQuery,
  useOrgApplicationQuery,
  useRejectApplicationMutation,
  useStartReviewApplicationMutation,
} from '@/hooks/useOrgInbox';
import { useOwnOpportunityQuery } from '@/hooks/useOrgOpps';
import {
  experiencesGateOpen,
  localizedName,
  mergeUniqueById,
  registryCode,
  verifiedLineParts,
} from '@/lib/api/publicTalent';
import {
  usePublicTalentExperiencesQuery,
  usePublicTalentProfileQuery,
} from '@/hooks/usePublicTalent';
import {
  ApplicantAvatar,
  ApplicationStatusLine,
  ReasonDialog,
  SectionError,
  inboxApplicantName,
  inboxAvatarMediaId,
  joinName,
} from './components';

// Org application detail pane: header (avatar/name/location/public-profile
// link/decision buttons), target assignment + real position quota, submission
// meta (real ObjectId, never a fabricated TCA-APP code), full cover message,
// real skill tags, verified experiences from the public-volunteer data source
// (EXP-<registryId>, real org/date/description), accept notice matching the
// accept transaction (participant + seat, no team/staff roles), inline
// accept/reject-with-required-reason. "Ask clarification" stays deleted (no
// endpoint). Shared by the queue pane and the [applicationId] deep link.
export function ApplicationDetailCard({
  locale,
  applicationId,
  index,
  total,
  testIdPrefix = 'application-detail',
}: {
  locale: string;
  applicationId: string;
  index?: number;
  total?: number;
  testIdPrefix?: string;
}) {
  const t = useTranslations('orgReview');
  const activeLocale = useLocale();
  const detailQuery = useOrgApplicationQuery(applicationId);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const startReview = useStartReviewApplicationMutation();
  const accept = useAcceptApplicationMutation();
  const reject = useRejectApplicationMutation();

  const detail = detailQuery.data;
  const username =
    detail?.applicant?.username ?? detail?.volunteer?.username ?? undefined;
  const usernameKey = typeof username === 'string' ? username : '';

  // Same data source as the public volunteer profile: profile embeds the
  // skills/experiences windows (null when the volunteer opted out).
  const publicQuery = usePublicTalentProfileQuery(usernameKey);
  // Legacy permissive read of the same endpoint: fallback only, so a payload
  // the strict public shape rejects still renders the neutral hidden states
  // instead of a blank section.
  const legacyQuery = useApplicantProfileQuery(username ?? undefined);
  const gateOpen = experiencesGateOpen(publicQuery.data);
  const experiencesQuery = usePublicTalentExperiencesQuery(
    usernameKey,
    undefined,
    gateOpen && usernameKey !== '',
  );

  const opportunityId =
    (typeof detail?.opportunityId === 'string' && detail.opportunityId) ||
    (typeof (detail?.opportunity as { id?: unknown } | null)?.id === 'string'
      ? (detail?.opportunity as { id: string }).id
      : undefined);
  const positionId =
    typeof detail?.positionId === 'string' && detail.positionId
      ? detail.positionId
      : typeof (detail?.position as { id?: unknown } | null)?.id === 'string'
        ? (detail?.position as { id: string }).id
        : undefined;
  const oppQuery = useOwnOpportunityQuery(opportunityId);
  const oppPositions = oppQuery.data?.positions;
  const position = useMemo(() => {
    if (!Array.isArray(oppPositions) || !positionId) return null;
    return (
      oppPositions.find(
        (entry) =>
          typeof (entry as { _id?: unknown })._id !== 'undefined' &&
          String((entry as { _id?: unknown })._id) === positionId,
      ) ?? null
    );
  }, [oppPositions, positionId]);

  const profile = publicQuery.data;
  const profileExperiences = profile?.experiences;
  const pagedExperiences = experiencesQuery.data?.items;
  const gateExperiences = useMemo(
    () =>
      gateOpen ? mergeUniqueById(profileExperiences ?? [], pagedExperiences ?? []) : [],
    [gateOpen, profileExperiences, pagedExperiences],
  );

  if (detailQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (detailQuery.isError || !detail) {
    return <SectionError testId={`${testIdPrefix}-error`} message={t('shared.loadError')} />;
  }

  const status = detail.status;
  const statusLabel =
    status === 'pending'
      ? t('applications.newLabel')
      : ['under_review', 'accepted', 'rejected', 'withdrawn'].includes(status)
        ? t(`tabs.${status as 'under_review' | 'accepted' | 'rejected' | 'withdrawn'}`)
        : status;
  const applicantJoin = detail.applicant ?? detail.volunteer;
  const applicantLabel = inboxApplicantName(applicantJoin, locale);
  const positionTitle =
    (detail.position as { title?: unknown } | null)?.title ??
    (position as { title?: unknown } | null)?.title ??
    null;
  const positionName =
    typeof positionTitle === 'string' && positionTitle !== '' ? positionTitle : null;
  const opportunityName = joinName(detail.opportunity, locale);
  const createdAt = typeof detail.createdAt === 'string' ? new Date(detail.createdAt) : null;
  const createdValid = createdAt !== null && !Number.isNaN(createdAt.getTime());
  const submittedDate = createdValid
    ? createdAt.toLocaleDateString(activeLocale, { dateStyle: 'medium' })
    : null;
  const submittedTime = createdValid
    ? createdAt.toLocaleTimeString(activeLocale, { hour: '2-digit', minute: '2-digit' })
    : null;

  const requiredCount = (position as { requiredCount?: unknown } | null)?.requiredCount;
  const filledCount = (position as { filledCount?: unknown } | null)?.filledCount;
  const quota =
    typeof requiredCount === 'number' && typeof filledCount === 'number'
      ? {
          needed: requiredCount,
          accepted: filledCount,
          open: Math.max(requiredCount - filledCount, 0),
        }
      : null;

  const legacySkills = legacyQuery.data?.skills;
  const skills = profile?.skills ?? (Array.isArray(legacySkills) ? legacySkills : null);
  const skillsHidden = skills === null || skills === undefined;
  const experiences = gateExperiences;
  const canAccept = canAcceptApplication(status);
  const avatarMediaId = profile?.avatar ?? inboxAvatarMediaId(applicantJoin);
  const location = profile?.geographicBase ?? null;

  return (
    <div data-testid={testIdPrefix} className="flex min-w-0 flex-col">
      {/* Detail header: identity claims free space (flex-1) with a wrap
          floor so long names wrap at container width; action buttons wrap
          below instead of crushing the name column into a narrow strip. */}
      <div className="flex flex-col gap-4 border-b border-border-muted p-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between md:p-6">
        <div className="flex min-w-0 flex-1 items-start gap-4 sm:min-w-56">
          <ApplicantAvatar
            mediaId={avatarMediaId}
            name={applicantLabel}
            size={64}
            testId={`${testIdPrefix}-avatar`}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="min-w-0 break-words text-xl font-semibold text-ink">{applicantLabel}</h2>
              <ApplicationStatusLine status={status} label={statusLabel} />
            </div>
            {location ? (
              <p className="mt-0.5 flex min-w-0 items-center gap-1 text-sm text-ink-muted">
                <MapPin size={16} aria-hidden="true" className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{location}</span>
              </p>
            ) : null}
            {usernameKey !== '' ? (
              <Link
                href={`/volunteers/${encodeURIComponent(usernameKey)}`}
                data-testid={`${testIdPrefix}-public-profile`}
                className="mt-1.5 inline-flex min-w-0 items-center gap-0.5 text-sm font-medium text-primary hover:underline"
              >
                <span className="break-words">{t('applications.viewPublicProfile')}</span>
                <ArrowUpRight size={14} aria-hidden="true" className="shrink-0" />
              </Link>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-end sm:self-start">
          {canRejectApplication(status) ? (
            <button
              type="button"
              data-testid={`${testIdPrefix}-reject`}
              onClick={() => {
                setReason('');
                setRejectOpen(true);
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
            >
              <X size={18} aria-hidden="true" className="shrink-0" />
              <span>{t('applications.rejectCta')}</span>
            </button>
          ) : null}
          {canAccept ? (
            <button
              type="button"
              data-testid={`${testIdPrefix}-accept`}
              disabled={accept.isPending}
              onClick={() => accept.mutate({ applicationId })}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              <Check size={18} aria-hidden="true" className="shrink-0" />
              <span>{t('applications.acceptCta')}</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Target assignment + quota */}
      <div className="border-b border-border-muted bg-surface-muted px-4 py-3 md:px-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              {t('applications.targetAssignment')}
            </span>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-2">
              {positionName ? (
                <span className="text-sm font-semibold text-ink">{positionName}</span>
              ) : null}
              {positionName ? (
                <span aria-hidden="true" className="text-sm text-ink-muted">
                  ·
                </span>
              ) : null}
              {opportunityId ? (
                <Link
                  href={`/org/opportunities/${encodeURIComponent(opportunityId)}`}
                  data-testid={`${testIdPrefix}-opportunity`}
                  className="min-w-0 truncate text-sm text-primary hover:underline"
                >
                  {opportunityName}
                </Link>
              ) : (
                <span className="truncate text-sm text-ink-muted">{opportunityName}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col md:items-end">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              {t('applications.positionQuota')}
            </span>
            {quota ? (
              <span data-testid={`${testIdPrefix}-quota`} className="mt-0.5 text-sm text-ink">
                {t('applications.quotaLine', {
                  needed: quota.needed,
                  accepted: quota.accepted,
                  open: quota.open,
                })}
              </span>
            ) : null}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border-muted pt-2 text-xs text-ink-muted">
          {submittedDate && submittedTime ? (
            <span>
              {t('applications.submittedOn', { date: submittedDate, time: submittedTime })}
            </span>
          ) : null}
          <span data-testid={`${testIdPrefix}-id`} className="break-all">
            {t('applications.applicationId', { id: rowId(detail) })}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-6 p-4 md:p-6">
        {/* Cover message */}
        {typeof detail.message === 'string' && detail.message.trim() !== '' ? (
          <section aria-label={t('applications.coverTitle')}>
            <h3 className="mb-2 text-sm font-semibold text-ink">{t('applications.coverTitle')}</h3>
            <p
              data-testid={`${testIdPrefix}-message`}
              className="rounded-lg border border-border-muted bg-surface-muted p-4 text-sm leading-relaxed text-ink"
            >
              {detail.message}
            </p>
          </section>
        ) : null}

        {/* Skills */}
        <section aria-label={t('applications.skillsTitle')}>
          <h3 className="mb-2.5 text-sm font-semibold text-ink">{t('applications.skillsTitle')}</h3>
          {publicQuery.isPending || legacyQuery.isPending ? (
            <Loader label={t('shared.loading')} />
          ) : skillsHidden ? (
            <p data-testid={`${testIdPrefix}-applicant-skills-empty`} className="text-sm text-ink-muted">
              {t('applications.applicantHidden')}
            </p>
          ) : (skills as unknown[]).length === 0 ? (
            <p data-testid={`${testIdPrefix}-applicant-skills-none`} className="text-sm text-ink-muted">
              {t('shared.empty')}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(skills as unknown[]).slice(0, 12).map((skill, itemIndex) => (
                <li
                  key={itemIndex}
                  data-testid={`${testIdPrefix}-applicant-skill`}
                  className="rounded-lg border border-border-muted bg-surface px-3 py-2.5 text-sm font-medium text-ink"
                >
                  {skillLabel(skill, locale)}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Verified experiences (public-volunteer data source) */}
        <section aria-label={t('applications.experiencesTitle')}>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">{t('applications.experiencesTitle')}</h3>
            {gateOpen ? (
              <span
                data-testid={`${testIdPrefix}-applicant-experiences-count`}
                className="text-xs text-ink-muted"
              >
                {t('applications.experiencesCount', { count: experiences.length })}
              </span>
            ) : null}
          </div>
          {publicQuery.isPending || (gateOpen && experiencesQuery.isPending) ? (
            <Loader label={t('shared.loading')} />
          ) : !gateOpen ? (
            <p
              data-testid={`${testIdPrefix}-applicant-experiences-empty`}
              className="text-sm text-ink-muted"
            >
              {t('applications.applicantHidden')}
            </p>
          ) : experiences.length === 0 ? (
            <p
              data-testid={`${testIdPrefix}-applicant-experiences-none`}
              className="text-sm text-ink-muted"
            >
              {t('shared.empty')}
            </p>
          ) : (
            <ul className="divide-y divide-border-muted overflow-hidden rounded-lg border border-border-muted">
              {experiences.map((experience) => {
                const parts = verifiedLineParts(experience, locale);
                const code = registryCode(experience.registryId, 'EXP');
                const verifiedDate =
                  parts.verifiedAt !== null
                    ? new Date(parts.verifiedAt).toLocaleDateString(activeLocale, {
                        dateStyle: 'medium',
                      })
                    : null;
                return (
                  <li
                    key={experience.id}
                    data-testid={`${testIdPrefix}-applicant-experience`}
                    className="flex flex-col gap-1 bg-surface p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">
                        {experience.title}
                        {parts.organization !== '' ? (
                          <span className="font-normal text-ink-muted"> · {parts.organization}</span>
                        ) : null}
                      </p>
                      {verifiedDate ? (
                        <span className="shrink-0 text-xs text-ink-muted">{verifiedDate}</span>
                      ) : null}
                    </div>
                    {experience.description ? (
                      <p className="text-sm leading-normal text-ink-muted">
                        {experience.description}
                      </p>
                    ) : null}
                    <p className="text-xs font-medium text-status-success">
                      {t('applications.verifiedBy', {
                        organization:
                          parts.organization !== ''
                            ? parts.organization
                            : localizedName(experience.organization, locale),
                        code: code ?? experience.registryId,
                      })}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Accept notice — matches the accept transaction exactly */}
        {canAccept && positionName ? (
          <div className="flex items-start gap-3 rounded-lg border border-border-muted bg-surface-muted p-3.5">
            <Info size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
            <p className="text-sm leading-normal text-ink">
              {t('applications.acceptNotice', {
                name: applicantLabel,
                position: positionName,
                opportunity: opportunityName,
              })}
            </p>
          </div>
        ) : null}

        {/* Inline action states (never toasts) */}
        {canStartReviewApplication(status) ? (
          <div>
            <button
              type="button"
              data-testid={`${testIdPrefix}-start-review`}
              disabled={startReview.isPending}
              onClick={() => startReview.mutate({ applicationId })}
              className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted disabled:opacity-50"
            >
              {t('applications.startReview')}
            </button>
          </div>
        ) : null}
        {status === 'accepted' ? (
          <p
            data-testid={`${testIdPrefix}-accepted-note`}
            className="flex items-center gap-1.5 text-sm font-medium text-ink"
          >
            <CircleCheck size={16} aria-hidden="true" className="shrink-0 text-status-success" />
            <span>{t('applications.participantAdded')}</span>
            <span aria-hidden="true" className="text-ink-muted">
              ·
            </span>
            <Link href="/org/participants" className="font-medium text-primary hover:underline">
              {t('applications.viewParticipants')} →
            </Link>
          </p>
        ) : null}
        {startReview.isError || accept.isError ? (
          <SectionError
            testId={`${testIdPrefix}-action-error`}
            message={backendMessageOf(startReview.error ?? accept.error) ?? t('shared.actionError')}
          />
        ) : null}
        {rejectOpen ? (
          <ReasonDialog
            testId={`${testIdPrefix}-reject-dialog`}
            title={t('applications.rejectTitle')}
            reasonLabel={t('applications.reasonLabel')}
            reasonPlaceholder={t('applications.reasonPlaceholder')}
            requiredMessage={t('applications.reasonRequired')}
            reason={reason}
            onReason={setReason}
            confirmLabel={t('applications.confirm')}
            cancelLabel={t('applications.cancel')}
            pending={reject.isPending}
            onConfirm={() =>
              reject.mutate(
                { applicationId, reason: reason.trim() },
                { onSuccess: () => setRejectOpen(false) },
              )
            }
            onCancel={() => setRejectOpen(false)}
          />
        ) : null}
        {reject.isError ? (
          <SectionError
            testId={`${testIdPrefix}-reject-error`}
            message={backendMessageOf(reject.error) ?? t('shared.actionError')}
          />
        ) : null}
      </div>

      {/* Footer action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-muted bg-surface-muted p-4">
        {typeof index === 'number' && typeof total === 'number' ? (
          <span className="text-xs text-ink-muted">
            {t('applications.reviewingOf', { index: index + 1, total })}
          </span>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {canRejectApplication(status) && !rejectOpen ? (
            <button
              type="button"
              data-testid={`${testIdPrefix}-reject-footer`}
              onClick={() => {
                setReason('');
                setRejectOpen(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm text-ink transition-colors hover:bg-surface-muted"
            >
              <X size={16} aria-hidden="true" className="shrink-0" />
              <span>{t('applications.rejectCta')}</span>
            </button>
          ) : null}
          {canAccept ? (
            <button
              type="button"
              data-testid={`${testIdPrefix}-accept-footer`}
              disabled={accept.isPending}
              onClick={() => accept.mutate({ applicationId })}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              <Check size={16} aria-hidden="true" className="shrink-0" />
              <span>{t('applications.acceptCta')}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function skillLabel(skill: unknown, locale: string): string {
  if (typeof skill === 'string') return skill;
  if (skill && typeof skill === 'object') {
    const record = skill as Record<string, unknown>;
    if (locale === 'ar') {
      for (const key of ['nameAr', 'nameFr', 'name', 'title']) {
        if (typeof record[key] === 'string' && (record[key] as string).length > 0) {
          return record[key] as string;
        }
      }
    } else {
      for (const key of ['nameFr', 'nameAr', 'name', 'title']) {
        if (typeof record[key] === 'string' && (record[key] as string).length > 0) {
          return record[key] as string;
        }
      }
    }
  }
  return '—';
}

export function ApplicationDetail({
  locale,
  applicationId,
  testIdPrefix,
}: {
  locale: string;
  applicationId: string;
  testIdPrefix: string;
}) {
  return (
    <Card>
      <ApplicationDetailCard
        locale={locale}
        applicationId={applicationId}
        testIdPrefix={testIdPrefix}
      />
    </Card>
  );
}
