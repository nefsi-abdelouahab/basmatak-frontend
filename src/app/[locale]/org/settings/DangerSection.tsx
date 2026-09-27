'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useDeleteOrgAccountMutation } from '@/hooks/useOrgAccount';
import { SectionError } from './components';

// Delete-org with typed confirm gate: DELETE /organizations/me only fires
// after the confirm word matches (unit-tested gating).
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
    <Card title={t('settings.dangerTitle')}>
      <div data-testid="settings-danger" className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{t('settings.dangerHint')}</p>
        {!open ? (
          <div>
            <Button type="button" variant="danger" onClick={() => setOpen(true)}>
              {t('settings.deleteCta')}
            </Button>
          </div>
        ) : (
          <form
            data-testid="delete-confirm"
            onSubmit={onSubmit}
            className="flex flex-col gap-3"
            noValidate
          >
            <h2 className="text-base font-semibold text-ink">{t('settings.deleteTitle')}</h2>
            <p className="text-sm text-ink-muted">{t('settings.deleteBody')}</p>
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
    </Card>
  );
}
