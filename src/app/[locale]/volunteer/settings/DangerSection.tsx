'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useDeleteAccountMutation } from '@/hooks/useAccountSettings';
import { SectionError } from '../components';

export function DangerSection() {
  const t = useTranslations('volunteerAccount');
  const del = useDeleteAccountMutation();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const word = t('settings.deleteConfirmWord');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (confirm.trim() !== word) {
      setConfirmError(t('settings.deleteConfirmLabel'));
      return;
    }
    setConfirmError(undefined);
    try {
      await del.mutateAsync();
    } catch {
      // surfaced below via del.isError
    }
  }

  return (
    <section
      id="section-danger"
      aria-label={t('settings.dangerZoneTitle')}
      className="scroll-mt-24 rounded-xl border border-status-error/40 bg-surface p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-1 pb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={20} aria-hidden="true" className="shrink-0 text-status-error" />
          <h2 className="text-title-lg text-status-error">{t('settings.dangerZoneTitle')}</h2>
        </div>
        <p className="text-body-sm text-ink-muted">{t('settings.dangerZoneHint')}</p>
      </div>
      <div data-testid="settings-danger" className="flex flex-col gap-3">
        <div className="flex flex-col justify-between gap-3 rounded-lg bg-surface-muted p-3.5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-label-md font-semibold text-ink">{t('settings.dangerTitle')}</span>
            <span className="text-body-sm text-ink-muted">{t('settings.dangerHint')}</span>
          </div>
          {!open ? (
            <Button
              type="button"
              variant="danger"
              onClick={() => setOpen(true)}
              className="shrink-0 self-start sm:self-center"
            >
              {t('settings.deleteCta')}
            </Button>
          ) : null}
        </div>
        {open ? (
          <form
            data-testid="delete-confirm"
            onSubmit={onSubmit}
            className="flex flex-col gap-3 rounded-lg bg-surface-muted p-3.5"
            noValidate
          >
            <h3 className="text-title-sm text-ink">{t('settings.deleteTitle')}</h3>
            <p className="text-body-sm text-ink-muted">{t('settings.deleteBody')}</p>
            <Input
              id="delete-confirm-word"
              label={t('settings.deleteConfirmLabel')}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={confirmError}
            />
            {del.isError ? (
              <SectionError testId="delete-error" message={t('shared.genericError')} />
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="danger" disabled={del.isPending}>
                {del.isPending ? t('settings.deleting') : t('settings.deleteConfirm')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t('shared.cancel')}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}
