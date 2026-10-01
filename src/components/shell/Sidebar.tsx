'use client';

import { useTranslations } from 'next-intl';
import {
  Award,
  ClipboardList,
  Compass,
  Images,
  LayoutDashboard,
  ListChecks,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { useSessionQuery } from '@/hooks/useSession';
import { useMyApplicationsQuery, useMyParticipationsQuery } from '@/hooks/useTasks';
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
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-body-md transition-colors ${
        active
          ? 'bg-primary-tint font-medium text-primary'
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

  // Badge totals read the real list endpoints with limit=1 (only the
  // cursor `total` is used). Zero totals render no badge — never invented.
  const applicationsQuery = useMyApplicationsQuery({ limit: 1 }, isVolunteer);
  const participationsQuery = useMyParticipationsQuery({ limit: 1 }, isVolunteer);

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
    <aside
      data-testid="shell-sidebar"
      className="hidden w-64 shrink-0 rounded-lg border border-border bg-surface p-2 shadow-sm lg:sticky lg:top-20 lg:block lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto lg:[-ms-overflow-style:none] lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden"
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
    </aside>
  );
}
