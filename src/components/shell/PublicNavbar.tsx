'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { LogIn, Search, UserPlus } from 'lucide-react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useSessionQuery } from '@/hooks/useSession';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NavIconLink } from './NavIconLink';

// Public top navbar: brand, talent search, links to real routes only. Routes
// without a page (About, How Verification, Privacy, Terms) render no link.
// Shared verbatim by landing and the public opportunities list through
// `(public)/layout.tsx`: active-state via usePathname plus guest / volunteer /
// org / admin auth-state in the same markup and shell.
export function PublicNavbar() {
  const tCommon = useTranslations('common');
  const t = useTranslations('publicOrgs');
  const router = useRouter();
  const pathname = usePathname();
  const session = useSessionQuery();
  const [query, setQuery] = useState('');

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/talents?q=${encodeURIComponent(q)}` : '/talents');
  }

  const role = session.data?.role ?? null;
  const dashboardHref =
    role === 'volunteer'
      ? '/volunteer/dashboard'
      : role === 'organization'
        ? '/org/dashboard'
        : role === 'admin'
          ? '/admin'
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

  return (
    <header data-testid="shell-navbar" className="sticky top-0 z-50 border-b border-border bg-surface">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" className="flex min-w-0 shrink-0 leading-none">
            <Image
              src="/logo.png"
              alt={tCommon('appName')}
              width={419}
              height={596}
              className="h-14 w-auto object-contain"
              priority
            />
          </Link>
          <form onSubmit={submitSearch} role="search" className="relative hidden w-64 xl:block">
            <Search
              aria-hidden="true"
              size={18}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              type="text"
              aria-label={t('nav.searchLabel')}
              placeholder={t('nav.searchPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 w-full rounded-md border border-border bg-surface-muted pe-3 ps-9 text-body-sm text-ink transition-colors placeholder:text-ink-muted focus:border-primary focus:bg-surface focus:outline-none"
            />
          </form>
        </div>
        <nav aria-label={t('nav.home')} className="hidden items-center gap-6 lg:flex">
          <Link
            href="/"
            aria-current={homeActive ? 'page' : undefined}
            className={activeClass(homeActive)}
          >
            {t('nav.home')}
          </Link>
          <Link
            href="/opportunities"
            aria-current={oppsActive ? 'page' : undefined}
            className={activeClass(oppsActive)}
          >
            {t('nav.opportunities')}
          </Link>
          <Link
            href="/talents"
            aria-current={talentsActive ? 'page' : undefined}
            className={activeClass(talentsActive)}
          >
            {t('nav.talents')}
          </Link>
        </nav>
        <div className="flex shrink-0 items-center gap-3">
          {dashboardHref && dashboardLabel ? (
            <Link
              href={dashboardHref}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              {dashboardLabel}
            </Link>
          ) : (
            <>
              <NavIconLink
                href="/login"
                label={t('nav.signIn')}
                icon={<LogIn size={18} aria-hidden="true" />}
                className="hidden sm:inline-flex"
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
      </div>
    </header>
  );
}
