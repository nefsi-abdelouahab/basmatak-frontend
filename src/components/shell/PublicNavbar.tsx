'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { LogIn, Menu, Search, UserPlus, X } from 'lucide-react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useSessionQuery } from '@/hooks/useSession';
import { Container } from '@/components/ui/Container';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NavIconLink } from './NavIconLink';

// Public top navbar: brand, talent search, links to real routes only. Routes
// without a page (About, How Verification, Privacy, Terms) render no link.
// Shared verbatim by the (public) and (shared) groups through their layouts
// (plus the `(auth)` group): active-state via usePathname plus guest /
// volunteer / org / admin auth-state in the same markup and shell.
//
// Responsive contract (single fix, propagates to every public screen):
// - ≥lg (1024px): one row — logo + search (narrower at lg, full at xl) +
//   text nav + auth actions + language switcher. Tight gaps at lg so the
//   three nav links never wrap or overlap the logo/search.
// - <lg: logo row + hamburger toggle (Menu/X). The toggle opens an in-flow
//   dropdown panel with the SAME links, SAME auth state, and the language
//   switcher. Search moves to its own full-width row below the logo row so
//   it is always reachable and can never force horizontal scroll.
// - RTL: flex layout + logical utilities only (ms-/me-, ps-/pe-, start-).
//   No physical left/right/ml/mr/pl/pr anywhere, so `ar` mirrors free. The
//   panel is full-width in-flow (no slide side), so there is no physical
//   side to mirror.
// - Sticky: header stays `sticky top-0`; while the panel is open body scroll
//   is locked and the panel itself scrolls internally if taller than the
//   viewport.
export function PublicNavbar() {
  const tCommon = useTranslations('common');
  const t = useTranslations('publicOrgs');
  const router = useRouter();
  const pathname = usePathname();
  const session = useSessionQuery();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    setMenuOpen(false);
    router.push(q ? `/talents?q=${encodeURIComponent(q)}` : '/talents');
  }

  // Route change closes the panel (it is page chrome, not page state).
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Body scroll lock while the mobile panel is open.
  useEffect(() => {
    if (!menuOpen) return;
    const { body, documentElement } = document;
    const prevBody = body.style.overflow;
    const prevHtml = documentElement.style.overflow;
    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prevBody;
      documentElement.style.overflow = prevHtml;
    };
  }, [menuOpen]);

  // Escape closes the panel.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const role = session.data?.role ?? null;
  const dashboardHref =
    role === 'volunteer'
      ? '/volunteer/dashboard'
      : role === 'organization'
        ? '/org/dashboard'
        : role === 'admin'
          ? '/admin/dashboard'
          : null;
  const dashboardLabel =
    role === 'volunteer'
      ? t('nav.dashboard')
      : role === 'organization'
        ? t('nav.workspace')
        : role === 'admin'
          ? t('nav.adminArea')
          : null;

  const homeActive = pathname === '/';
  const oppsActive =
    pathname.startsWith('/volunteer/opportunities') || pathname.startsWith('/opportunities');
  const talentsActive =
    pathname.startsWith('/talents') || pathname.startsWith('/volunteers');
  const activeClass = (active: boolean) =>
    active
      ? 'text-sm font-medium text-ink'
      : 'text-sm text-ink-muted transition-colors hover:text-ink';
  const mobileLinkClass = (active: boolean) =>
    `block whitespace-nowrap rounded-md px-3 py-2.5 text-base transition-colors ${
      active ? 'bg-surface-muted font-medium text-ink' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
    }`;

  const searchField = (id: string, autoWidth: string) => (
    <>
      <Search
        aria-hidden="true"
        size={18}
        className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
      <input
        id={id}
        type="text"
        aria-label={t('nav.searchLabel')}
        placeholder={t('nav.searchPlaceholder')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className={`${autoWidth} h-10 rounded-md border border-border bg-surface-muted pe-3 ps-9 text-body-sm text-ink transition-colors placeholder:text-ink-muted focus:border-primary focus:bg-surface focus:outline-none`}
      />
    </>
  );

  return (
    <header data-testid="shell-navbar" className="sticky top-0 z-50 border-b border-border bg-surface">
      <Container>
        {/* Main bar: logo + (desktop) search / nav / actions + (mobile) hamburger. */}
        <div className="flex h-16 items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link href="/" className="flex min-w-0 shrink-0 leading-none">
              <Image
                src="/logo.png"
                alt={tCommon('appName')}
                width={419}
                height={596}
                className="h-10 w-auto object-contain sm:h-12 lg:h-14"
                priority
              />
            </Link>
            <form
              onSubmit={submitSearch}
              role="search"
              data-testid="public-navbar-search-desktop"
              className="relative hidden w-44 shrink-0 lg:block xl:w-64"
            >
              {searchField('public-navbar-search-input-desktop', 'w-full')}
            </form>
          </div>

          <nav
            aria-label={t('nav.home')}
            data-testid="public-navbar-links-desktop"
            className="hidden shrink-0 items-center gap-4 lg:flex xl:gap-6"
          >
            <Link
              href="/"
              aria-current={homeActive ? 'page' : undefined}
              className={`${activeClass(homeActive)} whitespace-nowrap`}
            >
              {t('nav.home')}
            </Link>
            <Link
              href="/opportunities"
              aria-current={oppsActive ? 'page' : undefined}
              className={`${activeClass(oppsActive)} whitespace-nowrap`}
            >
              {t('nav.opportunities')}
            </Link>
            <Link
              href="/talents"
              aria-current={talentsActive ? 'page' : undefined}
              className={`${activeClass(talentsActive)} whitespace-nowrap`}
            >
              {t('nav.talents')}
            </Link>
          </nav>

          <div
            data-testid="public-navbar-actions-desktop"
            className="hidden shrink-0 items-center gap-2 lg:flex xl:gap-3"
          >
            {dashboardHref && dashboardLabel ? (
              <Link
                href={dashboardHref}
                className="inline-flex h-9 items-center whitespace-nowrap rounded-md bg-primary px-3 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover xl:px-4 xl:text-sm"
              >
                {dashboardLabel}
              </Link>
            ) : (
              <>
                <NavIconLink
                  href="/login"
                  label={t('nav.signIn')}
                  icon={<LogIn size={18} aria-hidden="true" />}
                  className="hidden sm:inline-flex lg:inline-flex"
                />
                <NavIconLink
                  href="/create-account"
                  label={t('nav.createProfile')}
                  icon={<UserPlus size={18} aria-hidden="true" />}
                  tone="primary"
                  className="inline-flex"
                />
              </>
            )}
            <LanguageSwitcher />
          </div>

          {/* Mobile/tablet toggle: logo row keeps only brand + hamburger. */}
          <div className="ms-auto flex shrink-0 items-center lg:hidden">
            <button
              type="button"
              data-testid="public-navbar-menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="public-navbar-mobile-menu"
              aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ink transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Mobile/tablet search row: full-width below the logo row, never clipped. */}
        <div className="pb-3 lg:hidden">
          <form
            onSubmit={submitSearch}
            role="search"
            data-testid="public-navbar-search-mobile"
            className="relative w-full"
          >
            {searchField('public-navbar-search-input-mobile', 'w-full')}
          </form>
        </div>

        {/* Mobile/tablet dropdown panel: same links + same auth state + language. */}
        {menuOpen && (
          <div
            id="public-navbar-mobile-menu"
            data-testid="public-navbar-mobile-menu"
            className="max-h-[calc(100dvh-8rem)] overflow-y-auto border-t border-border-muted py-3 lg:hidden"
          >
            <nav aria-label={t('nav.home')} data-testid="public-navbar-links-mobile" className="space-y-1">
              <Link
                href="/"
                aria-current={homeActive ? 'page' : undefined}
                className={mobileLinkClass(homeActive)}
              >
                {t('nav.home')}
              </Link>
              <Link
                href="/opportunities"
                aria-current={oppsActive ? 'page' : undefined}
                className={mobileLinkClass(oppsActive)}
              >
                {t('nav.opportunities')}
              </Link>
              <Link
                href="/talents"
                aria-current={talentsActive ? 'page' : undefined}
                className={mobileLinkClass(talentsActive)}
              >
                {t('nav.talents')}
              </Link>
            </nav>
            <div data-testid="public-navbar-actions-mobile" className="mt-3 space-y-2 border-t border-border-muted pt-3">
              {dashboardHref && dashboardLabel ? (
                <Link
                  href={dashboardHref}
                  className="flex h-11 items-center justify-center rounded-md bg-primary px-4 text-base font-medium text-white transition-colors hover:bg-primary-hover"
                >
                  {dashboardLabel}
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="flex h-11 items-center justify-center gap-2 rounded-md border border-border px-4 text-base font-medium text-ink transition-colors hover:bg-surface-muted"
                  >
                    <LogIn size={18} aria-hidden="true" />
                    {t('nav.signIn')}
                  </Link>
                  <Link
                    href="/create-account"
                    className="flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-base font-medium text-white transition-colors hover:bg-primary-hover"
                  >
                    <UserPlus size={18} aria-hidden="true" />
                    {t('nav.createProfile')}
                  </Link>
                </>
              )}
            </div>
            <div className="mt-3 flex items-center justify-start border-t border-border-muted pt-3">
              <LanguageSwitcher />
            </div>
          </div>
        )}
      </Container>
    </header>
  );
}
