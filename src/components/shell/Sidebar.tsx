'use client';

import { useTranslations } from 'next-intl';
import {
  Award,
  BadgeCheck,
  Building2,
  ClipboardList,
  Compass,
  Flag,
  Hourglass,
  Images,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  ScrollText,
  Settings,
  UserSearch,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { ScrollFade } from '@/components/ui/ScrollFade';
import { useSessionQuery } from '@/hooks/useSession';
import { useMyApplicationsQuery, useMyParticipationsQuery } from '@/hooks/useTasks';
import { useMyOrganizationQuery } from '@/hooks/useOrgStats';
import { FooterLegalLink } from './FooterLegal';

// Volunteer sidebar mirrors code.html's left rail ("My Space" + "Discover" +
// "Account" groups, active row tinted). The top navbar carries no volunteer
// links: Home lives in the dashboard, while Opportunities and Discover
// Talents moved here into the Discover group, each with exactly one desktop
// path (the mobile paths stay the bottom-nav tabs). No other Shell layout
// changes: role gating keeps org/admin chrome on the previous minimal menu.
interface SpaceLink {
  key: string;
  href: string;
  Icon: LucideIcon;
  count?: 'applications' | 'participations';
}

const MY_SPACE: SpaceLink[] = [
  { key: 'dashboard', href: '/volunteer/dashboard', Icon: LayoutDashboard },
  {
    key: 'applications',
    href: '/volunteer/applications',
    Icon: ClipboardList,
    count: 'applications',
  },
  { key: 'tasks', href: '/volunteer/tasks', Icon: ListChecks, count: 'participations' },
  { key: 'experiences', href: '/volunteer/experiences', Icon: Award },
  { key: 'portfolio', href: '/volunteer/portfolio', Icon: Images },
];

const DISCOVER: SpaceLink[] = [
  { key: 'opportunities', href: '/volunteer/opportunities', Icon: Compass },
  { key: 'talents', href: '/volunteer/talents', Icon: Users },
];

// Organization Workspace rail mirrors code.html's left rail (MAIN +
// DISCOVER + ACCOUNT groups). Discover Talents lives here as the org's
// single desktop path to browse volunteers — now the internal
// /org/discover-talents route (org Shell, same volunteer-space content),
// not the public /talents directory, so the sidebar never leaves the
// workspace. The top navbar carries no browse links, so this is not
// duplication.
// Icons are lucide maps of the design's Material Symbols (dashboard,
// campaign→Megaphone, inbox, groups→Users, hourglass_top→Hourglass,
// verified→BadgeCheck, person_search→UserSearch, tune→Settings).
interface OrgLink {
  key: string;
  href: string;
  Icon: LucideIcon;
}

const ORG_MAIN: OrgLink[] = [
  { key: 'overview', href: '/org/dashboard', Icon: LayoutDashboard },
  { key: 'opportunities', href: '/org/opportunities', Icon: Megaphone },
  { key: 'applications', href: '/org/applications', Icon: Inbox },
  { key: 'participants', href: '/org/participants', Icon: Users },
  { key: 'contributions', href: '/org/contributions', Icon: Hourglass },
  { key: 'experiences', href: '/org/experiences', Icon: BadgeCheck },
];

const ORG_DISCOVER: OrgLink[] = [{ key: 'talents', href: '/org/discover-talents', Icon: UserSearch }];

// Neutral verification note: renders ONLY when the API proves verification
// (verificationStatus === 'verified'). No charter/audit/registry copy.
function OrgVerifiedBadge() {
  const t = useTranslations('orgWorkspace');
  const orgQuery = useMyOrganizationQuery();
  if (orgQuery.data?.verificationStatus !== 'verified') return null;
  return (
    <div className="rounded-lg bg-surface-muted p-3">
      <p className="flex items-center gap-1.5 text-label-xs font-medium text-status-success">
        <BadgeCheck size={14} aria-hidden="true" className="shrink-0" />
        <span>{t('nav.verifiedOrg')}</span>
      </p>
    </div>
  );
}

function OrgSidebar({ pathname }: { pathname: string }) {
  const t = useTranslations('orgWorkspace');
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <ScrollFade
      as="aside"
      data-testid="shell-sidebar"
      className="hidden w-64 shrink-0 rounded-lg border border-border bg-surface p-2 shadow-sm lg:sticky lg:top-20 lg:flex lg:max-h-[calc(100dvh-7rem)] lg:flex-col lg:self-start"
      viewportClassName="min-h-0 lg:flex-1 lg:overflow-y-auto"
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1 px-3 text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
            {t('nav.main')}
          </p>
          <nav aria-label={t('nav.main')} className="space-y-0.5">
            {ORG_MAIN.map(({ key, href, Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={key}
                  href={href}
                  data-testid={`sidebar-link-org-${key}`}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2 rounded-md border-s-2 border-transparent py-2 pe-3 ps-2.5 text-body-md transition-colors ${
                    active
                      ? 'border-gold bg-gold-soft font-medium text-gold-strong'
                      : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                  }`}
                >
                  <Icon size={20} aria-hidden="true" className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{t(`nav.${key}`)}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div>
          <p className="mb-1 px-3 text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
            {t('nav.discover')}
          </p>
          <nav aria-label={t('nav.discover')} className="space-y-0.5">
            {ORG_DISCOVER.map(({ key, href, Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={key}
                  href={href}
                  data-testid={`sidebar-link-org-${key}`}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2 rounded-md border-s-2 border-transparent py-2 pe-3 ps-2.5 text-body-md transition-colors ${
                    active
                      ? 'border-gold bg-gold-soft font-medium text-gold-strong'
                      : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                  }`}
                >
                  <Icon size={20} aria-hidden="true" className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{t(`nav.${key}`)}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="border-t border-border-muted pt-2">
          <p className="mb-1 px-3 text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
            {t('nav.account')}
          </p>
          <nav aria-label={t('nav.account')} className="space-y-0.5">
            <Link
              href="/org/settings"
              data-testid="sidebar-link-org-settings"
              aria-current={isActive('/org/settings') ? 'page' : undefined}
              className={`flex items-center gap-2 rounded-md border-s-2 border-transparent py-2 pe-3 ps-2.5 text-body-md transition-colors ${
                isActive('/org/settings')
                  ? 'border-gold bg-gold-soft font-medium text-gold-strong'
                  : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
              }`}
            >
              <Settings size={20} aria-hidden="true" className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{t('nav.settings')}</span>
            </Link>
          </nav>
        </div>
        <div className="px-1 pt-1">
          <OrgVerifiedBadge />
        </div>
      </div>
    </ScrollFade>
  );
}

// Platform Administration rail mirrors the admin code.html left rail
// (OVERVIEW + MANAGEMENT + MODERATION + SYSTEM groups). Verifications has no
// code.html sidebar entry but is a real route, so it rides under Management
// instead of stranding outside navigation. Icons are lucide maps of the
// design's Material Symbols (dashboard→LayoutDashboard, group→Users,
// apartment→Building2, verified→BadgeCheck, flag→Flag, settings→Settings).
interface AdminLink {
  key: string;
  href: string;
  Icon: LucideIcon;
}

const ADMIN_OVERVIEW: AdminLink[] = [{ key: 'dashboard', href: '/admin/dashboard', Icon: LayoutDashboard }];

const ADMIN_MANAGEMENT: AdminLink[] = [
  { key: 'volunteers', href: '/admin/volunteers', Icon: Users },
  { key: 'organizations', href: '/admin/organizations', Icon: Building2 },
  { key: 'verifications', href: '/admin/verifications', Icon: BadgeCheck },
  { key: 'opportunities', href: '/admin/opportunities', Icon: Megaphone },
];

const ADMIN_MODERATION: AdminLink[] = [{ key: 'reports', href: '/admin/reports', Icon: Flag }];

function AdminSidebar({ pathname }: { pathname: string }) {
  const t = useTranslations('adminWorkspace');
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const groups: { label: string; links: AdminLink[]; testPrefix: string }[] = [
    { label: t('nav.overview'), links: ADMIN_OVERVIEW, testPrefix: 'overview' },
    { label: t('nav.management'), links: ADMIN_MANAGEMENT, testPrefix: 'management' },
    { label: t('nav.moderation'), links: ADMIN_MODERATION, testPrefix: 'moderation' },
  ];
  return (
    <ScrollFade
      as="aside"
      data-testid="shell-sidebar"
      className="hidden w-64 shrink-0 rounded-lg border border-border bg-surface p-2 shadow-sm lg:sticky lg:top-20 lg:flex lg:max-h-[calc(100dvh-7rem)] lg:flex-col lg:self-start"
      viewportClassName="min-h-0 lg:flex-1 lg:overflow-y-auto"
    >
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.testPrefix}>
            <p className="mb-1 px-3 text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
              {group.label}
            </p>
            <nav aria-label={group.label} className="space-y-0.5">
              {group.links.map(({ key, href, Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={key}
                    href={href}
                    data-testid={`sidebar-link-admin-${key}`}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2 rounded-md border-s-2 border-transparent py-2 pe-3 ps-2.5 text-body-md transition-colors ${
                      active
                        ? 'border-gold bg-gold-soft font-medium text-gold-strong'
                        : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                    }`}
                  >
                    <Icon size={20} aria-hidden="true" className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{t(`nav.${key}`)}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
        <div className="border-t border-border-muted pt-2">
          <p className="mb-1 px-3 text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
            {t('nav.system')}
          </p>
          <nav aria-label={t('nav.system')} className="space-y-0.5">
            <Link
              href="/admin/settings"
              data-testid="sidebar-link-admin-settings"
              aria-current={isActive('/admin/settings') ? 'page' : undefined}
              className={`flex items-center gap-2 rounded-md border-s-2 border-transparent py-2 pe-3 ps-2.5 text-body-md transition-colors ${
                isActive('/admin/settings')
                  ? 'border-gold bg-gold-soft font-medium text-gold-strong'
                  : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
              }`}
            >
              <Settings size={20} aria-hidden="true" className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{t('nav.settings')}</span>
            </Link>
            <Link
              href="/admin/audit-logs"
              data-testid="sidebar-link-admin-audit-logs"
              aria-current={isActive('/admin/audit-logs') ? 'page' : undefined}
              className={`flex items-center gap-2 rounded-md border-s-2 border-transparent py-2 pe-3 ps-2.5 text-body-md transition-colors ${
                isActive('/admin/audit-logs')
                  ? 'border-gold bg-gold-soft font-medium text-gold-strong'
                  : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
              }`}
            >
              <ScrollText size={20} aria-hidden="true" className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{t('nav.auditLogs')}</span>
            </Link>
          </nav>
        </div>
      </div>
    </ScrollFade>
  );
}

function SidebarLink({
  href,
  label,
  Icon,
  active,
  count,
  testId,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
  count?: number;
  testId: string;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2 rounded-md border-s-2 border-transparent py-2 pe-3 ps-2.5 text-body-md transition-colors ${
        active
          ? 'border-gold bg-gold-soft font-medium text-gold-strong'
          : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
      }`}
    >
      <Icon size={20} aria-hidden="true" className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {typeof count === 'number' && count > 0 ? (
        <span
          data-testid={`${testId}-count`}
          className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-label-xs font-medium text-ink-muted"
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar() {
  const t = useTranslations('common');
  const pathname = usePathname();
  const session = useSessionQuery();
  const isVolunteer = session.data?.role === 'volunteer';
  const isOrg = session.data?.role === 'organization';
  const isAdmin = session.data?.role === 'admin';

  // Badge totals read the real list endpoints with limit=1 (only the
  // cursor `total` is used). Zero totals render no badge — never invented.
  const applicationsQuery = useMyApplicationsQuery({ limit: 1 }, isVolunteer);
  const participationsQuery = useMyParticipationsQuery({ limit: 1 }, isVolunteer);

  if (isOrg) {
    return <OrgSidebar pathname={pathname} />;
  }

  if (isAdmin) {
    return <AdminSidebar pathname={pathname} />;
  }

  if (!isVolunteer) {
    return (
      <aside
        data-testid="shell-sidebar"
        className="hidden w-64 shrink-0 border-e border-border bg-surface p-4 lg:block"
      >
        <nav aria-label={t('nav.menu')}>
          <Link
            href="/"
            className="block rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
          >
            {t('nav.home')}
          </Link>
        </nav>
      </aside>
    );
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const counts: Record<string, number | undefined> = {
    applications: applicationsQuery.data?.total,
    participations: participationsQuery.data?.total,
  };

  return (
    <ScrollFade
      as="aside"
      data-testid="shell-sidebar"
      className="hidden w-64 shrink-0 rounded-lg border border-border bg-surface p-2 shadow-sm lg:sticky lg:top-20 lg:flex lg:max-h-[calc(100dvh-7rem)] lg:flex-col lg:self-start"
      viewportClassName="min-h-0 lg:flex-1 lg:overflow-y-auto"
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1 px-3 text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
            {t('nav.mySpace')}
          </p>
          <nav aria-label={t('nav.mySpace')} className="space-y-0.5">
            {MY_SPACE.map(({ key, href, Icon, count }) => (
              <SidebarLink
                key={key}
                href={href}
                label={t(`nav.${key}`)}
                Icon={Icon}
                active={isActive(href)}
                count={count ? counts[count] : undefined}
                testId={`sidebar-link-${key}`}
              />
            ))}
          </nav>
        </div>
        <div>
          <p className="mb-1 px-3 text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
            {t('nav.discover')}
          </p>
          <nav aria-label={t('nav.discover')} className="space-y-0.5">
            {DISCOVER.map(({ key, href, Icon, count }) => (
              <SidebarLink
                key={key}
                href={href}
                label={t(`nav.${key}`)}
                Icon={Icon}
                active={isActive(href)}
                count={count ? counts[count] : undefined}
                testId={`sidebar-link-${key}`}
              />
            ))}
          </nav>
        </div>
        <div className="border-t border-border-muted pt-2">
          <p className="mb-1 px-3 text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
            {t('nav.account')}
          </p>
          <nav aria-label={t('nav.account')} className="space-y-0.5">
            <SidebarLink
              href="/volunteer/settings"
              label={t('nav.settings')}
              Icon={Settings}
              active={isActive('/volunteer/settings')}
              testId="sidebar-link-settings"
            />
          </nav>
        </div>
        <div className="border-t border-border-muted px-3 pt-3 text-label-xs leading-relaxed text-ink-muted">
          <div className="flex flex-wrap gap-x-2">
            <FooterLegalLink docId="privacy" />
            <span aria-hidden="true">·</span>
            <FooterLegalLink docId="terms" />
          </div>
          <p className="mt-1">{t('footer.rights', { year: 2026, name: t('appName') })}</p>
        </div>
      </div>
    </ScrollFade>
  );
}
