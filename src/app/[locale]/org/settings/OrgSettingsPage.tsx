'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  Eye,
  IdCard,
  Lock,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { RequireOrg } from './components';
import { AccountInformationSection } from './AccountInformationSection';
import { PasswordSection } from './PasswordSection';
import { SessionsSection } from './SessionsSection';
import { NotificationsSection } from './NotificationsSection';
import { VisibilitySection } from './VisibilitySection';
import { StatusSection } from './StatusSection';
import { DangerSection } from './DangerSection';
import { useOrgAccountQuery } from '@/hooks/useOrgAccount';

interface SubNavItem {
  id: string;
  labelKey: string;
  Icon: LucideIcon;
  danger?: boolean;
}

// In-page sub-nav mirrors code.html's sticky rail (Account information /
// Security & Sessions / Notifications / Privacy & Visibility / Account
// status / Delete account). Icons are the lucide maps of the design's
// Material Symbols (see icon-mapping table in the change notes).
const SUB_NAV: SubNavItem[] = [
  { id: 'account-information', labelKey: 'navAccount', Icon: IdCard },
  { id: 'security', labelKey: 'navSecurity', Icon: Lock },
  { id: 'notifications', labelKey: 'navNotifications', Icon: Bell },
  { id: 'privacy', labelKey: 'navPrivacy', Icon: Eye },
  { id: 'account-status', labelKey: 'navStatus', Icon: BadgeCheck },
  { id: 'danger-zone', labelKey: 'navDelete', Icon: Trash2, danger: true },
];

function Breadcrumb({ title }: { title: string }) {
  const t = useTranslations('orgAccount');
  const orgQuery = useOrgAccountQuery();
  const org = orgQuery.data;
  const orgName = org ? (org.nameFr ?? org.nameAr ?? null) : null;
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
      <span>{t('settings.breadcrumbWorkspace')}</span>
      <ChevronRight size={14} aria-hidden="true" className="shrink-0 opacity-60 rtl:rotate-180" />
      {orgName ? (
        <>
          <span className="max-w-48 truncate">{orgName}</span>
          <ChevronRight size={14} aria-hidden="true" className="shrink-0 opacity-60 rtl:rotate-180" />
        </>
      ) : null}
      <span aria-current="page" className="font-medium text-ink">
        {title}
      </span>
    </nav>
  );
}

export function OrgSettingsPage({ locale }: { locale: string }) {
  const t = useTranslations('orgAccount');
  const [active, setActive] = useState('account-information');

  useEffect(() => {
    const sections = SUB_NAV.map((item) => document.getElementById(item.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  function onNavClick(id: string) {
    return (event: MouseEvent) => {
      event.preventDefault();
      setActive(id);
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }

  return (
    <RequireOrg locale={locale} next={`/org/settings`}>
      <div data-testid="org-settings" className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Breadcrumb title={t('settings.title')} />
          <h1 className="text-2xl font-bold text-ink">{t('settings.title')}</h1>
          <p className="max-w-2xl text-sm text-ink-muted">{t('settings.subtitle')}</p>
        </div>
        <nav
          aria-label={t('settings.sectionsNav')}
          className="flex flex-row gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1.5 shadow-sm lg:hidden"
        >
          {SUB_NAV.map(({ id, labelKey, Icon, danger }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={onNavClick(id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                danger ? 'text-status-error' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Icon size={18} aria-hidden="true" className="shrink-0" />
              <span className="whitespace-nowrap">{t(`settings.${labelKey}`)}</span>
            </a>
          ))}
        </nav>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden self-start lg:sticky lg:top-20 lg:block">
            <nav aria-label={t('settings.sectionsNav')} className="flex flex-col gap-0.5">
              {SUB_NAV.map(({ id, labelKey, Icon, danger }) => {
                const selected = active === id;
                return (
                  <a
                    key={id}
                    href={`#${id}`}
                    onClick={onNavClick(id)}
                    aria-current={selected ? 'true' : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      selected
                        ? danger
                          ? 'bg-status-error/10 font-medium text-status-error'
                          : 'bg-gold-soft font-medium text-gold-strong'
                        : danger
                          ? 'text-ink-muted hover:text-status-error'
                          : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <Icon size={18} aria-hidden="true" className="shrink-0" />
                    <span>{t(`settings.${labelKey}`)}</span>
                  </a>
                );
              })}
            </nav>
          </aside>
          <div className="flex min-w-0 flex-col gap-6">
            <section id="account-information" aria-label={t('settings.accountTitle')} className="scroll-mt-24">
              <AccountInformationSection />
            </section>
            <section id="security" aria-label={t('settings.navSecurity')} className="flex scroll-mt-24 flex-col gap-6">
              <PasswordSection />
              <SessionsSection />
            </section>
            <section id="notifications" aria-label={t('settings.notificationsTitle')} className="scroll-mt-24">
              <NotificationsSection />
            </section>
            <section id="privacy" aria-label={t('settings.visibilityTitle')} className="scroll-mt-24">
              <VisibilitySection />
            </section>
            <section id="account-status" aria-label={t('settings.statusTitle')} className="scroll-mt-24">
              <StatusSection />
            </section>
            <div id="danger-zone" className="scroll-mt-24 pb-4">
              <DangerSection />
            </div>
          </div>
        </div>
      </div>
    </RequireOrg>
  );
}
