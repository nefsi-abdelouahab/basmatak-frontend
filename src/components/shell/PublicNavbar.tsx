'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Search } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { LanguageSwitcher } from './LanguageSwitcher';

// Public top navbar: brand, talent search, links to real routes only. Routes
// without a page (About, How Verification, Privacy, Terms) render no link.
export function PublicNavbar() {
  const tCommon = useTranslations('common');
  const t = useTranslations('publicOrgs');
  const router = useRouter();
  const [query, setQuery] = useState('');

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/talents?q=${encodeURIComponent(q)}` : '/talents');
  }

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
          <Link href="/" className="text-sm text-ink-muted transition-colors hover:text-ink">
            {t('nav.home')}
          </Link>
          <Link
            href="/volunteer/opportunities"
            className="text-sm text-ink-muted transition-colors hover:text-ink"
          >
            {t('nav.opportunities')}
          </Link>
          <Link href="/talents" className="text-sm text-ink-muted transition-colors hover:text-ink">
            {t('nav.talents')}
          </Link>
        </nav>
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/login" className="hidden text-sm font-medium text-ink-muted hover:text-ink sm:inline">
            {t('nav.signIn')}
          </Link>
          <Link
            href="/create-account"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            {t('nav.createProfile')}
          </Link>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
