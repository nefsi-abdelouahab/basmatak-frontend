'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Activity,
  BadgeCheck,
  Bell,
  CalendarDays,
  Clock,
  FileText,
  Gavel,
  Hourglass,
  Languages,
  Mail,
  MailCheck,
  Megaphone,
  Newspaper,
  Pause,
  Settings,
  ShieldCheck,
  Timer,
  TriangleAlert,
  Type,
  UserPlus,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Select } from '@/components/ui/Select';
import {
  SETTING_DATE_FORMATS,
  SETTING_LANGUAGES,
  coerceSettingValue,
  isMaintenanceMessageValid,
  settingDefOf,
  validateSettingValue,
} from '@/lib/api/adminModeration';
import {
  useAdminSettingsQuery,
  useMaintenanceToggleMutation,
  usePublicSystemStatusQuery,
  useUpdateAdminSettingMutation,
} from '@/hooks/useAdminModeration';
import { useSessionQuery } from '@/hooks/useSession';
import { RequireAdminModeration } from '../AdminModerationGuard';

// Platform Settings rebuild from
// `design/Basmatak Tatatoua - Admin Settings/` (code.html + screen.png):
// header with live runtime pill, anchor nav, and six sections (General,
// Notifications, Moderation, Platform Controls, Security, Danger Zone).
// The workspace chrome (admin sidebar + top navbar + mobile tab bar) lives
// in Shell/Sidebar/BottomNav/Navbar — this file owns the settings content.
//
// Standing rules applied:
// - No badge or pill labels anywhere: every code.html header pill and every
//   inline compliance pill is replaced by a leading lucide icon, and every
//   toggle row carries a small concern icon.
// - Deleted, never rephrased: the National Jurisdiction callout, the
//   Platform Formal Name / Summary helper lines, the Civic Hours Ledger Sync
//   card, the IP-allowlist toggle, the audit-retention row, the
//   re-authentication toggle, the public-reporting and justification toggles,
//   and every per-event notification toggle (no settings key backs them).
// - Every editable row maps to a real `system_settings` key (PUT
//   /admin/settings/:key with per-key validation); the verified-organization
//   publish rule is a hardcoded server check (ORG_NOT_VERIFIED), so it
//   renders as a read-only status line, never a switch. Nothing is invented
//   to fill a visual gap — the built screen has fewer rows than code.html.
// - Section saves report real inline states (saving / saved / error /
//   invalid); Danger Zone actions arm a confirm step before firing.

function draftOf(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return '';
}

type SaveMutation = ReturnType<typeof useUpdateAdminSettingMutation>;

function SectionError({ testId }: { testId: string }) {
  const t = useTranslations('adminModeration');
  return (
    <p data-testid={testId} role="alert" className="text-sm text-status-error">
      {t('shared.loadError')}
    </p>
  );
}

function SettingToggle({
  testId,
  label,
  checked,
  onChange,
}: {
  testId: string;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
        checked ? 'justify-end bg-primary' : 'justify-start bg-border'
      }`}
    >
      <span className="h-5 w-5 rounded-full bg-surface shadow-sm" />
    </button>
  );
}

function RowShell({
  Icon,
  label,
  description,
  control,
}: {
  Icon: LucideIcon;
  label: string;
  description?: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-4">
      <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
      <div className="min-w-0 flex-1">
        <p className="text-title-sm font-medium text-ink">{label}</p>
        {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
      </div>
      <div className="ms-auto shrink-0">{control}</div>
    </div>
  );
}

function EditableSection({
  id,
  testId,
  Icon,
  title,
  subtitle,
  settingKeys,
  drafts,
  saveMutation,
  children,
}: {
  id: string;
  testId: string;
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  settingKeys: string[];
  drafts: Record<string, string>;
  saveMutation: SaveMutation;
  children: ReactNode;
}) {
  const t = useTranslations('adminModeration');
  const [invalid, setInvalid] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setInvalid(false);
    setFailed(false);
    setSaved(false);
    const payload: { key: string; value: unknown }[] = [];
    for (const key of settingKeys) {
      const raw = drafts[key] ?? '';
      const def = settingDefOf(key);
      const prepared: unknown = def?.kind === 'boolean' ? raw === 'true' : raw;
      const value = coerceSettingValue(key, prepared);
      if (!validateSettingValue(key, value)) {
        setInvalid(true);
        return;
      }
      payload.push({ key, value });
    }
    setSaving(true);
    try {
      for (const item of payload) await saveMutation.mutateAsync(item);
      setSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      id={id}
      data-testid={testId}
      aria-label={title}
      className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6"
    >
      <h2 className="flex items-center gap-2 text-title-lg font-semibold text-ink">
        <Icon size={20} aria-hidden="true" className="shrink-0 text-ink-muted" />
        <span>{title}</span>
      </h2>
      <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
      <div className="mt-2 divide-y divide-border-muted">{children}</div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid={`${testId}-save`}
          disabled={saving}
          onClick={() => void onSave()}
        >
          {saving ? t('shared.saving') : t('shared.save')}
        </Button>
        {invalid ? (
          <p data-testid={`${testId}-invalid`} role="alert" className="text-sm text-status-error">
            {t('settings.invalidValue')}
          </p>
        ) : null}
        {failed ? (
          <p data-testid={`${testId}-error`} role="alert" className="text-sm text-status-error">
            {t('settings.sectionSaveError')}
          </p>
        ) : null}
        {saved ? (
          <p data-testid={`${testId}-saved`} className="text-sm text-ink-muted">
            {t('settings.sectionSaved')}
          </p>
        ) : null}
      </div>
    </section>
  );
}

const GENERAL_KEYS = ['platform.name', 'platform.summary', 'platform.contactEmail'];
const LOCALE_KEYS = ['locale.defaultLanguage', 'locale.defaultTimezone', 'locale.dateFormat'];
const NOTIFICATION_KEYS = ['notifications.digest.enabled', 'notifications.digest.intervalDays'];
const MODERATION_KEYS = [
  'moderation.requireVerifiedEmail',
  'moderation.suspendOnReport',
  'publishGate.maxPendingOpportunities',
];
const PLATFORM_KEYS = ['ops.registrationEnabled', 'ops.publishingEnabled'];
const SECURITY_KEYS = ['auth.adminSessionDurationDays'];

const NAV_ITEMS: { href: string; labelKey: string; Icon: LucideIcon; danger?: boolean }[] = [
  { href: '#general', labelKey: 'settings.navGeneral', Icon: Settings },
  { href: '#notifications', labelKey: 'settings.navNotifications', Icon: Bell },
  { href: '#moderation', labelKey: 'settings.navModeration', Icon: Gavel },
  { href: '#platform', labelKey: 'settings.navPlatform', Icon: Activity },
  { href: '#security', labelKey: 'settings.navSecurity', Icon: ShieldCheck },
  { href: '#danger', labelKey: 'settings.navDanger', Icon: TriangleAlert, danger: true },
];

function SettingsContent() {
  const t = useTranslations('adminModeration');
  const locale = useLocale();
  const session = useSessionQuery();
  const isAdmin = session.data?.role === 'admin';
  const settingsQuery = useAdminSettingsQuery({ enabled: isAdmin });
  const statusQuery = usePublicSystemStatusQuery({ enabled: isAdmin });
  const saveMutation = useUpdateAdminSettingMutation();
  const maintenanceMutation = useMaintenanceToggleMutation();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [armedAction, setArmedAction] = useState<'registrations' | 'maintenance' | null>(null);
  const [dangerDone, setDangerDone] = useState<string | null>(null);
  const [dangerFailed, setDangerFailed] = useState(false);

  useEffect(() => {
    if (!settingsQuery.data) return;
    setDrafts((current) => {
      const next = { ...current };
      for (const row of settingsQuery.data ?? []) {
        if (!(row.key in next)) next[row.key] = draftOf(row.value);
      }
      return next;
    });
  }, [settingsQuery.data]);

  const storedOf = (key: string): unknown =>
    settingsQuery.data?.find((row) => row.key === key)?.value;
  const draftFor = (key: string): string => drafts[key] ?? draftOf(storedOf(key));
  const onDraft = (key: string, next: string) =>
    setDrafts((current) => ({ ...current, [key]: next }));

  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const messageTooLong = !isMaintenanceMessageValid(maintenanceMessage);
  const maintenanceOn = statusQuery.data?.maintenance === true;

  if (settingsQuery.isPending) return <Loader label={t('shared.loading')} />;
  if (settingsQuery.isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <SectionError testId="admin-settings-error" />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void settingsQuery.refetch()}
        >
          {t('shared.retry')}
        </Button>
      </div>
    );
  }

  const disableRegistrations = async () => {
    setDangerFailed(false);
    setDangerDone(null);
    try {
      await saveMutation.mutateAsync({ key: 'ops.registrationEnabled', value: false });
      onDraft('ops.registrationEnabled', 'false');
      setDangerDone(t('settings.disableRegDone'));
      setArmedAction(null);
    } catch {
      setDangerFailed(true);
    }
  };

  const applyMaintenance = async (enabled: boolean) => {
    if (messageTooLong || maintenanceMutation.isPending) return;
    setDangerFailed(false);
    setDangerDone(null);
    try {
      await maintenanceMutation.mutateAsync({
        enabled,
        message: maintenanceMessage === '' ? undefined : maintenanceMessage,
      });
      setArmedAction(null);
    } catch {
      setDangerFailed(true);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <nav aria-label={t('settings.breadcrumbCurrent')}>
            <ol className="flex flex-wrap items-center gap-1.5 text-label-sm text-ink-muted">
              <li>{t('settings.breadcrumbAdmin')}</li>
              <li aria-hidden="true">/</li>
              <li>{t('settings.breadcrumbSystem')}</li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-medium text-ink">
                {t('settings.breadcrumbCurrent')}
              </li>
            </ol>
          </nav>
          <h1 className="text-headline-lg font-semibold tracking-tight text-ink">
            {t('settings.title')}
          </h1>
          <p className="max-w-2xl text-body-md text-ink-muted">{t('settings.subtitle')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-md bg-surface px-3 py-1.5 text-label-xs text-ink-muted">
          <Activity size={14} aria-hidden="true" className="shrink-0" />
          {statusQuery.isPending ? (
            <span>{t('shared.loading')}</span>
          ) : statusQuery.isError || !statusQuery.data ? (
            <span role="alert">{t('settings.statusError')}</span>
          ) : (
            <span data-testid="admin-runtime-pill">
              {statusQuery.data.status}
              {typeof statusQuery.data.version === 'string' && statusQuery.data.version !== ''
                ? ` · ${statusQuery.data.version}`
                : null}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <nav
          aria-label={t('settings.title')}
          data-testid="admin-settings-nav"
          className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-2 lg:sticky lg:top-24 lg:col-span-3"
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-label-md transition-colors ${
                item.danger
                  ? 'text-status-error hover:bg-surface-muted'
                  : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
              }`}
            >
              <item.Icon size={18} aria-hidden="true" className="shrink-0" />
              <span>{t(item.labelKey)}</span>
            </a>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-6 pb-16 lg:col-span-9">
          <EditableSection
            id="general"
            testId="admin-settings-section-general"
            Icon={Settings}
            title={t('settings.generalTitle')}
            subtitle={t('settings.generalSubtitle')}
            settingKeys={[...GENERAL_KEYS, ...LOCALE_KEYS]}
            drafts={drafts}
            saveMutation={saveMutation}
          >
            <div className="flex items-start gap-3 py-4">
              <Type size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
              <div className="min-w-0 flex-1">
                <Input
                  id="admin-platform-name"
                  label={t('settings.nameLabel')}
                  value={draftFor('platform.name')}
                  onChange={(event) => onDraft('platform.name', event.target.value)}
                />
              </div>
            </div>
            <div className="flex items-start gap-3 py-4">
              <FileText size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="admin-platform-summary"
                  className="mb-1 block text-sm font-medium text-ink"
                >
                  {t('settings.summaryLabel')}
                </label>
                <textarea
                  id="admin-platform-summary"
                  rows={3}
                  value={draftFor('platform.summary')}
                  onChange={(event) => onDraft('platform.summary', event.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 leading-relaxed text-ink focus:border-gold-strong focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-start gap-3 py-4">
              <Mail size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
              <div className="min-w-0 flex-1">
                <Input
                  id="admin-platform-contact-email"
                  label={t('settings.contactEmailLabel')}
                  type="email"
                  value={draftFor('platform.contactEmail')}
                  onChange={(event) => onDraft('platform.contactEmail', event.target.value)}
                />
              </div>
            </div>
            <div className="flex items-start gap-3 py-4">
              <Languages size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
              <div className="min-w-0 flex-1">
                <Select
                  id="admin-locale-language"
                  label={t('settings.languageLabel')}
                  value={draftFor('locale.defaultLanguage')}
                  onChange={(event) => onDraft('locale.defaultLanguage', event.target.value)}
                  options={[...SETTING_LANGUAGES].map((language) => ({
                    value: language,
                    label:
                      language === 'ar'
                        ? t('settings.languageOptionAr')
                        : t('settings.languageOptionEn'),
                  }))}
                />
              </div>
            </div>
            <div className="flex items-start gap-3 py-4">
              <Clock size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
              <div className="min-w-0 flex-1">
                <Input
                  id="admin-locale-timezone"
                  label={t('settings.timezoneLabel')}
                  hint={t('settings.timezoneHint')}
                  value={draftFor('locale.defaultTimezone')}
                  onChange={(event) => onDraft('locale.defaultTimezone', event.target.value)}
                />
              </div>
            </div>
            <div className="flex items-start gap-3 py-4">
              <CalendarDays size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
              <div className="min-w-0 flex-1">
                <Select
                  id="admin-locale-date-format"
                  label={t('settings.dateFormatLabel')}
                  value={draftFor('locale.dateFormat')}
                  onChange={(event) => onDraft('locale.dateFormat', event.target.value)}
                  options={[...SETTING_DATE_FORMATS].map((format) => ({
                    value: format,
                    label: format,
                  }))}
                />
              </div>
            </div>
          </EditableSection>

          <EditableSection
            id="notifications"
            testId="admin-settings-section-notifications"
            Icon={Bell}
            title={t('settings.notificationsTitle')}
            subtitle={t('settings.notificationsSubtitle')}
            settingKeys={NOTIFICATION_KEYS}
            drafts={drafts}
            saveMutation={saveMutation}
          >
            <RowShell
              Icon={Newspaper}
              label={t('settings.digestEnabledLabel')}
              description={t('settings.digestEnabledDescription')}
              control={
                <SettingToggle
                  testId="admin-setting-toggle-notifications.digest.enabled"
                  label={t('settings.digestEnabledLabel')}
                  checked={draftFor('notifications.digest.enabled') === 'true'}
                  onChange={(next) =>
                    onDraft('notifications.digest.enabled', next ? 'true' : 'false')
                  }
                />
              }
            />
            <div className="flex items-start gap-3 py-4">
              <CalendarDays size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
              <div className="min-w-0 flex-1">
                <Input
                  id="admin-digest-interval"
                  label={t('settings.digestIntervalLabel')}
                  hint={t('settings.digestIntervalDescription')}
                  type="number"
                  min={1}
                  max={365}
                  value={draftFor('notifications.digest.intervalDays')}
                  onChange={(event) =>
                    onDraft('notifications.digest.intervalDays', event.target.value)
                  }
                />
              </div>
            </div>
          </EditableSection>

          <section
            id="moderation"
            data-testid="admin-settings-section-moderation"
            aria-label={t('settings.moderationTitle')}
            className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6"
          >
            <h2 className="flex items-center gap-2 text-title-lg font-semibold text-ink">
              <Gavel size={20} aria-hidden="true" className="shrink-0 text-ink-muted" />
              <span>{t('settings.moderationTitle')}</span>
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{t('settings.moderationSubtitle')}</p>
            <div className="mt-2 divide-y divide-border-muted">
              <div
                data-testid="admin-verified-publish-line"
                className="flex items-start gap-3 py-4"
              >
                <BadgeCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
                <div className="min-w-0 flex-1">
                  <p className="text-title-sm font-medium text-ink">
                    {t('settings.verifiedPublishLabel')}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {t('settings.verifiedPublishDescription')}
                  </p>
                </div>
                <span className="ms-auto shrink-0 text-sm text-ink-muted">
                  {t('settings.enforcedState')}
                </span>
              </div>
              <EditableModerationToggles
                drafts={drafts}
                onDraft={onDraft}
                saveMutation={saveMutation}
              />
            </div>
          </section>

          <EditableSection
            id="platform"
            testId="admin-settings-section-platform"
            Icon={Activity}
            title={t('settings.platformTitle')}
            subtitle={t('settings.platformSubtitle')}
            settingKeys={PLATFORM_KEYS}
            drafts={drafts}
            saveMutation={saveMutation}
          >
            <div data-testid="admin-runtime-status" className="py-4">
              <p className="flex items-center gap-2 text-title-sm font-medium text-ink">
                <Activity size={18} aria-hidden="true" className="shrink-0 text-ink-muted" />
                <span>{t('settings.runtimeTitle')}</span>
              </p>
              {statusQuery.isPending ? (
                <Loader label={t('shared.loading')} />
              ) : statusQuery.isError || !statusQuery.data ? (
                <p role="alert" className="mt-2 text-sm text-status-error">
                  {t('settings.statusError')}
                </p>
              ) : (
                <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <dt className="text-ink-muted">{t('settings.runtimeStatusLabel')}:</dt>
                    <dd className="font-medium text-ink">{statusQuery.data.status}</dd>
                  </div>
                  {typeof statusQuery.data.version === 'string' &&
                  statusQuery.data.version !== '' ? (
                    <div className="flex items-center gap-2">
                      <dt className="text-ink-muted">{t('settings.runtimeVersionLabel')}:</dt>
                      <dd className="font-medium text-ink">{statusQuery.data.version}</dd>
                    </div>
                  ) : null}
                  {typeof statusQuery.data.uptimeSeconds === 'number' ? (
                    <div className="flex items-center gap-2">
                      <dt className="text-ink-muted">{t('settings.runtimeUptimeLabel')}:</dt>
                      <dd className="font-medium text-ink">
                        {numberFormat.format(statusQuery.data.uptimeSeconds)}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <dt className="text-ink-muted">{t('settings.maintenanceEnabledLabel')}:</dt>
                    <dd className="font-medium text-ink">
                      {maintenanceOn ? t('settings.maintenanceOn') : t('settings.maintenanceOff')}
                    </dd>
                  </div>
                  {typeof statusQuery.data.message === 'string' &&
                  statusQuery.data.message !== '' ? (
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <dt className="text-ink-muted">{t('settings.runtimeMessageLabel')}:</dt>
                      <dd className="font-medium text-ink">{statusQuery.data.message}</dd>
                    </div>
                  ) : null}
                </dl>
              )}
            </div>
            <RowShell
              Icon={UserPlus}
              label={t('settings.registrationLabel')}
              description={t('settings.registrationDescription')}
              control={
                <SettingToggle
                  testId="admin-setting-toggle-ops.registrationEnabled"
                  label={t('settings.registrationLabel')}
                  checked={draftFor('ops.registrationEnabled') === 'true'}
                  onChange={(next) =>
                    onDraft('ops.registrationEnabled', next ? 'true' : 'false')
                  }
                />
              }
            />
            <RowShell
              Icon={Megaphone}
              label={t('settings.publishingLabel')}
              description={t('settings.publishingDescription')}
              control={
                <SettingToggle
                  testId="admin-setting-toggle-ops.publishingEnabled"
                  label={t('settings.publishingLabel')}
                  checked={draftFor('ops.publishingEnabled') === 'true'}
                  onChange={(next) =>
                    onDraft('ops.publishingEnabled', next ? 'true' : 'false')
                  }
                />
              }
            />
          </EditableSection>

          <EditableSection
            id="security"
            testId="admin-settings-section-security"
            Icon={ShieldCheck}
            title={t('settings.securityTitle')}
            subtitle={t('settings.securitySubtitle')}
            settingKeys={SECURITY_KEYS}
            drafts={drafts}
            saveMutation={saveMutation}
          >
            <div className="flex items-start gap-3 py-4">
              <Timer size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
              <div className="min-w-0 flex-1">
                <Input
                  id="admin-session-duration"
                  label={t('settings.sessionDurationLabel')}
                  hint={t('settings.sessionDurationDescription')}
                  type="number"
                  min={1}
                  max={90}
                  value={draftFor('auth.adminSessionDurationDays')}
                  onChange={(event) =>
                    onDraft('auth.adminSessionDurationDays', event.target.value)
                  }
                />
              </div>
            </div>
          </EditableSection>

          <section
            id="danger"
            data-testid="admin-settings-section-danger"
            aria-label={t('settings.dangerTitle')}
            className="rounded-xl border border-status-error/40 bg-surface p-4 shadow-sm sm:p-6"
          >
            <h2 className="flex items-center gap-2 text-title-lg font-semibold text-status-error">
              <TriangleAlert size={20} aria-hidden="true" className="shrink-0" />
              <span>{t('settings.dangerTitle')}</span>
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{t('settings.dangerSubtitle')}</p>
            <div className="mt-4 flex flex-col gap-4">
              <div
                data-testid="admin-danger-registrations"
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <Pause size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
                  <div className="min-w-0">
                    <p className="text-title-sm font-medium text-ink">
                      {t('settings.disableRegTitle')}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {t('settings.disableRegDescription')}
                    </p>
                  </div>
                </div>
                {armedAction === 'registrations' ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className="text-sm text-ink">{t('settings.disableRegArmed')}</span>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      data-testid="admin-danger-registrations-confirm"
                      disabled={saveMutation.isPending}
                      onClick={() => void disableRegistrations()}
                    >
                      {t('shared.confirm')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setArmedAction(null)}
                    >
                      {t('shared.cancel')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-testid="admin-danger-registrations-arm"
                    className="shrink-0 text-status-error"
                    onClick={() => {
                      setDangerFailed(false);
                      setDangerDone(null);
                      setArmedAction('registrations');
                    }}
                  >
                    <Pause size={16} aria-hidden="true" />
                    <span>{t('settings.disableRegCta')}</span>
                  </Button>
                )}
              </div>

              <div
                data-testid="admin-danger-maintenance"
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <Wrench size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="text-title-sm font-medium text-ink">
                      {t('settings.maintenanceDangerTitle')}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {t('settings.maintenanceDangerDescription')}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {maintenanceOn
                        ? t('settings.maintenanceOn')
                        : t('settings.maintenanceOff')}
                    </p>
                    <div className="mt-3 max-w-md">
                      <Input
                        id="admin-danger-maintenance-message"
                        label={t('settings.maintenanceMessageLabel')}
                        placeholder={t('settings.maintenanceMessagePlaceholder')}
                        value={maintenanceMessage}
                        onChange={(event) => setMaintenanceMessage(event.target.value)}
                      />
                    </div>
                    {messageTooLong ? (
                      <p role="alert" className="mt-1 text-sm text-status-error">
                        {t('settings.invalidValue')}
                      </p>
                    ) : null}
                  </div>
                </div>
                {armedAction === 'maintenance' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-ink">{t('settings.maintenanceArmed')}</span>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      data-testid="admin-danger-maintenance-confirm"
                      disabled={maintenanceMutation.isPending || messageTooLong}
                      onClick={() => void applyMaintenance(!maintenanceOn)}
                    >
                      {t('shared.confirm')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setArmedAction(null)}
                    >
                      {t('shared.cancel')}
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      data-testid="admin-danger-maintenance-arm"
                      className="shrink-0 text-status-error"
                      disabled={messageTooLong}
                      onClick={() => {
                        setDangerFailed(false);
                        setDangerDone(null);
                        setArmedAction('maintenance');
                      }}
                    >
                      <Wrench size={16} aria-hidden="true" />
                      <span>
                        {maintenanceOn
                          ? t('settings.maintenanceDisableCta')
                          : t('settings.maintenanceEnableCta')}
                      </span>
                    </Button>
                  </div>
                )}
              </div>

              {dangerFailed ? (
                <p data-testid="admin-danger-error" role="alert" className="text-sm text-status-error">
                  {t('settings.sectionSaveError')}
                </p>
              ) : null}
              {dangerDone ? (
                <p data-testid="admin-danger-done" className="text-sm text-ink-muted">
                  {dangerDone}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function EditableModerationToggles({
  drafts,
  onDraft,
  saveMutation,
}: {
  drafts: Record<string, string>;
  onDraft: (key: string, next: string) => void;
  saveMutation: SaveMutation;
}) {
  const t = useTranslations('adminModeration');
  const [invalid, setInvalid] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const draftFor = (key: string): string => drafts[key] ?? '';

  const onSave = async () => {
    setInvalid(false);
    setFailed(false);
    setSaved(false);
    const payload: { key: string; value: unknown }[] = [];
    for (const key of MODERATION_KEYS) {
      const raw = drafts[key] ?? '';
      const def = settingDefOf(key);
      const prepared: unknown = def?.kind === 'boolean' ? raw === 'true' : raw;
      const value = coerceSettingValue(key, prepared);
      if (!validateSettingValue(key, value)) {
        setInvalid(true);
        return;
      }
      payload.push({ key, value });
    }
    setSaving(true);
    try {
      for (const item of payload) await saveMutation.mutateAsync(item);
      setSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <RowShell
        Icon={MailCheck}
        label={t('settings.requireVerifiedEmailLabel')}
        description={t('settings.requireVerifiedEmailDescription')}
        control={
          <SettingToggle
            testId="admin-setting-toggle-moderation.requireVerifiedEmail"
            label={t('settings.requireVerifiedEmailLabel')}
            checked={draftFor('moderation.requireVerifiedEmail') === 'true'}
            onChange={(next) =>
              onDraft('moderation.requireVerifiedEmail', next ? 'true' : 'false')
            }
          />
        }
      />
      <RowShell
        Icon={Gavel}
        label={t('settings.suspendOnReportLabel')}
        description={t('settings.suspendOnReportDescription')}
        control={
          <SettingToggle
            testId="admin-setting-toggle-moderation.suspendOnReport"
            label={t('settings.suspendOnReportLabel')}
            checked={draftFor('moderation.suspendOnReport') === 'true'}
            onChange={(next) => onDraft('moderation.suspendOnReport', next ? 'true' : 'false')}
          />
        }
      />
      <div className="flex items-start gap-3 py-4">
        <Hourglass size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
        <div className="min-w-0 flex-1">
          <Input
            id="admin-publish-gate-limit"
            label={t('settings.publishGateLabel')}
            hint={t('settings.publishGateDescription')}
            type="number"
            min={0}
            value={draftFor('publishGate.maxPendingOpportunities')}
            onChange={(event) =>
              onDraft('publishGate.maxPendingOpportunities', event.target.value)
            }
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 py-4">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="admin-settings-section-moderation-save"
          disabled={saving}
          onClick={() => void onSave()}
        >
          {saving ? t('shared.saving') : t('shared.save')}
        </Button>
        {invalid ? (
          <p data-testid="admin-settings-section-moderation-invalid" role="alert" className="text-sm text-status-error">
            {t('settings.invalidValue')}
          </p>
        ) : null}
        {failed ? (
          <p data-testid="admin-settings-section-moderation-error" role="alert" className="text-sm text-status-error">
            {t('settings.sectionSaveError')}
          </p>
        ) : null}
        {saved ? (
          <p data-testid="admin-settings-section-moderation-saved" className="text-sm text-ink-muted">
            {t('settings.sectionSaved')}
          </p>
        ) : null}
      </div>
    </>
  );
}

export function AdminSettingsPage({ locale }: { locale: string }) {
  return (
    <RequireAdminModeration locale={locale} next={`/admin/settings`}>
      <div data-testid="admin-settings">
        <SettingsContent />
      </div>
    </RequireAdminModeration>
  );
}
