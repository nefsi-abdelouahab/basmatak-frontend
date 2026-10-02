'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useDeleteOrgAccountMutation } from '@/hooks/useOrgAccount';
import { SectionError } from './components';

// Danger zone (code.html §6, cleaned): DELETE /organizations/me
// (soft-archives the org + user, revokes every session) behind a
// type-to-confirm gate. The design's preserved-records sentence is replaced
// with the real behavior: volunteer-owned experience records persist —
// stated plainly below.
export function DangerSection() {
  const t = useTranslations('orgAccount');
  const del = useDeleteOrgAccountMutation();
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
    <section aria-label={t('settings.dangerTitle')} className="scroll-mt-24">
      <div data-testid="settings-danger" className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-status-error">{t('settings.dangerTitle')}</h2>
        <p className="text-sm text-ink-muted">{t('settings.dangerHint')}</p>
        <div className="mt-3 space-y-4 rounded-xl bg-status-error/10 p-6">
          {!open ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-ink">{t('settings.deleteTitle')}</h3>
              <p className="text-sm leading-relaxed text-ink-muted">
                {t('settings.deleteBody')} {t('settings.deleteRemain')}
              </p>
              <div className="pt-1">
                <Button type="button" variant="danger" onClick={() => setOpen(true)}>
                  {t('settings.deleteCta')}
                </Button>
              </div>
            </div>
          ) : (
            <form
              data-testid="delete-confirm"
              onSubmit={onSubmit}
              className="flex flex-col gap-3"
              noValidate
            >
              <h3 className="text-base font-semibold text-ink">{t('settings.deleteTitle')}</h3>
              <p className="text-sm leading-relaxed text-ink-muted">
                {t('settings.deleteBody')} {t('settings.deleteRemain')}
              </p>
              <Input
                id="org-delete-confirm-word"
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
          )}
        </div>
      </div>
    </section>
  );
}
