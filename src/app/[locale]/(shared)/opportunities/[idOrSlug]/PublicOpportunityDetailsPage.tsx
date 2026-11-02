'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardList,
  Clock,
  ListChecks,
  MapPin,
  Share2,
  Tag,
  Users,
} from 'lucide-react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { notify } from '@/lib/notify';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
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
//
// Icon map (Public Opportunity Details code.html Material Symbol -> lucide-react):
// arrow_forward -> ArrowRight, calendar_today -> CalendarDays,
// check/check_circle/done -> CircleCheck (neutral seats/assigned markers),
// chevron_right -> ChevronRight, commute -> Bus, edit_note -> PenLine,
// flag -> Flag, group/person -> Users, history_toggle_off -> History,
// how_to_reg -> UserCheck, location_on -> MapPin, lock -> Lock, mic -> Mic,
// photo_camera -> Camera, photo_library -> Images, refresh -> RefreshCw,
// schedule -> Clock, share -> Share2, verified/verified_user -> BadgeCheck,
// workspace_premium -> Award.
// DELETED with the "Fieldwork & Statutory Adherence" section + Law 12-06
// badges (no neutral reuse): gavel, security, fact_check, verified_user
// ("Law 12-06 Accredited" badge), policy.
// "Mission Specifications" logistics rows (session period, commitment,
// coordinates, host logistics, accommodation, language) are OMITTED: no API
// fields exist (FCD CUT, reconciled §A#18) — listed as gaps, never invented.
// Cover renders only from coverMediaId (no stock photos); deliverables render
// per position only from positions[].deliverables[].

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

function MetaItem({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
        {icon}
        {title}
      </span>
      <div className="text-sm font-medium text-ink">{children}</div>
    </div>
  );
}

// Share = copy link (same pattern as the public org profile). No backend call,
// no fabricated endpoint — clipboard only.
function ShareButton() {
  const t = useTranslations('publicOrgs');
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      data-testid="opp-share"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          notify.success('success.linkCopied');
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          notify.error('error.copyFailed');
          setCopied(false);
        }
      }}
    >
      <Share2 size={16} aria-hidden="true" />
      {copied ? t('oppDetails.copied') : t('oppDetails.share')}
    </Button>
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
            <span className="inline-flex items-center gap-1">
              <Users size={14} aria-hidden="true" className="shrink-0" />
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
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted">
              <Tag size={14} aria-hidden="true" className="shrink-0" />
              {t('oppDetails.skills')}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {skillNames.map((skill) => (
                <Pill key={skill.skillId}>{labelFor(skill, locale)}</Pill>
              ))}
            </div>
          </div>
        ) : null}
        {assigned.length > 0 ? (
          <div>
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted">
              <Users size={14} aria-hidden="true" className="shrink-0" />
              {t('oppDetails.assigned')}
            </p>
            <ul className="mt-1 flex flex-col gap-1 text-sm text-ink">
              {assigned.map((person) => (
                <li key={person.volunteerId}>{person.fullName ?? person.username ?? ''}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {(position.deliverables ?? []).length > 0 ? (
          <div>
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted">
              <ClipboardList size={14} aria-hidden="true" className="shrink-0" />
              {t('oppDetails.deliverables')}
            </p>
            <ul className="mt-1 flex list-disc flex-col gap-1 ps-5 text-sm text-ink">
              {(position.deliverables ?? []).map((item) => (
                <li key={item}>{item}</li>
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
        ) : session.data?.role === 'volunteer' ? (
          <Link
            href={`/volunteer/opportunities/${idOrSlug}`}
            data-testid="apply-cta"
            className="inline-flex items-center self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary"
          >
            {t('oppDetails.apply')}
          </Link>
        ) : (
          // Guests AND authed non-volunteers (org/admin must not be sent into
          // the volunteer space): login bounces authed users to their own
          // workspace home via RequireGuest.
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

  // History-aware Back: return to wherever the visitor came from (Volunteer
  // Home, the public listing, a related card…); a direct entry with no
  // useful history falls back to the public opportunities listing.
  function onBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/opportunities');
    }
  }

  if (detailQuery.isPending) {
    return <Loader label={t('shared.loading')} />;
  }

  if (detailQuery.isError) {
    const err = mapToApiError(detailQuery.error);
    if (err.statusCode === 404) {
      return (
        <Container testId="public-opp-details" className="flex flex-col gap-6 py-4">
          <Empty
            title={t('oppDetails.notFoundTitle')}
            description={t('oppDetails.notFoundBody')}
            action={
              <Link href="/" className="text-sm font-medium text-gold-strong">
                {t('oppDetails.backToLanding')}
              </Link>
            }
          />
        </Container>
      );
    }
    return (
      <Container testId="public-opp-details" className="flex flex-col gap-6 py-4">
        <p data-testid="detail-error" role="alert" className="text-sm text-status-error">
          {t('shared.loadError')}
        </p>
        <div>
          <Button variant="secondary" onClick={() => detailQuery.refetch()}>
            {t('shared.retry')}
          </Button>
        </div>
      </Container>
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
  const locationLine = [
    labelFor(detail.locationLabels?.wilaya, locale),
    labelFor(detail.locationLabels?.municipality, locale),
  ]
    .filter((part) => part !== '')
    .join(' · ');

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
    <Container
      testId="public-opp-details"
      className="flex flex-col gap-6 py-4"
    >
      <nav aria-label={c('a11y.breadcrumb')} className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          data-testid="opp-back"
          onClick={onBack}
          className="inline-flex cursor-pointer items-center gap-1 font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t('oppDetails.backToOpps')}
        </button>
      </nav>

      <div data-testid="detail-header" className="flex flex-col gap-2">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="h-52 w-full rounded-lg object-cover" />
        ) : (
          // Same footprint as the cover so async arrival never shifts layout.
          <div aria-hidden="true" className="h-52 w-full rounded-lg bg-surface-muted" />
        )}
        <h1 className="text-2xl font-bold text-ink">{detail.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {ref ? (
            <span data-testid="detail-ref" className="text-sm text-ink-muted">
              {t('oppDetails.code', { code: ref })}
            </span>
          ) : null}
          {verified ? (
            <Pill tone="success">
              <span className="inline-flex items-center gap-1">
                <BadgeCheck size={14} aria-hidden="true" />
                {t('oppDetails.verifiedOrg')}
              </span>
            </Pill>
          ) : null}
        </div>
        {detail.description ? <p className="text-sm text-ink">{detail.description}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button data-testid="save-cta" variant="secondary" onClick={onSave}>
            {favorited ? t('shared.saved') : t('shared.save')}
          </Button>
          <ShareButton />
        </div>
      </div>

      <Card>
        <div data-testid="detail-meta" className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {detail.mode ? (
            <MetaItem
              title={t('oppDetails.mode')}
              icon={<Briefcase size={14} aria-hidden="true" className="shrink-0" />}
            >
              {detail.mode}
            </MetaItem>
          ) : null}
          {locationLine ? (
            <MetaItem
              title={t('oppDetails.location')}
              icon={<MapPin size={14} aria-hidden="true" className="shrink-0" />}
            >
              {locationLine}
            </MetaItem>
          ) : null}
          {detail.endDate ? (
            <MetaItem
              title={t('oppDetails.endDate')}
              icon={<CalendarDays size={14} aria-hidden="true" className="shrink-0" />}
            >
              {formatDate(detail.endDate, locale)}
            </MetaItem>
          ) : null}
          {hours !== null ? (
            <MetaItem
              title={t('oppDetails.duration')}
              icon={<Clock size={14} aria-hidden="true" className="shrink-0" />}
            >
              {t('oppDetails.hours', { hours })}
            </MetaItem>
          ) : null}
          {detail.applicationDeadline ? (
            <MetaItem
              title={t('oppDetails.deadline')}
              icon={<CalendarDays size={14} aria-hidden="true" className="shrink-0" />}
            >
              {formatDate(detail.applicationDeadline, locale)}
            </MetaItem>
          ) : null}
        </div>
        {detail.prerequisites && detail.prerequisites.length > 0 ? (
          <div className="mt-4">
            <h2 className="mb-2 inline-flex items-center gap-1.5 text-lg font-semibold text-ink">
              <ListChecks size={18} aria-hidden="true" className="text-gold-strong" />
              {t('oppDetails.prerequisites')}
            </h2>
            <ul className="flex list-disc flex-col gap-1 ps-5 text-sm text-ink">
              {detail.prerequisites.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold text-ink">
          <Users size={18} aria-hidden="true" className="text-gold-strong" />
          {t('oppDetails.positions')}
        </h2>
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
          <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold text-ink">
            <Building2 size={18} aria-hidden="true" className="text-gold-strong" />
            {t('oppDetails.publisher')}
          </h2>
          {detail.organization ? (
            <>
              <p className="text-base font-medium text-ink">{orgName}</p>
              {verified ? (
                <p className="inline-flex items-center gap-1 text-sm text-ink-muted">
                  <BadgeCheck size={14} aria-hidden="true" className="text-status-success" />
                  {t('oppDetails.verifiedOrg')}
                </p>
              ) : null}
              {orgSlug ? (
                <Link
                  href={`/orgs/${orgSlug}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-gold-strong"
                >
                  {t('oppDetails.viewOrg')}
                  <ArrowRight size={16} aria-hidden="true" className="rtl:rotate-180" />
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
          {relatedSlug === null ? (
            <Empty title={t('oppDetails.related')} description={t('oppDetails.relatedEmpty')} />
          ) : null}
          {relatedSlug !== null && relatedQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
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
                        className="inline-flex items-center gap-1 text-sm font-medium text-gold-strong"
                      >
                        {t('oppDetails.viewOpp')}
                        <ArrowRight size={16} aria-hidden="true" className="rtl:rotate-180" />
                      </Link>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Card>
    </Container>
  );
}
