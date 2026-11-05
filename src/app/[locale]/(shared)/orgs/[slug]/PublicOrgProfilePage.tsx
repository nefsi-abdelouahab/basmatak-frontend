'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock,
  ExternalLink,
  Home,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Share2,
  Tag,
  Users,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { Pill } from '@/components/ui/Pill';
import { mapToApiError } from '@/lib/api/errors';
import { notify } from '@/lib/notify';
import { useSessionQuery, getLoginHref } from '@/hooks/useSession';
import {
  isAuthError,
  useFavoritesLookupQuery,
  useToggleOrganizationFavoriteMutation,
} from '@/hooks/useFavorites';
import { useOrgAccountQuery } from '@/hooks/useOrgAccount';
import {
  archiveCountFor,
  hoursFromMinutes,
  labelFor,
  mediaUrlOf,
  normalizedOrgStatsOf,
  openSeatsOf,
  oppDisplayCode,
  oppLocationOf,
  oppSkillLabels,
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
  usePublicSkillCategoriesQuery,
  usePublicWilayasQuery,
} from '@/hooks/usePublicOrgs';

// Public organization profile. This route ALWAYS renders inside the (shared)
// group (PublicNavbar + PublicFooter) for every viewer — anonymous,
// volunteer, or organization. No sidebar, ever (no <aside> on this route);
// no layout branch. Session only toggles one header button (content-level):
// - Manage organization: visible only when the viewer owns this org (own slug
//   via GET /organizations/me matches the route slug). Hidden for guests,
//   volunteers, admins, and non-member organizations.
// - Save: volunteer-only. Guests see it and are redirected to Login; org/admin
//   sessions omit it because the favorites toggle routes are @Roles('volunteer').
//   The saved state hydrates from GET /favorites/lookup keyed on this slug.
// Aggregates ride the profile payload (real OrgPublicStatsProvider keys:
// volunteers / initiativesActive / initiativesCompleted / verifiedHours /
// activeSince, with legacy fallbacks); per-status archives page through
// GET /organizations/:slug/opportunities; reliability renders as a neutral
// response rate. No authority/audit copy anywhere.
//
// Icon map (Public Organization Profile code.html Material Symbol -> lucide-react):
// home -> Home, chevron_right -> ChevronRight, location_on/place -> MapPin,
// verified -> BadgeCheck, share -> Share2, open_in_new -> ExternalLink,
// calendar_month/event_available -> CalendarDays, schedule -> Clock,
// apartment -> Building2, mail -> Mail, call -> Phone, person -> Users,
// arrow_forward -> ArrowRight, check_circle -> BadgeCheck (completed rows).
// DELETED with the "Verification & Statutory Trust" card (no neutral reuse):
// gavel, policy, verified_user ("All hours accredited" badge).
// analytics (impact breakdown) has no mapping target: per-domain hour data
// has no API source, so the whole breakdown card is omitted.
// person is reused only as the neutral volunteers/seats indicator.

const TABS: ArchiveStatus[] = ['published', 'completed', 'closed'];

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

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 3)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function LogoBlock({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gold-soft text-lg font-bold text-ink sm:h-20 sm:w-20">
      {logoUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
    </div>
  );
}

function ShareButton() {
  const t = useTranslations('publicOrgs');
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      data-testid="org-share"
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
      {copied ? t('orgProfile.copied') : t('orgProfile.share')}
    </Button>
  );
}

// Volunteer-only Save. The favorites backend backs the volunteer role (the
// organization toggle routes are @Roles('volunteer')), so organization and
// admin sessions omit the button instead of calling a forbidden endpoint.
// Guests see it and are sent to Login on click (decision 10).
function OrgSaveButton({ slug }: { slug: string }) {
  const t = useTranslations('publicOrgs');
  const router = useRouter();
  const session = useSessionQuery();
  const lookup = useFavoritesLookupQuery('organization', [slug]);
  const toggle = useToggleOrganizationFavoriteMutation();
  const canSave = !session.data || session.data.role === 'volunteer';
  if (!canSave) return null;
  const favorited = lookup.data?.[slug]?.favorited === true;
  const goLogin = () => router.replace(getLoginHref(`/orgs/${slug}`));
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      data-testid="org-save"
      aria-pressed={favorited}
      disabled={toggle.isPending}
      onClick={() => {
        if (!session.data) {
          goLogin();
          return;
        }
        toggle.mutate(
          { slug, favorited },
          { onError: (err) => { if (isAuthError(err)) goLogin(); } },
        );
      }}
    >
      <Bookmark size={16} aria-hidden="true" className={favorited ? 'fill-current' : ''} />
      {favorited ? t('shared.saved') : t('shared.save')}
    </Button>
  );
}

function OpportunityCard({ locale, card }: { locale: string; card: PublicOppCard }) {
  const t = useTranslations('publicOrgs');
  const ref = oppDisplayCode(card.registryId);
  const hours = hoursFromMinutes(card.durationMinutes);
  const category = labelFor(card.categoryName, locale);
  const location = oppLocationOf(card, locale);
  const start = formatDate(card.startAt, locale);
  const end = formatDate(card.endDate, locale);
  const deadline = formatDate(card.applicationDeadline, locale);
  const dates = start && end ? t('orgProfile.dates', { from: start, to: end }) : (end ?? start);
  const seats = openSeatsOf(card);
  const skills = oppSkillLabels(card, locale).slice(0, 4);
  return (
    <div data-testid="archive-card">
      <Card>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {category ? (
                <span className="rounded-full bg-gold-soft px-2.5 py-0.5 font-medium text-gold-strong">
                  {category}
                </span>
              ) : null}
              {ref ? <span className="text-ink-muted">{t('orgProfile.code', { code: ref })}</span> : null}
            </div>
            <h3 className="text-base font-semibold text-ink">{card.title ?? ''}</h3>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
            {location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin size={14} aria-hidden="true" className="shrink-0" />
                {location}
              </span>
            ) : null}
            {dates ? (
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={14} aria-hidden="true" className="shrink-0" />
                {dates}
              </span>
            ) : null}
            {deadline ? (
              <span className="inline-flex items-center gap-1">
                <Clock size={14} aria-hidden="true" className="shrink-0" />
                {t('orgProfile.deadline', { date: deadline })}
              </span>
            ) : null}
            {hours !== null ? (
              <span className="inline-flex items-center gap-1">
                <Clock size={14} aria-hidden="true" className="shrink-0" />
                {t('oppDetails.hours', { hours })}
              </span>
            ) : null}
            {seats ? (
              <span className="inline-flex items-center gap-1">
                <Users size={14} aria-hidden="true" className="shrink-0" />
                {t('orgProfile.seats', { open: seats.open, total: seats.total })}
              </span>
            ) : null}
          </div>
          {skills.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
              <Tag size={14} aria-hidden="true" className="shrink-0" />
              <span>{t('orgProfile.skills')}</span>
              {skills.map((skill) => (
                <Pill key={skill} tone="neutral">
                  {skill}
                </Pill>
              ))}
            </div>
          ) : null}
          <Link
            href={`/opportunities/${oppSlugOf(card)}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-gold-strong"
          >
            {t('orgProfile.viewApply')}
            <ArrowRight size={16} aria-hidden="true" className="rtl:rotate-180" />
          </Link>
        </div>
      </Card>
    </div>
  );
}

export function PublicOrgProfilePage({ locale, slug }: { locale: string; slug: string }) {
  const t = useTranslations('publicOrgs');
  const c = useTranslations('common');
  const [tab, setTab] = useState<ArchiveStatus>('published');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [stack, setStack] = useState<string[]>([]);
  const session = useSessionQuery();
  // Owner check: a signed-in organization whose own slug matches this route
  // owns the profile. Pending/failed reads mean not-owner (Manage appears
  // only on a confirmed slug match). Guests never own an org profile.
  const accountQuery = useOrgAccountQuery();
  const ownSlug = session.data?.role === 'organization' ? (accountQuery.data?.slug ?? null) : null;
  const isOwner = ownSlug !== null && ownSlug === slug;

  // Viewer state is part of the cache key: signing in/out refetches so the
  // signed-in-only contact phone appears/disappears without a reload.
  const viewer = session.isPending ? 'pending' : session.data ? 'signed-in' : 'guest';
  const isGuest = !session.isPending && !session.data;
  const profileQuery = usePublicOrgProfileQuery(slug, viewer);
  const archiveQuery = usePublicOrgOppsQuery(
    slug,
    useMemo(() => ({ status: tab, cursor, limit: 9 }), [tab, cursor]),
  );
  const reliabilityQuery = usePublicOrgReliabilityQuery(slug);
  const wilayasQuery = usePublicWilayasQuery();
  const categoriesQuery = usePublicSkillCategoriesQuery();
  const profile = profileQuery.data ?? null;
  const coverQuery = usePublicMediaQuery(profile?.coverMediaId);
  const coverUrl = mediaUrlOf(coverQuery.data);
  const logoQuery = usePublicMediaQuery(profile?.logoMediaId);
  const logoUrl = mediaUrlOf(logoQuery.data);

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
        <Container testId="public-org-profile" className="flex flex-col gap-6 py-4">
          <Empty
            title={t('shared.notFoundTitle')}
            description={t('shared.notFoundBody')}
            action={
              <Link href="/" className="text-sm font-medium text-gold-strong">
                {t('shared.backHome')}
              </Link>
            }
          />
        </Container>
      );
    }
    return (
      <Container testId="public-org-profile" className="flex flex-col gap-6 py-4">
        <p role="alert" className="text-sm text-status-error">
          {t('shared.loadError')}
        </p>
        <div>
          <Button variant="secondary" onClick={() => profileQuery.refetch()}>
            {t('shared.retry')}
          </Button>
        </div>
      </Container>
    );
  }

  if (!profile) return <Loader label={t('shared.loading')} />;

  const name = orgDisplayName(profile, locale);
  const nameAr = profile.nameAr ?? null;
  const nameFr = profile.nameFr ?? null;
  const showSecondName = locale === 'ar' ? nameFr && nameFr !== name : nameAr && nameAr !== name;
  const code = orgDisplayCode(profile.registryId);
  const verified = profile.verificationStatus === 'verified';
  const stats = normalizedOrgStatsOf(profile);
  const ribbonHours = stats?.verifiedMinutes != null ? hoursFromMinutes(stats.verifiedMinutes) : null;
  const rate = reliabilityRateOf(reliabilityQuery.data);
  const archiveItems = archiveQuery.data?.page.items ?? [];
  const counts = archiveQuery.data?.counts ?? null;
  const activeCount =
    archiveQuery.data != null ? archiveCountFor(counts, tab, archiveQuery.data.page.total) : null;

  const wilayaName = (() => {
    const id = profile.location?.wilayaId;
    if (!id) return null;
    const match = (wilayasQuery.data ?? []).find((w) => w.code === id);
    if (!match) return id;
    return (locale === 'ar' ? match.nameAr : match.nameFr) ?? match.nameFr ?? match.nameAr ?? id;
  })();
  const locationLine = [profile.location?.address, wilayaName].filter(Boolean).join(' · ') || null;

  const focusNames = (profile.focusDisciplines ?? [])
    .map((id) => {
      const match = (categoriesQuery.data ?? []).find((cat) => (cat.id ?? cat._id) === id);
      if (!match) return null;
      return (locale === 'ar' ? match.nameAr : match.nameFr) ?? match.nameFr ?? match.nameAr ?? null;
    })
    // Never render a raw database id as visible text: unresolvable entries
    // are dropped, and an empty result hides the whole focus block.
    .filter((name): name is string => typeof name === 'string' && name.trim() !== '');

  const contactEmail = profile.contact?.email ?? null;
  // The backend omits the phone for guests and ineligible viewers; the page
  // renders exactly what the payload carries instead of masking it client-side.
  const contactPhone = profile.contact?.phone ?? null;
  const hasHeadquarters =
    locationLine !== null ||
    contactEmail !== null ||
    contactPhone !== null ||
    isGuest ||
    profile.website != null ||
    profile.operatingScope != null;
  const hasAbout = (profile.description ?? '') !== '' || focusNames.length > 0;

  return (
    <Container testId="public-org-profile" className="flex flex-col gap-6 py-4">
      <nav aria-label={c('a11y.breadcrumb')} className="flex flex-wrap items-center gap-1.5 text-sm">
        <Link href="/" className="inline-flex items-center gap-1 font-medium text-ink-muted transition-colors hover:text-ink">
          <Home size={14} aria-hidden="true" />
          {t('orgProfile.breadcrumbHome')}
        </Link>
        <ChevronRight size={14} aria-hidden="true" className="text-ink-muted rtl:rotate-180" />
        <span className="text-ink-muted">{t('orgProfile.breadcrumbOrgs')}</span>
        <ChevronRight size={14} aria-hidden="true" className="text-ink-muted rtl:rotate-180" />
        <span aria-current="page" className="max-w-xs truncate text-ink">
          {name}
        </span>
      </nav>

      <Card>
        <div data-testid="org-facts" className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <LogoBlock name={name} logoUrl={logoUrl} />
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="text-2xl font-bold text-ink">{name}</h1>
                {showSecondName ? (
                  <span className="text-lg font-normal text-ink-muted" dir={locale === 'ar' ? 'ltr' : 'rtl'} lang={locale === 'ar' ? 'fr' : 'ar'}>
                    {locale === 'ar' ? nameFr : nameAr}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                {locationLine ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={14} aria-hidden="true" className="shrink-0" />
                    {locationLine}
                  </span>
                ) : null}
                {verified ? (
                  <span className="inline-flex items-center gap-1 font-medium text-status-success">
                    <BadgeCheck size={16} aria-hidden="true" />
                    {t('orgProfile.verified')}
                  </span>
                ) : null}
              </div>
              {code ? (
                <p data-testid="org-code" className="text-sm text-ink-muted">
                  {t('orgProfile.code', { code })}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start">
              <OrgSaveButton slug={slug} />
              <ShareButton />
              {profile.website ? (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="org-website"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
                >
                  {t('orgProfile.websiteCta')}
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              ) : null}
              {isOwner ? (
                <Link
                  href="/org/profile"
                  data-testid="org-manage"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
                >
                  <Pencil size={16} aria-hidden="true" />
                  {t('orgProfile.manageLabel')}
                </Link>
              ) : null}
            </div>
          </div>

          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt=""
              onError={(event) => {
                if (!event.currentTarget.src.endsWith('/org.png')) event.currentTarget.src = '/org.png';
              }}
              className="h-40 w-full rounded-md object-cover"
            />
          ) : (
            <div
              data-testid="org-cover-placeholder"
              aria-hidden="true"
              className="flex h-40 w-full items-center justify-center rounded-md bg-surface-muted"
            >
              <Building2 size={40} className="text-ink-muted opacity-50" />
            </div>
          )}
        </div>
      </Card>

      {stats ? (
        <Card>
          <div data-testid="org-ribbon" className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div>
              <p className="text-2xl font-bold text-ink">{stats.active}</p>
              <p className="text-sm text-ink-muted">{t('orgProfile.statsActive')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-ink">{stats.completed}</p>
              <p className="text-sm text-ink-muted">{t('orgProfile.statsCompleted')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-ink">{stats.volunteers}</p>
              <p className="text-sm text-ink-muted">{t('orgProfile.statsVolunteers')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-ink">{ribbonHours ?? 0}</p>
              <p className="text-sm text-ink-muted">{t('orgProfile.statsHours')}</p>
            </div>
            {stats.foundedYear !== null ? (
              <div>
                <p className="text-2xl font-bold text-ink">{stats.foundedYear}</p>
                <p className="text-sm text-ink-muted">{t('orgProfile.founded')}</p>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {hasAbout ? (
        <Card>
          <div data-testid="org-about" className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-ink">{t('orgProfile.about')}</h2>
            {profile.description ? <p className="text-sm leading-relaxed text-ink">{profile.description}</p> : null}
            {focusNames.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-ink-muted">{t('orgProfile.focus')}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {focusNames.map((focus) => (
                    <Pill key={focus}>{focus}</Pill>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {hasHeadquarters ? (
        <Card>
          <div data-testid="org-headquarters" className="flex flex-col gap-3">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-ink">
              <Building2 size={18} aria-hidden="true" className="text-gold-strong" />
              {t('orgProfile.headquarters')}
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              {locationLine ? (
                <div className="flex items-start gap-2">
                  <MapPin size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
                  <div>
                    <dt className="font-medium text-ink-muted">{t('orgProfile.location')}</dt>
                    <dd className="text-ink">{locationLine}</dd>
                  </div>
                </div>
              ) : null}
              {contactEmail || contactPhone || isGuest ? (
                <div data-testid="org-contact" className="flex flex-col gap-2">
                  {contactEmail ? (
                    <div className="flex items-start gap-2">
                      <Mail size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
                      <div>
                        <dt className="font-medium text-ink-muted">{t('orgProfile.contact')}</dt>
                        <dd className="break-all text-ink">
                          <a href={`mailto:${contactEmail}`} className="hover:underline">
                            {contactEmail}
                          </a>
                        </dd>
                      </div>
                    </div>
                  ) : null}
                  {contactPhone ? (
                    <div className="flex items-start gap-2">
                      <Phone size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
                      <div>
                        <dt className="font-medium text-ink-muted">{t('orgProfile.contact')}</dt>
                        <dd className="text-ink" dir="ltr">
                          <a
                            data-testid="org-contact-phone"
                            href={`tel:${contactPhone}`}
                            className="hover:underline"
                          >
                            {contactPhone}
                          </a>
                        </dd>
                      </div>
                    </div>
                  ) : null}
                  {isGuest ? (
                    <div data-testid="org-contact-signin" className="flex items-start gap-2">
                      <Phone size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
                      <div>
                        <dt className="font-medium text-ink-muted">{t('orgProfile.contact')}</dt>
                        <dd className="text-ink-muted">
                          <Link href="/login" className="font-medium text-gold-strong hover:underline">
                            {t('orgProfile.contactSignIn')}
                          </Link>
                          <span className="block text-sm">{t('orgProfile.contactSignInHint')}</span>
                        </dd>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {profile.website ? (
                <div className="flex items-start gap-2">
                  <ExternalLink size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
                  <div>
                    <dt className="font-medium text-ink-muted">{t('orgProfile.website')}</dt>
                    <dd className="break-all text-ink">{profile.website}</dd>
                  </div>
                </div>
              ) : null}
              {profile.operatingScope ? (
                <div className="flex items-start gap-2">
                  <MapPin size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
                  <div>
                    <dt className="font-medium text-ink-muted">{t('orgProfile.scope')}</dt>
                    <dd className="text-ink">{profile.operatingScope}</dd>
                  </div>
                </div>
              ) : null}
            </dl>
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
                    <OpportunityCard key={card._id ?? card.id ?? index} locale={locale} card={card} />
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
    </Container>
  );
}
