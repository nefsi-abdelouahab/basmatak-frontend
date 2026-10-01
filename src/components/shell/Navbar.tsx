'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { Bell, Search, User } from 'lucide-react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Container } from '@/components/ui/Container';
import { useSessionQuery } from '@/hooks/useSession';
import { useLogoutMutation } from '@/hooks/useAuth';
import { useVolunteerMeQuery, useVolunteerMediaQuery } from '@/hooks/useVolunteerAccount';
import { volunteerMediaUrlOf } from '@/lib/api/volunteers';
import {
  notificationIdOf,
  type NotificationItem,
} from '@/lib/api/notifications';
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
  useUnreadCountQuery,
} from '@/hooks/useNotifications';
import { LanguageSwitcher } from './LanguageSwitcher';

type Menu = 'bell' | 'avatar' | null;

function VolunteerSearch() {
  const t = useTranslations('common');
  const router = useRouter();
  const [value, setValue] = useState('');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const q = value.trim();
    router.push(q === '' ? '/volunteer/opportunities' : `/volunteer/opportunities?q=${encodeURIComponent(q)}`);
  }

  return (
    <form role="search" onSubmit={onSubmit} className="relative hidden items-center md:flex">
      <Search
        size={18}
        aria-hidden="true"
        className="pointer-events-none absolute start-3 text-ink-muted"
      />
      <input
        type="search"
        data-testid="navbar-search"
        aria-label={t('nav.globalSearchLabel')}
        placeholder={t('nav.searchPlaceholder')}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-56 rounded-md border border-border bg-surface-muted py-1.5 pe-3 ps-9 text-body-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none lg:w-72"
      />
    </form>
  );
}

function NotificationRow({
  item,
  locale,
  onRead,
  reading,
}: {
  item: NotificationItem;
  locale: string;
  onRead: (id: string) => void;
  reading: boolean;
}) {
  const t = useTranslations('common');
  const id = notificationIdOf(item);
  const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString(locale) : null;
  return (
    <div className="flex items-start gap-2 px-3 py-2.5">
      {!item.isRead ? (
        <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-sm font-medium text-ink">{item.type ?? '—'}</p>
        {date ? <p className="text-label-xs text-ink-muted">{date}</p> : null}
      </div>
      {!item.isRead && id !== '' ? (
        <button
          type="button"
          data-testid={`navbar-notification-read-${id}`}
          disabled={reading}
          onClick={() => onRead(id)}
          className="shrink-0 rounded-md px-2 py-1 text-label-sm font-medium text-primary hover:bg-surface-muted disabled:opacity-50"
        >
          {t('nav.markRead')}
        </button>
      ) : null}
    </div>
  );
}

function NotificationBell({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const t = useTranslations('common');
  const locale = useLocale();
  const unreadQuery = useUnreadCountQuery(true);
  const listQuery = useNotificationsQuery(10, open);
  const markRead = useMarkNotificationReadMutation();
  const markAll = useMarkAllNotificationsReadMutation();

  const unread = unreadQuery.data ?? 0;

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="navbar-bell"
        aria-label={unread > 0 ? t('nav.unreadCount', { count: unread }) : t('nav.notifications')}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={onToggle}
        className="relative rounded-md p-2 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
      >
        <Bell size={22} aria-hidden="true" />
        {unread > 0 ? (
          <span
            data-testid="navbar-bell-count"
            aria-hidden="true"
            className="absolute end-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-label-xs font-medium text-white"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={t('nav.notifications')}
          data-testid="navbar-notifications"
          className="z-50 rounded-lg border border-border bg-surface shadow-raised max-sm:fixed max-sm:inset-x-4 max-sm:top-16 max-sm:w-auto sm:absolute sm:end-0 sm:top-full sm:mt-2 sm:w-80"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border-muted px-3 py-2">
            <p className="text-title-sm font-medium text-ink">{t('nav.notifications')}</p>
            <button
              type="button"
              data-testid="navbar-notifications-read-all"
              disabled={markAll.isPending || unread === 0}
              onClick={() => markAll.mutate()}
              className="rounded-md px-2 py-1 text-label-sm font-medium text-primary hover:bg-surface-muted disabled:opacity-50"
            >
              {t('nav.markAllRead')}
            </button>
          </div>
          {listQuery.isPending ? (
            <p className="px-3 py-4 text-body-sm text-ink-muted">{t('nav.notificationsEmpty')}</p>
          ) : listQuery.isError || markRead.isError || markAll.isError ? (
            <p role="alert" data-testid="navbar-notifications-error" className="px-3 py-4 text-body-sm text-status-error">
              {t('nav.notificationsError')}
            </p>
          ) : (listQuery.data?.items ?? []).length === 0 ? (
            <p className="px-3 py-4 text-body-sm text-ink-muted">{t('nav.notificationsEmpty')}</p>
          ) : (
            <ul className="max-h-80 divide-y divide-border-muted overflow-y-auto overscroll-contain max-sm:max-h-[50dvh]">
              {(listQuery.data?.items ?? []).map((item) => (
                <li key={notificationIdOf(item)}>
                  <NotificationRow
                    item={item}
                    locale={locale}
                    reading={markRead.isPending}
                    onRead={(id) => markRead.mutate(id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function AvatarImage({ src, size }: { src: string | null; size: number }) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- session-resolved media URL with local fallback
    <img
      src={src}
      alt=""
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

function AvatarMenu({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const t = useTranslations('common');
  const session = useSessionQuery();
  const logout = useLogoutMutation();
  const role = session.data?.role;
  const isVolunteer = role === 'volunteer';

  const meQuery = useVolunteerMeQuery();
  const avatarId = meQuery.data?.avatar ?? null;
  const isUrl = typeof avatarId === 'string' && /^https?:\/\//i.test(avatarId);
  const mediaQuery = useVolunteerMediaQuery(!isVolunteer || isUrl ? null : avatarId);
  const optedOut = meQuery.data?.publicProfile?.showAvatar === false;
  // Opt-out renders no image at all; otherwise the uploaded photo resolves
  // via GET /media/:mediaId with public/user.jpg as the real fallback.
  const avatarSrc = !isVolunteer
    ? null
    : optedOut
      ? null
      : isUrl
        ? (avatarId as string)
        : (volunteerMediaUrlOf(mediaQuery.data) ?? '/user.jpg');

  const displayName =
    role === 'volunteer'
      ? ([meQuery.data?.firstName, meQuery.data?.lastName].filter(Boolean).join(' ') ||
        meQuery.data?.username ||
        '')
      : '';
  // Volunteers stay inside the authenticated Volunteer experience: their
  // profile opens the Volunteer talent route (same profile content inside
  // the Volunteer Shell), never the public profile route.
  const profileHref =
    role === 'volunteer' && meQuery.data?.username
      ? `/volunteer/talents/${meQuery.data.username}`
      : role === 'organization'
        ? '/org/profile'
        : null;
  const settingsHref =
    role === 'volunteer'
      ? '/volunteer/settings'
      : role === 'organization'
        ? '/org/settings'
        : role === 'admin'
          ? '/admin/settings'
          : null;

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="navbar-avatar"
        aria-label={t('nav.accountMenu')}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={onToggle}
        className="flex items-center gap-1 rounded-md p-1 transition-colors hover:bg-surface-muted"
      >
        {avatarSrc || !isVolunteer ? (
          <>
            {avatarSrc ? (
              <AvatarImage src={avatarSrc} size={32} />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
                <User size={18} aria-hidden="true" />
              </span>
            )}
          </>
        ) : null}
        {displayName !== '' ? (
          <span className="hidden max-w-28 truncate text-title-sm font-medium text-ink xl:inline">
            {displayName}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={t('nav.accountMenu')}
          data-testid="navbar-avatar-menu"
          className="absolute end-0 top-full z-50 mt-2 w-52 rounded-lg border border-border bg-surface p-1 shadow-raised"
        >
          {profileHref ? (
            <Link
              href={profileHref}
              role="menuitem"
              className="block rounded-md px-3 py-2 text-body-md text-ink hover:bg-surface-muted"
            >
              {t('nav.viewProfile')}
            </Link>
          ) : null}
          {settingsHref ? (
            <Link
              href={settingsHref}
              role="menuitem"
              className="block rounded-md px-3 py-2 text-body-md text-ink hover:bg-surface-muted"
            >
              {t('nav.settings')}
            </Link>
          ) : null}
          <button
            type="button"
            role="menuitem"
            data-testid="navbar-logout"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
            className="block w-full rounded-md px-3 py-2 text-start text-body-md text-ink hover:bg-surface-muted disabled:opacity-50"
          >
            {t('nav.logout')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Navbar() {
  const t = useTranslations('common');
  const pathname = usePathname();
  const session = useSessionQuery();
  const [menu, setMenu] = useState<Menu>(null);
  const isVolunteer = session.data?.role === 'volunteer';
  const isAuthed = !!session.data;

  useEffect(() => {
    if (menu === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  useEffect(() => {
    setMenu(null);
  }, [pathname]);

  // Outside-click close without a catcher overlay (an overlay would sit
  // above the bell/avatar toggles and intercept their pointer events).
  useEffect(() => {
    if (menu === null) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-menu-root="navbar"]')) return;
      setMenu(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menu]);

  return (
    <header data-testid="shell-navbar" className="sticky top-0 z-40 border-b border-border bg-surface">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="shrink-0 text-lg font-bold text-primary">
            <Image
              src="/logo.png"
              alt={t('appName')}
              width={419}
              height={596}
              className="h-14 w-auto object-contain"
              priority
            />
          </Link>
          {/* Volunteer destinations live in the sidebar (Discover Talents)
              and dashboard (Home, Opportunities) — no top-nav links. */}
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2" data-menu-root="navbar">
          {isVolunteer ? <VolunteerSearch /> : null}
          {!isAuthed ? (
            <Link href="/" className="rounded-md px-2 py-2 text-sm text-ink hover:text-primary">
              {t('nav.home')}
            </Link>
          ) : null}
          <LanguageSwitcher />
          {isAuthed ? (
            <>
              <NotificationBell open={menu === 'bell'} onToggle={() => setMenu(menu === 'bell' ? null : 'bell')} />
              <AvatarMenu open={menu === 'avatar'} onToggle={() => setMenu(menu === 'avatar' ? null : 'avatar')} />
            </>
          ) : null}
        </div>
      </Container>
    </header>
  );
}
