'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Select } from '@/components/ui/Select';
import {
  ADMIN_SETTING_KEYS,
  SETTING_DATE_FORMATS,
  SETTING_LANGUAGES,
  coerceSettingValue,
  isMaintenanceMessageValid,
  settingDefOf,
  validateSettingValue,
  type SettingKeyDef,
} from '@/lib/api/adminModeration';
import {
  useAdminSettingsQuery,
  useMaintenanceToggleMutation,
  usePublicSystemStatusQuery,
  useUpdateAdminSettingMutation,
} from '@/hooks/useAdminModeration';
import { useSessionQuery } from '@/hooks/useSession';
import { RequireAdminModeration } from '../AdminModerationGuard';

function SectionError({ message, testId }: { message: string; testId: string }) {
  return (
    <p data-testid={testId} role="alert" className="text-sm text-status-error">
      {message}
    </p>
  );
}

function draftOf(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return '';
}

function SettingEditor({
  def,
  draft,
  onChange,
}: {
  def: SettingKeyDef;
  draft: string;
  onChange: (next: string) => void;
}) {
  const t = useTranslations('adminModeration');
  const inputId = `admin-setting-input-${def.key}`;
  if (def.kind === 'boolean') {
    return (
      <Select
        id={inputId}
        label={t('settings.valueLabel')}
        value={draft === 'false' ? 'false' : 'true'}
        onChange={(event) => onChange(event.target.value)}
        options={[
          { value: 'true', label: 'true' },
          { value: 'false', label: 'false' },
        ]}
      />
    );
  }
  if (def.kind === 'language') {
    return (
      <Select
        id={inputId}
        label={t('settings.valueLabel')}
        value={draft}
        onChange={(event) => onChange(event.target.value)}
        options={[...SETTING_LANGUAGES].map((language) => ({ value: language, label: language }))}
      />
    );
  }
  if (def.kind === 'dateFormat') {
    return (
      <Select
        id={inputId}
        label={t('settings.valueLabel')}
        value={draft}
        onChange={(event) => onChange(event.target.value)}
        options={[...SETTING_DATE_FORMATS].map((format) => ({ value: format, label: format }))}
      />
    );
  }
  if (def.kind === 'number') {
    return (
      <Input
        id={inputId}
        label={t('settings.valueLabel')}
        type="number"
        value={draft}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <Input
      id={inputId}
      label={t('settings.valueLabel')}
      value={draft}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function SettingRow({
  settingKey,
  stored,
  draft,
  onDraft,
}: {
  settingKey: string;
  stored: unknown;
  draft: string;
  onDraft: (next: string) => void;
}) {
  const t = useTranslations('adminModeration');
  const def = settingDefOf(settingKey);
  const [invalid, setInvalid] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const updateMutation = useUpdateAdminSettingMutation();

  // Unknown keys are never sent (backend would 400 UNKNOWN_SETTING_KEY) —
  // they render read-only by design.
  if (!def) {
    return (
      <li
        data-testid={`admin-setting-row-${settingKey}`}
        className="rounded-md border border-border p-3"
      >
        <p className="text-sm font-semibold text-ink">{settingKey}</p>
        <p className="mt-1 text-sm text-ink-muted">{t('settings.unknownKey')}</p>
      </li>
    );
  }

  const onSave = () => {
    setInvalid(false);
    setSaved(false);
    setFailed(false);
    const raw: unknown = def.kind === 'boolean' ? draft === 'true' : draft;
    const value = coerceSettingValue(settingKey, raw);
    if (!validateSettingValue(settingKey, value)) {
      setInvalid(true);
      return;
    }
    updateMutation.mutate(
      { key: settingKey, value },
      { onError: () => setFailed(true), onSuccess: () => setSaved(true) },
    );
  };

  return (
    <li
      data-testid={`admin-setting-row-${settingKey}`}
      className="flex flex-col gap-2 rounded-md border border-border p-3"
    >
      <p className="text-sm font-semibold text-ink">{settingKey}</p>
      <p className="text-xs text-ink-muted">
        {t('settings.valueLabel')}: {draftOf(stored) === '' ? '—' : draftOf(stored)}
      </p>
      <SettingEditor def={def} draft={draft} onChange={onDraft} />
      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid={`admin-setting-save-${settingKey}`}
          disabled={updateMutation.isPending}
          onClick={onSave}
        >
          {updateMutation.isPending ? t('shared.saving') : t('settings.editCta')}
        </Button>
      </div>
      {invalid ? (
        <p data-testid={`admin-setting-invalid-${settingKey}`} role="alert" className="text-sm text-status-error">
          {t('settings.invalidValue')}
        </p>
      ) : null}
      {failed ? (
        <p data-testid={`admin-setting-error-${settingKey}`} role="alert" className="text-sm text-status-error">
          {t('settings.editError')}
        </p>
      ) : null}
      {saved ? (
        <p data-testid={`admin-setting-saved-${settingKey}`} className="text-sm text-ink-muted">
          {t('settings.editSaved')}
        </p>
      ) : null}
    </li>
  );
}

function MaintenanceCard() {
  const t = useTranslations('adminModeration');
  const [enabled, setEnabled] = useState('false');
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const toggleMutation = useMaintenanceToggleMutation();
  const session = useSessionQuery();
  const isAdmin = session.data?.role === 'admin';
  const statusQuery = usePublicSystemStatusQuery({ enabled: isAdmin });

  const messageTooLong = !isMaintenanceMessageValid(message);

  const onApply = () => {
    if (messageTooLong || toggleMutation.isPending) return;
    setFailed(false);
    setSaved(false);
    toggleMutation.mutate(
      {
        enabled: enabled === 'true',
        message: message === '' ? undefined : message,
      },
      {
        onError: () => setFailed(true),
        onSuccess: () => setSaved(true),
      },
    );
  };

  return (
    <Card title={t('settings.maintenanceTitle')}>
      <div data-testid="admin-maintenance" className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{t('settings.maintenanceDescription')}</p>
        <Select
          id="admin-maintenance-enabled"
          label={t('settings.maintenanceEnabledLabel')}
          value={enabled}
          onChange={(event) => setEnabled(event.target.value)}
          options={[
            { value: 'true', label: 'true' },
            { value: 'false', label: 'false' },
          ]}
        />
        <Input
          id="admin-maintenance-message"
          label={t('settings.maintenanceMessageLabel')}
          placeholder={t('settings.maintenanceMessagePlaceholder')}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        {messageTooLong ? (
          <p role="alert" className="text-sm text-status-error">
            {t('settings.invalidValue')}
          </p>
        ) : null}
        <div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            data-testid="admin-maintenance-apply"
            disabled={toggleMutation.isPending || messageTooLong}
            onClick={onApply}
          >
            {t('settings.maintenanceCta')}
          </Button>
        </div>
        {failed ? (
          <p data-testid="admin-maintenance-error" role="alert" className="text-sm text-status-error">
            {t('settings.maintenanceError')}
          </p>
        ) : null}
        {saved ? (
          <p data-testid="admin-maintenance-saved" className="text-sm text-ink-muted">
            {t('settings.editSaved')}
          </p>
        ) : null}
        {statusQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {statusQuery.isError ? (
          <SectionError testId="admin-maintenance-status-error" message={t('settings.statusError')} />
        ) : null}
        {statusQuery.data ? (
          <div data-testid="admin-maintenance-enforced" className="rounded-md border border-border p-3">
            <h3 className="text-sm font-semibold text-ink">{t('settings.enforcedTitle')}</h3>
            <p className="mt-1 text-sm text-ink-muted">
              {statusQuery.data.maintenance ? t('settings.maintenanceOn') : t('settings.maintenanceOff')}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {statusQuery.data.maintenance ? t('settings.enforcedOn') : t('settings.enforcedOff')}
            </p>
            {typeof statusQuery.data.message === 'string' && statusQuery.data.message !== '' ? (
              <p className="mt-1 text-sm text-ink-muted">{statusQuery.data.message}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

// F16-owned Admin Settings route: the stored validated key table (16
// canonical keys, per-key typed editors + shape validation, re-read after
// every write) plus the maintenance toggle card with the live
// `GET /system/status` enforcement read (maintenance → public-503
// spot-check copy). Guest visits redirect to Login (decision 10);
// non-admin roles see the shared 403 state. No civic rows.
export function AdminSettingsPage({ locale }: { locale: string }) {
  const t = useTranslations('adminModeration');
  const session = useSessionQuery();
  const isAdmin = session.data?.role === 'admin';
  const settingsQuery = useAdminSettingsQuery({ enabled: isAdmin });
  const [drafts, setDrafts] = useState<Record<string, string>>({});

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

  return (
    <RequireAdminModeration locale={locale} next={`/${locale}/admin/settings`}>
      <div data-testid="admin-settings" className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('settings.title')}</h1>
          <p className="text-sm text-ink-muted">{t('settings.subtitle')}</p>
        </div>
        {settingsQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {settingsQuery.isError ? (
          <SectionError testId="admin-settings-error" message={t('shared.loadError')} />
        ) : null}
        {settingsQuery.data ? (
          <Card title={t('settings.tableTitle')}>
            <p data-testid="admin-settings-count" className="mb-3 text-sm text-ink-muted">
              {t('settings.count', { total: settingsQuery.data.length })}
            </p>
            {settingsQuery.data.length === 0 ? <Empty title={t('shared.empty')} /> : null}
            <ul data-testid="admin-settings-table" className="flex flex-col gap-3">
              {ADMIN_SETTING_KEYS.map((def) => {
                const stored = settingsQuery.data?.find((row) => row.key === def.key)?.value;
                return (
                  <SettingRow
                    key={def.key}
                    settingKey={def.key}
                    stored={stored}
                    draft={drafts[def.key] ?? draftOf(stored)}
                    onDraft={(next) =>
                      setDrafts((current) => ({ ...current, [def.key]: next }))
                    }
                  />
                );
              })}
            </ul>
          </Card>
        ) : null}
        <MaintenanceCard />
      </div>
    </RequireAdminModeration>
  );
}
