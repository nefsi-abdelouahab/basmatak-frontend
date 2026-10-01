'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Building2,
  CircleCheck,
  Hourglass,
  MapPin,
  Megaphone,
  Plus,
  Upload,
  UserPlus,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { useAccountMediaQuery } from '@/hooks/useOrgAccount';
import {
  useEvidenceMediaQuery,
  useOrgApplicationsQuery,
  useOrgParticipantsQuery,
  useOrgSubmissionsQuery,
} from '@/hooks/useOrgInbox';
import { useOwnOpportunitiesQuery } from '@/hooks/useOrgOpps';
import {
  useMyOrganizationQuery,
  useOrgActivityQuery,
  useOrgCoverMediaQuery,
  useOrgStatsQuery,
} from '@/hooks/useOrgStats';
import { accountMediaUrlOf } from '@/lib/api/orgAccount';
import {
  evidenceUrlOf,
  rowId as inboxRowId,
  type InboxApplication,
  type InboxParticipant,
  type InboxSubmission,
} from '@/lib/api/orgInbox';
import { orgCoverUrlOf } from '@/lib/api/orgStats';
import {
  opportunityIdOf,
  type OwnerOpportunity,
} from '@/lib/api/orgOpps';
import { RequireOrg, joinName } from '../applications/components';

// Organization Dashboard rebuild from
// `design/Basmatak Tatatoua - Organization Dashboard/` (code.html +
// screen.png): hero cover with overlapping org summary card, greeting +
// quick actions, 5-stat row, contributions-to-review, recent applications,
// active volunteer activities, and the right context rail (recent
// opportunities + recent activity feed). Organization Workspace shell (left
// sidebar + top navbar) lives in Shell/Sidebar/Navbar — this file owns the
// dashboard content only.
//
// Standing rules applied:
// - Deleted, never rephrased: "Registry #DZ-ALG-7740" (no registry line at
//   all), "Documented Hours Minted" (neutral "Documented Hours"), the whole
//   "Civic Audit & Accreditation" card (Law 12-06 / sovereign portfolio /
//   Registry Node), the "Civic Charter Verified" sidebar note (a neutral
//   "Verified Organization" badge renders only when verificationStatus is
//   verified), every "minted"/"minting" verb (activity renders the backend's
//   neutral titles, e.g. "Contribution verified — record issued"), and the
//   "Inspect media files" secondary button (no backing action).
// - Every number and row is real API data; a missing number renders 0 and a
//   missing list renders the i18n empty state. Position/role, dates, and
//   location lines render only when the join actually carries them.
// - verifiedHours arrives in MINUTES (the backend sums experience.duration,
//   which the verify flow stamps from opportunity.durationMinutes — see
//   verifications.service experienceDuration + attestation-document
//   "durationMinutes"). The "Documented Hours" stat divides by 60.
// - opportunitiesActive counts published + in_progress (backend
//   ACTIVE_OPPORTUNITY_STATUSES); "Applications received" and "Contributions
//   to review" read the real inbox totals.

function SectionError({ message, testId }: { message: string; testId: string }) {
  return (
    <p data-testid={testId} role="alert" className="text-sm text-status-error">
      {message}
    </p>
  );
}

function greetingKey(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function formatLongDate(value: string | null | undefined, locale: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function formatShortDate(value: string | null | undefined, locale: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function timeAgo(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  const diff = time - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour');
  if (abs < 30 * 86_400_000) return rtf.format(Math.round(diff / 86_400_000), 'day');
  return formatShortDate(iso, locale);
}

// documented-hours unit: backend verifiedHours sums experience.duration in
// minutes, so hours = minutes / 60 (integer when whole, else one decimal).
function formatDocumentedHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

type JoinName = Parameters<typeof joinName>[0];

function displayNameOf(join: JoinName, locale: string): string {
  const name = joinName(join, locale);
  return name === '—' ? '' : name;
}

function avatarMediaIdOf(join: unknown): string | null {
  if (!join || typeof join !== 'object') return null;
  const id = (join as { avatarMediaId?: unknown }).avatarMediaId;
  return typeof id === 'string' && id !== '' ? id : null;
}

// Person avatar: real media when resolvable, public/user.jpg otherwise.
// Never hidden, never a letter.
function PersonAvatar({ mediaId, name, size }: { mediaId: string | null; name: string; size: number }) {
  const mediaQuery = useAccountMediaQuery(mediaId);
  const url = accountMediaUrlOf(mediaQuery.data);
  const src = url ?? '/user.jpg';
  return (
    // eslint-disable-next-line @next/next/no-img-element -- session-resolved media URL with local fallback
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      onError={(event) => {
        if (!event.currentTarget.src.endsWith('/user.jpg')) event.currentTarget.src = '/user.jpg';
      }}
      className="shrink-0 rounded-full bg-surface-muted object-cover"
      style={{ width: size, height: size }}
    />
  );
}

// Org logo: real logoMediaId when resolvable, neutral Building2 block
// otherwise. Never a letter, never user.jpg (person-only fallback).
function OrgLogo({ mediaId, name }: { mediaId: string | null; name: string }) {
  const mediaQuery = useAccountMediaQuery(mediaId);
  const url = accountMediaUrlOf(mediaQuery.data);
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- session-resolved media URL with neutral fallback
      <img
        src={url}
        alt={name}
        loading="lazy"
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
        className="h-20 w-20 shrink-0 rounded-xl bg-surface-muted object-cover shadow-sm"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-ink-muted shadow-sm"
    >
      <Building2 size={30} aria-hidden="true" />
    </span>
  );
}

// First-evidence thumbnail: real owning-org evidence URL when resolvable,
// plain neutral block otherwise (no invented GIS/map meaning).
function EvidenceThumb({ mediaId }: { mediaId: string | null }) {
  const [failed, setFailed] = useState(false);
  const mediaQuery = useEvidenceMediaQuery(mediaId ?? undefined);
  const url = evidenceUrlOf(mediaQuery.data);
  if (!mediaId || failed || (!mediaQuery.isPending && !url)) {
    return <div aria-hidden="true" className="h-28 w-full shrink-0 rounded-lg bg-surface-muted sm:w-44" />;
  }
  if (mediaQuery.isPending || !url) {
    return <div aria-hidden="true" className="h-28 w-full shrink-0 rounded-lg bg-surface-muted sm:w-44" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- owning-org evidence URL with neutral fallback
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-28 w-full shrink-0 rounded-lg bg-surface-muted object-cover sm:w-44"
    />
  );
}

function evidenceFirstId(row: InboxSubmission): string | null {
  const evidence = row.evidence;
  if (!Array.isArray(evidence) || evidence.length === 0) return null;
  const id = (evidence[0] as { mediaId?: unknown }).mediaId;
  return typeof id === 'string' && id !== '' ? id : null;
}

function submissionIdOf(row: InboxSubmission): string {
  return inboxRowId(row);
}

function Hero() {
  const t = useTranslations('orgWorkspace');
  const locale = useLocale();
  const orgQuery = useMyOrganizationQuery();
  const coverQuery = useOrgCoverMediaQuery(orgQuery.data?.coverMediaId ?? null);

  if (orgQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (orgQuery.isError || !orgQuery.data) {
    return <SectionError testId="dashboard-hero-error" message={t('shared.loadError')} />;
  }

  const org = orgQuery.data;
  const name = locale === 'ar' ? (org.nameAr ?? org.nameFr ?? '') : (org.nameFr ?? org.nameAr ?? '');
  const verified = org.verificationStatus === 'verified';
  const coverUrl = orgCoverUrlOf(coverQuery.data) ?? '/org.png';
  const address = org.location?.address?.trim() ? org.location.address : null;
  const slug = (org as unknown as { slug?: unknown }).slug;
  const publicHref = typeof slug === 'string' && slug !== '' ? `/orgs/${slug}` : '/org/profile';

  return (
    <section data-testid="dashboard-hero" aria-label={name} className="-mx-4 md:-mx-6">
      <div
        data-testid="org-cover"
        role="img"
        aria-label={name}
        className="h-56 w-full bg-surface-muted bg-cover bg-center md:h-72"
        style={{ backgroundImage: `url("${coverUrl}")` }}
      >
        <div className="h-full w-full bg-gradient-to-t from-ink/70 via-ink/20 to-transparent" />
      </div>
      <div className="px-4 md:px-6">
        <div className="relative -mt-16 flex flex-col justify-between gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm md:flex-row md:items-center md:p-6">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
            <OrgLogo mediaId={org.logoMediaId ?? null} name={name} />
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 data-testid="org-name" className="text-headline-lg font-semibold tracking-tight text-ink">
                  {name}
                </h1>
                {verified ? (
                  <span
                    data-testid="org-verified"
                    title={t('hero.verifiedOrg')}
                    aria-label={t('hero.verifiedOrg')}
                    className="inline-flex shrink-0 items-center text-status-success"
                  >
                    <BadgeCheck size={18} aria-hidden="true" />
                  </span>
                ) : null}
              </div>
              {org.description ? (
                <p className="max-w-2xl text-body-md text-ink-muted">{org.description}</p>
              ) : null}
              {address || org.foundedYear !== undefined ? (
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-body-sm text-ink-muted">
                  {address ? (
                    <span data-testid="org-location" className="inline-flex min-w-0 items-center gap-1">
                      <MapPin size={14} aria-hidden="true" className="shrink-0" />
                      <span className="truncate">{address}</span>
                    </span>
                  ) : null}
                  {address && org.foundedYear !== undefined ? (
                    <span aria-hidden="true">•</span>
                  ) : null}
                  {org.foundedYear !== undefined ? (
                    <span data-testid="org-founded">{t('hero.established', { year: org.foundedYear })}</span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>
          <Link
            href={publicHref}
            data-testid="org-public-profile"
            className="inline-flex shrink-0 items-center gap-1 self-end text-title-sm font-medium text-primary hover:text-primary-hover md:self-center"
          >
            <span>{t('hero.viewPublicProfile')}</span>
            <ArrowRight size={14} aria-hidden="true" className="rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Greeting() {
  const t = useTranslations('orgWorkspace');
  const locale = useLocale();
  const orgQuery = useMyOrganizationQuery();
  const name = (() => {
    const org = orgQuery.data;
    if (!org) return '';
    return locale === 'ar' ? (org.nameAr ?? org.nameFr ?? '') : (org.nameFr ?? org.nameAr ?? '');
  })();
  const greeting = t(`greeting.${greetingKey(new Date().getHours())}`, { name });

  return (
    <div className="mt-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
      <div className="min-w-0">
        <h2 data-testid="dashboard-greeting" className="text-headline-md font-semibold text-ink">
          {greeting}
        </h2>
        <p className="mt-1 text-body-md text-ink-muted">{t('greeting.subtitle')}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-2">
        <Link
          href="/org/opportunities"
          data-testid="action-view-opps"
          className="rounded-md px-2 py-1 text-title-sm text-ink-muted transition-colors hover:text-ink"
        >
          {t('actions.viewAll')}
        </Link>
        <Link
          href="/org/applications"
          data-testid="action-review-apps"
          className="rounded-md px-2 py-1 text-title-sm text-ink-muted transition-colors hover:text-ink"
        >
          {t('actions.reviewApps')}
        </Link>
        <Link
          href="/org/opportunities/new"
          data-testid="action-create-opp"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-title-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-hover"
        >
          <Plus size={16} aria-hidden="true" className="shrink-0" />
          <span>{t('actions.create')}</span>
        </Link>
      </div>
    </div>
  );
}

function StatsRow({
  applicationsTotal,
  reviewTotal,
}: {
  applicationsTotal: number;
  reviewTotal: number;
}) {
  const t = useTranslations('orgWorkspace');
  const statsQuery = useOrgStatsQuery();

  if (statsQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (statsQuery.isError || !statsQuery.data) {
    return <SectionError testId="dashboard-stats-error" message={t('shared.loadError')} />;
  }

  const stats = statsQuery.data;
  const cards = [
    { key: 'published', testId: 'dashboard-stat-published', value: String(stats.opportunitiesActive ?? 0), highlight: false },
    { key: 'applications', testId: 'dashboard-stat-applications', value: String(applicationsTotal), highlight: false },
    { key: 'participants', testId: 'dashboard-stat-participants', value: String(stats.participantsActive ?? 0), highlight: false },
    { key: 'review', testId: 'dashboard-stat-review', value: String(reviewTotal), highlight: true },
    { key: 'hours', testId: 'dashboard-stat-hours', value: formatDocumentedHours(stats.verifiedHours ?? 0), highlight: false },
  ];

  return (
    <section aria-label={t('stats.published')} className="mt-6 rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6">
      <dl data-testid="dashboard-stats" className="grid grid-cols-2 gap-6 md:grid-cols-5">
        {cards.map((card) => (
          <div key={card.key} className="min-w-0">
            <dd
              data-testid={card.testId}
              className={`text-display-lg font-semibold tracking-tight ${card.highlight ? 'text-primary' : 'text-ink'}`}
            >
              {card.value}
            </dd>
            <dt className="mt-1 text-label-sm uppercase tracking-wider text-ink-muted">
              {t(`stats.${card.key}`)}
            </dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ContributionsSection() {
  const t = useTranslations('orgWorkspace');
  const locale = useLocale();
  const subsQuery = useOrgSubmissionsQuery({
    status: ['submitted', 'under_review'],
    sort: 'newest',
    limit: 3,
  });

  const total = subsQuery.data?.total ?? 0;
  const items = ((subsQuery.data?.items ?? []) as InboxSubmission[]).slice(0, 3);

  return (
    <section
      aria-labelledby="contributions-title"
      className="rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="contributions-title" className="text-title-lg font-semibold text-ink">
            {t('contributions.title')}
          </h3>
          <p className="mt-0.5 text-body-sm text-ink-muted">{t('contributions.subtitle')}</p>
        </div>
        {!subsQuery.isPending && !subsQuery.isError ? (
          <p data-testid="contributions-pending" className="shrink-0 text-label-sm text-ink-muted">
            {t('contributions.pending', { count: total })}
          </p>
        ) : null}
      </div>
      <div className="mt-4">
        {subsQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {subsQuery.isError ? <SectionError testId="contributions-error" message={t('shared.loadError')} /> : null}
        {!subsQuery.isPending && !subsQuery.isError && items.length === 0 ? (
          <Empty title={t('contributions.empty')} />
        ) : null}
        {items.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border-muted">
            {items.map((row) => {
              const id = submissionIdOf(row);
              const opportunityTitle = displayNameOf(row.opportunity, locale);
              const volunteerName = displayNameOf(row.volunteer, locale);
              const deliverable =
                typeof row.description === 'string' && row.description.trim() !== ''
                  ? row.description
                  : typeof row.title === 'string' && row.title.trim() !== ''
                    ? row.title
                    : null;
              const submitted = formatLongDate(row.createdAt, locale);
              return (
                <li
                  key={id !== '' ? id : `${volunteerName}-${opportunityTitle}`}
                  data-testid="contribution-row"
                  className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start"
                >
                  <EvidenceThumb mediaId={evidenceFirstId(row)} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {opportunityTitle ? (
                      <p className="truncate text-body-sm text-ink-muted">{opportunityTitle}</p>
                    ) : null}
                    {volunteerName ? (
                      <p className="flex items-center gap-2">
                        <PersonAvatar mediaId={avatarMediaIdOf(row.volunteer)} name={volunteerName} size={20} />
                        <span className="truncate text-title-sm font-medium text-ink">{volunteerName}</span>
                      </p>
                    ) : null}
                    {deliverable ? (
                      <p className="line-clamp-2 text-body-sm text-ink-muted">{deliverable}</p>
                    ) : null}
                    {submitted ? (
                      <p className="text-label-xs text-ink-muted">{t('contributions.submittedOn', { date: submitted })}</p>
                    ) : null}
                    <p className="flex flex-wrap items-center gap-4 pt-1">
                      {id !== '' ? (
                        <Link
                          href={`/org/contributions/${id}`}
                          data-testid={`contribution-review-${id}`}
                          className="inline-flex items-center gap-1 text-title-sm font-medium text-primary hover:text-primary-hover"
                        >
                          <span>{t('contributions.review')}</span>
                          <ArrowRight size={14} aria-hidden="true" className="rtl:rotate-180" />
                        </Link>
                      ) : null}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function ApplicationsSection() {
  const t = useTranslations('orgWorkspace');
  const locale = useLocale();
  const appsQuery = useOrgApplicationsQuery({ limit: 3 });

  const total = appsQuery.data?.total ?? 0;
  const items = ((appsQuery.data?.items ?? []) as InboxApplication[]).slice(0, 3);

  return (
    <section
      aria-labelledby="applications-title"
      className="rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="applications-title" className="text-title-lg font-semibold text-ink">
            {t('applications.title')}
          </h3>
          <p className="mt-0.5 text-body-sm text-ink-muted">{t('applications.subtitle')}</p>
        </div>
        {!appsQuery.isPending && !appsQuery.isError ? (
          <Link
            href="/org/applications"
            data-testid="applications-view-all"
            className="shrink-0 text-title-sm text-ink-muted transition-colors hover:text-ink"
          >
            {t('applications.viewAll', { count: total })}
          </Link>
        ) : null}
      </div>
      <div className="mt-4">
        {appsQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {appsQuery.isError ? <SectionError testId="applications-error" message={t('shared.loadError')} /> : null}
        {!appsQuery.isPending && !appsQuery.isError && items.length === 0 ? (
          <Empty title={t('applications.empty')} />
        ) : null}
        {items.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border-muted">
            {items.map((row) => {
              const id = inboxRowId(row);
              const applicantName = displayNameOf(row.applicant ?? row.volunteer, locale);
              const positionTitle = (() => {
                const position = row.position as { title?: unknown } | null | undefined;
                return typeof position?.title === 'string' && position.title.trim() !== ''
                  ? position.title
                  : null;
              })();
              const opportunityTitle = displayNameOf(row.opportunity, locale);
              const applied = formatLongDate(row.createdAt, locale);
              return (
                <li
                  key={id !== '' ? id : `${applicantName}-${applied}`}
                  data-testid="application-row"
                  className="flex flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <PersonAvatar
                      mediaId={avatarMediaIdOf(row.applicant ?? row.volunteer)}
                      name={applicantName}
                      size={40}
                    />
                    <div className="min-w-0">
                      {applicantName ? (
                        <p className="truncate text-title-md font-semibold text-ink">{applicantName}</p>
                      ) : null}
                      {positionTitle || opportunityTitle ? (
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-body-sm text-ink-muted">
                          <span>{t('applications.appliedFor')}</span>
                          {positionTitle ? (
                            <span className="font-medium text-ink">{positionTitle}</span>
                          ) : null}
                          {opportunityTitle ? (
                            <>
                              <span>{t('applications.in')}</span>
                              <span className="truncate">{opportunityTitle}</span>
                            </>
                          ) : null}
                        </p>
                      ) : null}
                      {applied ? (
                        <p className="mt-0.5 text-label-xs text-ink-muted">
                          {t('applications.appliedOn', { date: applied })}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {id !== '' ? (
                    <Link
                      href={`/org/applications/${id}`}
                      data-testid={`application-view-${id}`}
                      className="inline-flex shrink-0 items-center gap-1 text-title-sm font-medium text-primary hover:text-primary-hover"
                    >
                      <span>{t('applications.view')}</span>
                      <ArrowRight size={14} aria-hidden="true" className="rtl:rotate-180" />
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

interface ActivityGroup {
  key: string;
  opportunityId: string | null;
  title: string;
  count: number;
}

function ActivitiesSection() {
  const t = useTranslations('orgWorkspace');
  const locale = useLocale();
  const activeQuery = useOrgParticipantsQuery({ status: 'active', limit: 10 });
  const acceptedQuery = useOrgParticipantsQuery({ status: 'accepted', limit: 10 });

  const groups: ActivityGroup[] = useMemo(() => {
    const rows: InboxParticipant[] = [
      ...((activeQuery.data?.items ?? []) as InboxParticipant[]),
      ...((acceptedQuery.data?.items ?? []) as InboxParticipant[]),
    ];
    const byKey = new Map<string, ActivityGroup>();
    for (const row of rows) {
      const opp = (row.opportunity ?? {}) as { id?: unknown; _id?: unknown; title?: unknown };
      const id = typeof opp.id === 'string' && opp.id !== '' ? opp.id : typeof opp._id === 'string' && opp._id !== '' ? opp._id : null;
      const title = displayNameOf(row.opportunity, locale) || '';
      if (title === '' && !id) continue;
      const key = id ?? `title:${title}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        byKey.set(key, { key, opportunityId: id, title, count: 1 });
      }
    }
    return [...byKey.values()].slice(0, 3);
  }, [activeQuery.data, acceptedQuery.data, locale]);

  const isPending = activeQuery.isPending && acceptedQuery.isPending;
  const isError = activeQuery.isError && acceptedQuery.isError;

  return (
    <section
      aria-labelledby="activities-title"
      className="rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="activities-title" className="text-title-lg font-semibold text-ink">
            {t('activities.title')}
          </h3>
          <p className="mt-0.5 text-body-sm text-ink-muted">{t('activities.subtitle')}</p>
        </div>
        {!isPending && !isError ? (
          <p data-testid="activities-count" className="shrink-0 text-label-sm text-ink-muted">
            {t('activities.count', { count: groups.length })}
          </p>
        ) : null}
      </div>
      <div className="mt-4">
        {isPending ? <Loader label={t('shared.loading')} /> : null}
        {isError ? <SectionError testId="activities-error" message={t('shared.loadError')} /> : null}
        {!isPending && !isError && groups.length === 0 ? <Empty title={t('activities.empty')} /> : null}
        {groups.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border-muted">
            {groups.map((group) => (
              <li
                key={group.key}
                data-testid="volunteer-activity-row"
                className="flex flex-col justify-between gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-title-md font-semibold text-ink">{group.title}</p>
                  <p className="mt-0.5 text-body-sm text-ink-muted">
                    {t('activities.participantsActive', { count: group.count })}
                  </p>
                </div>
                <Link
                  href="/org/participants"
                  data-testid="activity-view-roster"
                  className="inline-flex shrink-0 items-center gap-1 text-title-sm font-medium text-ink hover:text-primary"
                >
                  <span>{t('activities.view')}</span>
                  <ArrowRight size={14} aria-hidden="true" className="rtl:rotate-180" />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function OppCover({ mediaId, title }: { mediaId: string | null; title: string }) {
  const mediaQuery = useAccountMediaQuery(mediaId);
  const url = accountMediaUrlOf(mediaQuery.data);
  if (!mediaId || (!mediaQuery.isPending && !url)) {
    return <div aria-hidden="true" className="h-36 w-full rounded-lg bg-surface-muted" />;
  }
  if (mediaQuery.isPending || !url) {
    return <div aria-hidden="true" className="h-36 w-full rounded-lg bg-surface-muted" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- owning-org cover URL with neutral fallback
    <img
      src={url}
      alt={title}
      loading="lazy"
      onError={(event) => {
        event.currentTarget.style.display = 'none';
      }}
      className="h-36 w-full rounded-lg bg-surface-muted object-cover"
    />
  );
}

function positionsCountOf(opp: OwnerOpportunity): number | null {
  const positions = opp.positions;
  if (!Array.isArray(positions) || positions.length === 0) return null;
  const seats = positions.reduce(
    (sum, position) => sum + (typeof position.requiredCount === 'number' ? position.requiredCount : 0),
    0,
  );
  return seats > 0 ? seats : positions.length;
}

function RecentOpportunities() {
  const t = useTranslations('orgWorkspace');
  const locale = useLocale();
  const oppsQuery = useOwnOpportunitiesQuery({ sort: 'newest', limit: 2 });

  const items = ((oppsQuery.data?.items ?? []) as OwnerOpportunity[]).slice(0, 2);

  return (
    <section
      aria-labelledby="recent-opps-title"
      data-testid="recent-opps"
      className="rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id="recent-opps-title" className="text-title-md font-semibold text-ink">
          {t('recentOpps.title')}
        </h3>
        <Link
          href="/org/opportunities"
          data-testid="recent-opps-view-all"
          className="shrink-0 text-label-sm font-medium text-primary hover:text-primary-hover"
        >
          {t('recentOpps.viewAll')}
        </Link>
      </div>
      <div className="mt-4">
        {oppsQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {oppsQuery.isError ? <SectionError testId="recent-opps-error" message={t('shared.loadError')} /> : null}
        {!oppsQuery.isPending && !oppsQuery.isError && items.length === 0 ? (
          <Empty title={t('recentOpps.empty')} />
        ) : null}
        {items.length > 0 ? (
          <ul className="flex flex-col gap-6">
            {items.map((opp) => {
              const id = opportunityIdOf(opp);
              const meta = [
                formatLongDate(opp.startDate, locale),
                typeof opp.location?.address === 'string' && opp.location.address.trim() !== ''
                  ? opp.location.address
                  : null,
              ].filter((part): part is string => typeof part === 'string');
              const seats = positionsCountOf(opp);
              return (
                <li key={id !== '' ? id : (opp.slug ?? opp.title)} data-testid="recent-opp-row" className="flex min-w-0 flex-col gap-2">
                  <OppCover mediaId={opp.coverMediaId ?? null} title={opp.title} />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="line-clamp-2 text-title-sm font-medium leading-snug text-ink">{opp.title}</p>
                    {meta.length > 0 ? <p className="text-body-sm text-ink-muted">{meta.join(' • ')}</p> : null}
                    {seats !== null ? (
                      <p className="mt-1 text-label-xs text-ink-muted">{t('recentOpps.positions', { count: seats })}</p>
                    ) : null}
                  </div>
                  {id !== '' ? (
                    <Link
                      href={`/org/opportunities/${id}`}
                      data-testid={`recent-opp-manage-${id}`}
                      className="inline-flex items-center gap-1 pt-1 text-title-sm font-medium text-primary hover:text-primary-hover"
                    >
                      <span>{t('recentOpps.manage')}</span>
                      <ArrowRight size={14} aria-hidden="true" className="rtl:rotate-180" />
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const Icon: LucideIcon = type.startsWith('application')
    ? UserPlus
    : type === 'submission.submitted'
      ? Upload
      : type === 'submission.under_review'
        ? Hourglass
        : type === 'submission.verified'
          ? BadgeCheck
          : type === 'submission.rejected'
            ? XCircle
            : type.startsWith('participation')
              ? CircleCheck
              : type.startsWith('opportunity')
                ? Megaphone
                : Bell;
  return <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />;
}

interface FeedItem {
  key: string;
  type: string;
  title: string;
  summary: string | null;
  at: string | null;
}

function ActivityFeed() {
  const t = useTranslations('orgWorkspace');
  const locale = useLocale();
  const activityQuery = useOrgActivityQuery();

  const items: FeedItem[] = useMemo(() => {
    const raw = ((activityQuery.data?.items ?? []) as unknown[]).slice(0, 5);
    return raw.map((entry, index) => {
      const row = (entry ?? {}) as {
        id?: unknown;
        _id?: unknown;
        type?: unknown;
        kind?: unknown;
        title?: unknown;
        ts?: unknown;
        createdAt?: unknown;
        entity?: unknown;
      };
      const type = typeof row.type === 'string' ? row.type : typeof row.kind === 'string' ? row.kind : '';
      const title = typeof row.title === 'string' && row.title !== '' ? row.title : type;
      const entity = (row.entity ?? {}) as { name?: unknown; summary?: unknown };
      const summary = typeof entity.summary === 'string' && entity.summary !== '' ? entity.summary : null;
      const at = typeof row.ts === 'string' ? row.ts : typeof row.createdAt === 'string' ? row.createdAt : null;
      const id = typeof row.id === 'string' && row.id !== '' ? row.id : typeof row._id === 'string' && row._id !== '' ? row._id : `feed-${index}`;
      return { key: `${type}-${id}`, type, title, summary, at };
    });
  }, [activityQuery.data]);

  return (
    <section
      aria-labelledby="activity-title"
      data-testid="activity-feed"
      className="rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6"
    >
      <h3 id="activity-title" className="text-title-md font-semibold text-ink">
        {t('activity.title')}
      </h3>
      <div className="mt-4">
        {activityQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {activityQuery.isError ? <SectionError testId="activity-error" message={t('activity.error')} /> : null}
        {!activityQuery.isPending && !activityQuery.isError && items.length === 0 ? (
          <Empty title={t('activity.empty')} />
        ) : null}
        {items.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {items.map((item) => {
              const ago = timeAgo(item.at, locale);
              return (
                <li key={item.key} data-testid="activity-item" className="flex items-start gap-2">
                  <ActivityIcon type={item.type} />
                  <div className="min-w-0">
                    <p className="text-body-sm font-medium leading-snug text-ink">{item.title}</p>
                    {item.summary ? (
                      <p className="mt-0.5 line-clamp-2 text-body-sm text-ink-muted">{item.summary}</p>
                    ) : null}
                    {ago ? <p className="mt-0.5 text-label-xs text-ink-muted">{ago}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

export function OrgDashboardPage({ locale }: { locale: string }) {
  void locale;
  const t = useTranslations('orgWorkspace');
  const subsQuery = useOrgSubmissionsQuery({
    status: ['submitted', 'under_review'],
    sort: 'newest',
    limit: 3,
  });
  const appsQuery = useOrgApplicationsQuery({ limit: 3 });

  return (
    <RequireOrg locale={locale} next="/org/dashboard">
      <div data-testid="org-dashboard" className="min-w-0">
        <Hero />
        <div className="mt-2">
          <Greeting />
        </div>
        <StatsRow
          applicationsTotal={appsQuery.data?.total ?? 0}
          reviewTotal={subsQuery.data?.total ?? 0}
        />
        {subsQuery.isError || appsQuery.isError ? (
          <p data-testid="dashboard-inbox-note" role="status" className="mt-4 text-sm text-ink-muted">
            {t('shared.loadError')}
          </p>
        ) : null}
        {/* Dense-dashboard working canvas (VolunteerDashboard pattern):
            viewport-capped two columns with independent internal scroll and
            visually hidden scrollbars on lg; single document column below.
            The rail holds the design's right context column (~320px). */}
        <div
          data-testid="dashboard-grid"
          className="mt-6 grid min-w-0 grid-cols-1 items-start gap-6 lg:h-[calc(100dvh-7rem)] lg:grid-cols-[minmax(0,1fr)_320px]"
        >
          <div
            data-testid="dashboard-center"
            className="flex min-w-0 flex-col gap-6 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:[-ms-overflow-style:none] lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden"
          >
            <ContributionsSection />
            <ApplicationsSection />
            <ActivitiesSection />
          </div>
          <div
            data-testid="dashboard-rail"
            className="flex min-w-0 flex-col gap-6 lg:max-h-full lg:overflow-y-auto lg:overscroll-contain lg:[-ms-overflow-style:none] lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden"
          >
            <RecentOpportunities />
            <ActivityFeed />
          </div>
        </div>
      </div>
    </RequireOrg>
  );
}
