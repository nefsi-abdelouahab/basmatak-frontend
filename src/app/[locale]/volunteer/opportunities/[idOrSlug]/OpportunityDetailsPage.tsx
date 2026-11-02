'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { Pill } from '@/components/ui/Pill';
import { mapToApiError } from '@/lib/api/errors';
import { useSessionQuery, getLoginHref } from '@/hooks/useSession';
import {
  applyGateFor,
  useApplyMutation,
  useCoverMediaQuery,
  useMyApplicationQuery,
  useOpportunityDetailQuery,
  useRelatedOpportunitiesQuery,
  useReportOpportunityMutation,
  useWithdrawMutation,
} from '@/hooks/useOpportunity';
import {
  coverUrlOf,
  detailIdOf,
  labelFor,
  myApplicationIdOf,
  orgDisplayName,
  positionKeyOf,
  type OpportunityDetail,
  type OpportunityPosition,
} from '@/lib/api/opportunity';
import { ApplyDialog, ReportDialog, WithdrawDialog } from './OpportunityDialogs';

// Volunteer opportunity details (F5-owned route). Guests may view; every
// authed action redirects guests to Login with `next` (decision 10).
// Perks/logistics blocks were CUT (FCD) and never render. The org sidebar
// renders the detail `organization` embed only — the embed carries no
// reliability sub-object (verified in opportunity-embed.provider.ts;
// reliability is F18-owned), so no extra endpoint is called and no stat is
// invented. Sidebar links to the real public org profile via the embedded
// slug; no registration/dispatch/authority copy anywhere.
//
// Icon map (Opportunity Details code.html Material Symbol -> lucide-react):
// arrow_forward -> ArrowRight, calendar_month -> CalendarDays,
// check/check_circle -> CircleCheck (neutral requirement markers),
// fact_check -> ClipboardCheck (neutral requirements header only — never the
// deleted statutory section), flag -> Flag, group -> Users,
// location_on/pin_drop -> MapPin, schedule/timer/hourglass_top -> Clock,
// send -> Send, share -> Share2, shield/verified -> BadgeCheck,
// assignment_turned_in/task -> ListChecks, open_in_new -> ExternalLink.
// DELETED with the Law 12-06 / statutory framework (no neutral reuse):
// gavel, security, verified_user ("Law 12-06 Accredited" badge).
// Hospitality/perks rows (restaurant, lunch_dining, military_tech) are OMITTED:
// no API fields exist (FCD CUT) — listed as gaps, never invented.

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

function hoursOf(durationMinutes: number | null | undefined): string | null {
  if (typeof durationMinutes !== 'number' || durationMinutes <= 0) return null;
  const hours = Math.round((durationMinutes / 60) * 10) / 10;
  return String(hours);
}

function deadlineDaysLeft(deadline: string | null | undefined, now: number): number | null {
  if (!deadline) return null;
  const time = new Date(deadline).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.ceil((time - now) / 86_400_000);
}

function modeLabel(
  mode: string | null | undefined,
  labels: { onsite: string; remote: string; hybrid: string },
): string | null {
  if (!mode) return null;
  if (mode === 'onsite') return labels.onsite;
  if (mode === 'remote') return labels.remote;
  if (mode === 'hybrid') return labels.hybrid;
  return mode;
}

function MetaItem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">{title}</span>
      <div className="text-sm font-medium text-ink">{children}</div>
    </div>
  );
}

export function OpportunityDetailsPage({ locale, idOrSlug }: { locale: string; idOrSlug: string }) {
  const t = useTranslations('opportunityDetails');
  const c = useTranslations('common');
  const router = useRouter();
  const session = useSessionQuery();
  const isGuest = session.isError;

  const detailQuery = useOpportunityDetailQuery(idOrSlug);
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyCode, setApplyCode] = useState<string | null>(null);
  const [applyDone, setApplyDone] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawDone, setWithdrawDone] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  const detail = detailQuery.data ?? null;
  const positions = useMemo(() => detail?.positions ?? [], [detail]);
  const selectedPosition: OpportunityPosition | null = useMemo(() => {
    if (positions.length === 0) return null;
    return positions.find((p) => positionKeyOf(p) === selectedPositionId) ?? positions[0] ?? null;
  }, [positions, selectedPositionId]);
  const selectedKey = selectedPosition ? positionKeyOf(selectedPosition) : null;
  const opportunityId = detail ? detailIdOf(detail) : '';

  const relatedQuery = useRelatedOpportunitiesQuery(detail?.categoryId, opportunityId);
  const coverQuery = useCoverMediaQuery(detail?.coverMediaId);
  const mineQuery = useMyApplicationQuery(opportunityId, selectedKey, !isGuest && detailQuery.isSuccess);
  const applyMutation = useApplyMutation(opportunityId);
  const withdrawMutation = useWithdrawMutation();
  const reportMutation = useReportOpportunityMutation();

  const now = Date.now();
  const gate = detail && selectedPosition ? applyGateFor(detail, selectedPosition) : null;
  const gateNote =
    gate === 'full'
      ? t('positions.fullNote')
      : gate === 'deadline'
        ? t('positions.deadlineNote')
        : gate === 'closed'
          ? t('positions.closedNote')
          : null;

  if (detailQuery.isPending || session.isPending) {
    return <Loader label={t('shared.loading')} />;
  }

  if (detailQuery.isError) {
    const err = mapToApiError(detailQuery.error);
    if (err.statusCode === 404) {
      return (
        <div data-testid="opportunity-details" className="flex min-w-0 flex-col gap-6">
          <Empty
            title={t('detail.notFoundTitle')}
            description={t('detail.notFoundBody')}
            action={
              <Link href="/volunteer/opportunities" className="text-sm font-medium text-gold-strong">
                {t('detail.backAction')}
              </Link>
            }
          />
        </div>
      );
    }
    return (
      <div data-testid="opportunity-details" className="flex min-w-0 flex-col gap-6">
        <p data-testid="detail-error" role="alert" className="text-sm text-status-error">
          {t('shared.loadError')}
        </p>
        <Button variant="secondary" onClick={() => detailQuery.refetch()}>
          {t('shared.retry')}
        </Button>
      </div>
    );
  }

  if (!detail) return <Loader label={t('shared.loading')} />;

  const next = `/volunteer/opportunities/${idOrSlug}`;

  function requireAuth(): boolean {
    if (isGuest) {
      router.push(getLoginHref(next));
      return false;
    }
    return true;
  }

  function openApply() {
    if (!requireAuth() || !selectedPosition || gate) return;
    setApplyCode(null);
    setApplyDone(false);
    setApplyOpen(true);
  }

  function submitApply(message?: string) {
    if (!selectedKey) return;
    setApplyCode(null);
    applyMutation.mutate(
      { positionId: selectedKey, input: message ? { message } : {} },
      {
        onSuccess: () => {
          setApplyDone(true);
          setApplyOpen(false);
        },
        onError: (err) => setApplyCode(mapToApiError(err).code),
      },
    );
  }

  function confirmWithdraw() {
    const appId = mineQuery.data ? myApplicationIdOf(mineQuery.data) : '';
    if (!appId) return;
    withdrawMutation.mutate(appId, {
      onSuccess: () => {
        setWithdrawDone(true);
        setWithdrawOpen(false);
      },
    });
  }

  function submitReport(input: { reason: string; description?: string }) {
    reportMutation.mutate(
      { targetId: opportunityId, reason: input.reason, description: input.description },
      { onSuccess: () => setReportDone(true) },
    );
  }

  const orgName = orgDisplayName(detail.organization, locale);
  const categoryName = labelFor(detail.categoryName, locale);
  const wilayaName = labelFor(detail.locationLabels?.wilaya, locale);
  const municipalityName = labelFor(detail.locationLabels?.municipality, locale);
  const hours = hoursOf(detail.durationMinutes);
  const daysLeft = deadlineDaysLeft(detail.applicationDeadline, now);
  const coverUrl = coverUrlOf(coverQuery.data);
  const myApp = mineQuery.data ?? null;

  return (
    <div data-testid="opportunity-details" className="flex min-w-0 flex-col gap-6">
      <nav aria-label={c('a11y.breadcrumb')} className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/volunteer/opportunities" className="font-medium text-ink-muted">
          {t('detail.backToOpportunities')}
        </Link>
        <span aria-hidden="true" className="text-ink-muted">
          /
        </span>
        <span className="max-w-xs truncate font-medium text-ink">{detail.title}</span>
        {detail.registryId ? (
          <Pill tone="neutral">
            <span data-testid="detail-ref">OPP-{detail.registryId.replace(/^OPP-/, '')}</span>
          </Pill>
        ) : null}
      </nav>

      {applyDone ? (
        <p data-testid="apply-success" role="status" className="text-sm font-medium text-status-success">
          {t('apply.success')}
        </p>
      ) : null}
      {withdrawDone ? (
        <p data-testid="withdraw-success" role="status" className="text-sm font-medium text-status-success">
          {t('withdraw.success')}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <div data-testid="detail-header" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-ink">{orgName}</span>
                {detail.organization?.verificationStatus === 'verified' ? (
                  <Pill tone="success">{t('detail.verifiedOrg')}</Pill>
                ) : null}
                {categoryName ? <Pill tone="neutral">{categoryName}</Pill> : null}
              </div>
              <h1 className="text-2xl font-bold text-ink">{detail.title}</h1>
              {detail.description ? (
                <p className="text-sm leading-relaxed text-ink-muted">{detail.description}</p>
              ) : null}
            </div>
            <div data-testid="detail-meta" className="mt-4 grid grid-cols-2 gap-4 border-t border-border-muted pt-4 sm:grid-cols-3">
              <MetaItem title={t('detail.locationTitle')}>
                {[wilayaName, municipalityName].filter(Boolean).join(' — ') || '—'}
              </MetaItem>
              <MetaItem title={t('detail.datesTitle')}>
                {[formatDate(detail.startDate, locale), formatDate(detail.endDate, locale)]
                  .filter(Boolean)
                  .join(' → ') || '—'}
                {hours ? <span className="block text-ink-muted">{t('detail.durationHours', { hours })}</span> : null}
              </MetaItem>
              <MetaItem title={t('detail.deadlineTitle')}>
                {formatDate(detail.applicationDeadline, locale) || '—'}
                {daysLeft !== null && daysLeft >= 0 ? (
                  <span className="block text-status-pending">
                    {daysLeft === 0
                      ? t('detail.deadlineToday')
                      : t('detail.deadlineRemaining', { days: daysLeft })}
                  </span>
                ) : null}
              </MetaItem>
              <MetaItem title={t('certificate.title')}>{t('certificate.body')}</MetaItem>
              {detail.mode ? (
                <MetaItem title={t('detail.modeTitle')}>
                  {modeLabel(detail.mode, {
                    onsite: t('detail.modeOnsite'),
                    remote: t('detail.modeRemote'),
                    hybrid: t('detail.modeHybrid'),
                  })}
                </MetaItem>
              ) : null}
              {(detail.prerequisites ?? []).length > 0 ? (
                <MetaItem title={t('detail.prerequisitesTitle')}>
                  <ul className="list-inside list-disc">
                    {(detail.prerequisites ?? []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </MetaItem>
              ) : null}
            </div>
          </Card>

          {detail.coverMediaId ? (
            <Card>
              {coverQuery.isPending ? (
                <Loader label={t('shared.loading')} />
              ) : coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  data-testid="detail-cover"
                  src={coverUrl}
                  alt={detail.title}
                  className="w-full rounded-md object-cover"
                />
              ) : (
                <Empty title={t('cover.emptyTitle')} description={t('cover.emptyBody')} />
              )}
            </Card>
          ) : null}

          <Card title={t('positions.title')}>
            <div data-testid="detail-positions" role="radiogroup" aria-label={t('positions.title')} className="flex flex-col gap-3">
              <p className="text-sm text-ink-muted">{t('positions.hint')}</p>
              {positions.map((position) => {
                const key = positionKeyOf(position);
                const isChecked =
                  selectedPosition !== null && positionKeyOf(selectedPosition) === key;
                const open =
                  typeof position.requiredCount === 'number' &&
                  typeof position.filledCount === 'number'
                    ? position.requiredCount - position.filledCount
                    : null;
                return (
                  <label
                    key={key || position.title}
                    data-testid="position-card"
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                      isChecked ? 'border-gold-strong' : 'border-border'
                    }`}
                  >
                    <input
                      type="radio"
                      name="volunteer_position"
                      value={key}
                      checked={isChecked}
                      onChange={() => setSelectedPositionId(key)}
                      aria-label={t('positions.selectPosition', { title: position.title ?? '' })}
                      className="mt-1 h-4 w-4 accent-primary"
                    />
                    <span className="flex flex-1 flex-col gap-1">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-ink">{position.title}</span>
                        {open !== null ? (
                          <Pill tone={open > 0 ? 'success' : 'error'}>
                            {open > 0
                              ? t('positions.seatsOpen', { open, required: position.requiredCount })
                              : t('positions.seatsFull')}
                          </Pill>
                        ) : null}
                      </span>
                      {position.description ? (
                        <span className="text-sm text-ink-muted">{position.description}</span>
                      ) : null}
                      {typeof position.applicationCount === 'number' ? (
                        <span className="text-xs text-ink-muted">
                          {t('positions.applicationsCount', { count: position.applicationCount })}
                        </span>
                      ) : null}
                      {(position.skillNames ?? []).length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {(position.skillNames ?? []).map((skill) => (
                            <Pill key={skill.skillId} tone="neutral">
                              {locale === 'ar' ? skill.nameAr ?? skill.nameFr : skill.nameFr ?? skill.nameAr}
                            </Pill>
                          ))}
                        </span>
                      ) : null}
                      {(position.deliverables ?? []).length > 0 ? (
                        <span className="text-sm text-ink-muted">
                          {t('positions.deliverablesTitle')}: {(position.deliverables ?? []).join('، ')}
                        </span>
                      ) : null}
                      {(position.assigned ?? []).length > 0 ? (
                        <span className="text-xs text-ink-muted">
                          {t('positions.assignedTitle')}:{' '}
                          {(position.assigned ?? [])
                            .map((a) => a.fullName ?? a.username ?? '')
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
              {gateNote && selectedPosition ? (
                <p data-testid="apply-gate-note" role="note" className="text-sm text-status-pending">
                  {gateNote}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button data-testid="apply-cta" onClick={openApply} disabled={!selectedPosition || gate !== null}>
                  {t('apply.cta')}
                </Button>
                {myApp ? (
                  <Button
                    data-testid="withdraw-cta"
                    variant="secondary"
                    onClick={() => {
                      if (!requireAuth()) return;
                      setWithdrawDone(false);
                      setWithdrawOpen(true);
                    }}
                  >
                    {t('withdraw.cta')}
                  </Button>
                ) : null}
                <Button
                  data-testid="report-cta"
                  variant="ghost"
                  onClick={() => {
                    if (!requireAuth()) return;
                    setReportDone(false);
                    setReportOpen(true);
                  }}
                >
                  {t('report.cta')}
                </Button>
              </div>
            </div>
          </Card>

          {relatedQuery.data && relatedQuery.data.length > 0 ? (
            <Card title={t('related.title')}>
              <ul data-testid="detail-related" className="flex flex-col gap-3">
                {relatedQuery.data.map((item) => (
                  <li key={detailIdOf(item)} className="rounded-md border border-border-muted p-3">
                    <Link
                      href={`/volunteer/opportunities/${item.slug ?? detailIdOf(item)}`}
                      className="font-medium text-gold-strong"
                    >
                      {item.title}
                    </Link>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                      <span>{orgDisplayName(item.organization, locale)}</span>
                      {item.registryId ? <Pill tone="neutral">OPP-{item.registryId.replace(/^OPP-/, '')}</Pill> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <Card title={t('sidebar.title')}>
            <div data-testid="detail-org" className="flex flex-col gap-2 text-sm">
              <span className="font-semibold text-ink">{orgName}</span>
              {detail.organization?.verificationStatus === 'verified' ? (
                <Pill tone="success">{t('sidebar.verified')}</Pill>
              ) : null}
              {categoryName ? <span className="text-ink-muted">{categoryName}</span> : null}
              {[wilayaName, municipalityName].filter(Boolean).length > 0 ? (
                <span className="text-ink-muted">
                  {[wilayaName, municipalityName].filter(Boolean).join(' — ')}
                </span>
              ) : null}
              {detail.organization?.slug ? (
                <Link
                  href={`/orgs/${detail.organization.slug}`}
                  className="font-medium text-gold-strong"
                >
                  {t('sidebar.viewOrg')}
                </Link>
              ) : null}
            </div>
          </Card>
          <Card title={t('certificate.title')}>
            <p className="text-sm text-ink-muted">{t('certificate.body')}</p>
            <Link href="/volunteer/experiences" className="mt-2 inline-block text-sm font-medium text-gold-strong">
              {t('certificate.viewInExperiences')}
            </Link>
          </Card>
        </div>
      </div>

      {applyOpen && selectedPosition ? (
        <ApplyDialog
          positionTitle={selectedPosition.title ?? ''}
          onClose={() => setApplyOpen(false)}
          onSubmit={submitApply}
          isSubmitting={applyMutation.isPending}
          serverCode={applyCode}
        />
      ) : null}
      {withdrawOpen ? (
        <WithdrawDialog
          onClose={() => setWithdrawOpen(false)}
          onConfirm={confirmWithdraw}
          isSubmitting={withdrawMutation.isPending}
        />
      ) : null}
      {reportOpen ? (
        <ReportDialog
          onClose={() => setReportOpen(false)}
          onSubmit={submitReport}
          isSubmitting={reportMutation.isPending}
          submitted={reportDone}
        />
      ) : null}
    </div>
  );
}

export type { OpportunityDetail };
