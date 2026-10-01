'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Award,
  ClipboardList,
  Compass,
  Images,
  LayoutDashboard,
  ListChecks,
  Menu,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { useSessionQuery } from '@/hooks/useSession';

// Mobile tab bar (sidebar becomes this below the lg breakpoint): icon+label
// tabs, active tab in primary. Four primary tabs stay visible; the
// least-critical destinations (Experiences, Portfolio, Discover Talents,
// Settings) fold into the "More" tab menu so the bar fits 390px without
// overflow. Discover Talents lives in More here (not duplication): the top
// navbar links are hidden on mobile, so this is the only mobile path to it.
interface Tab {
  key: string;
  href: string;
  Icon: LucideIcon;
}

const PRIMARY_TABS: Tab[] = [
  { key: 'dashboard', href: '/volunteer/dashboard', Icon: LayoutDashboard },
  { key: 'applications', href: '/volunteer/applications', Icon: ClipboardList },
  { key: 'opportunities', href: '/volunteer/opportunities', Icon: Compass },
  { key: 'tasks', href: '/volunteer/tasks', Icon: ListChecks },
];

const MORE_TABS: Tab[] = [
  { key: 'experiences', href: '/volunteer/experiences', Icon: Award },
  { key: 'portfolio', href: '/volunteer/portfolio', Icon: Images },
  { key: 'talents', href: '/volunteer/talents', Icon: Users },
  { key: 'settings', href: '/volunteer/settings', Icon: Settings },
];

const TAB_CLASS =
  'flex min-w-0 flex-1 items-center justify-center rounded-md px-1 py-2.5 transition-colors';

export function BottomNav() {
  const t = useTranslations('common');
  const pathname = usePathname();
  const session = useSessionQuery();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    // Outside-click close without a catcher overlay (an overlay would sit
    // above the tab buttons and intercept their pointer events).
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-menu-root="bottomnav"]')) return;
      setMoreOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [moreOpen]);

  if (session.data?.role !== 'volunteer') {
    return (
      <nav
        data-testid="shell-bottomnav"
        aria-label={t('nav.menu')}
        className="fixed inset-x-0 bottom-0 border-t border-border bg-surface lg:hidden"
      >
        <div className="flex items-center justify-around px-4 py-2">
          <Link href="/" className="rounded-md px-4 py-2 text-sm font-medium text-ink">
            {t('nav.home')}
          </Link>
        </div>
      </nav>
    );
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const moreActive = MORE_TABS.some((tab) => isActive(tab.href));

  return (
    <nav
      data-testid="shell-bottomnav"
      aria-label={t('nav.menu')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface lg:hidden"
    >
      <div className="relative" data-menu-root="bottomnav">
        {moreOpen ? (
          <div
            role="menu"
            aria-label={t('nav.more')}
            data-testid="bottomnav-more-menu"
            className="absolute inset-x-2 bottom-full z-50 mb-2 rounded-lg border border-border bg-surface p-2 shadow-raised"
          >
            {MORE_TABS.map(({ key, href, Icon }) => (
              <Link
                key={key}
                href={href}
                role="menuitem"
                data-testid={`bottomnav-tab-${key}`}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-body-md ${
                  isActive(href) ? 'font-medium text-primary' : 'text-ink-muted'
                }`}
              >
                <Icon size={20} aria-hidden="true" className="shrink-0" />
                <span className="truncate">{t(`nav.${key}`)}</span>
              </Link>
            ))}
          </div>
        ) : null}
        <div className="flex items-stretch px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-1">
          {PRIMARY_TABS.map(({ key, href, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={key}
                href={href}
                data-testid={`bottomnav-tab-${key}`}
                aria-label={t(`nav.${key}`)}
                aria-current={active ? 'page' : undefined}
                className={`${TAB_CLASS} ${active ? 'font-medium text-primary' : 'text-ink-muted'}`}
              >
                <Icon size={22} aria-hidden="true" />
              </Link>
            );
          })}
          <button
            type="button"
            data-testid="bottomnav-tab-more"
            aria-label={t('nav.more')}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            aria-current={moreActive && !moreOpen ? 'page' : undefined}
            onClick={() => setMoreOpen((open) => !open)}
            className={`${TAB_CLASS} ${moreActive || moreOpen ? 'font-medium text-primary' : 'text-ink-muted'}`}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
        </div>
      </div>
    </nav>
  );
}
