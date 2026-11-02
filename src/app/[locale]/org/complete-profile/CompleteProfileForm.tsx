'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { OrganizationProfileForm } from '@/components/profile/OrganizationProfileForm';
import { useDeleteOrgAccountMutation } from '@/hooks/useOrgAccount';

/**
 * Onboarding wrapper around the shared organization profile form. Field,
 * validation, lookup, media, and completion logic all live in the shared form.
 */
export function CompleteProfileForm() {
  const t = useTranslations('orgOnboarding');
  const deleteMutation = useDeleteOrgAccountMutation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div data-testid="org-complete-profile" className="flex min-w-0 flex-col gap-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-ink">{t('completeProfile.title')}</h1>
        <p className="text-sm text-ink-muted">{t('completeProfile.subtitle')}</p>
      </div>

      <OrganizationProfileForm mode="onboarding" />

      <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
        <h2 className="mb-1 text-lg font-semibold text-ink">
          {t('completeProfile.deleteTitle')}
        </h2>
        <p className="mb-4 text-sm text-ink-muted">
          {t('completeProfile.deleteDescription')}
        </p>
        {confirmingDelete ? (
          <div className="flex flex-wrap gap-3">
            <Button
              variant="danger"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending
                ? t('completeProfile.deleting')
                : t('completeProfile.deleteConfirm')}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
              {t('completeProfile.deleteCancel')}
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirmingDelete(true)}>
            {t('completeProfile.deleteCta')}
          </Button>
        )}
      </section>
    </div>
  );
}
