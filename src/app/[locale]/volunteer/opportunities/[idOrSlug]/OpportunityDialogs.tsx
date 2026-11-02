'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

const TEXTAREA_CLASS =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-ink placeholder:text-ink-muted focus:border-gold-strong focus:outline-none';

// Apply dialog: optional message (trimmed, <= 2000) over the per-position
// apply endpoint. Server codes are the source of truth; client validation is
// a fast path only.
export function ApplyDialog({
  positionTitle,
  onClose,
  onSubmit,
  isSubmitting,
  serverCode,
}: {
  positionTitle: string;
  onClose: () => void;
  onSubmit: (message?: string) => void;
  isSubmitting: boolean;
  serverCode: string | null;
}) {
  const t = useTranslations('opportunityDetails');
  const [message, setMessage] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);

  function submit() {
    const trimmed = message.trim();
    if (trimmed.length > 2000) {
      setClientError(t('apply.messageTooLong'));
      return;
    }
    setClientError(null);
    onSubmit(trimmed ? trimmed : undefined);
  }

  return (
    <div
      data-testid="apply-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={t('apply.dialogTitle', { title: positionTitle })}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
    >
      <Card title={t('apply.dialogTitle', { title: positionTitle })} className="w-full max-w-lg">
        <label htmlFor="apply-message" className="mb-1 block text-sm font-medium text-ink">
          {t('apply.messageLabel')}
        </label>
        <textarea
          id="apply-message"
          rows={4}
          maxLength={2000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={t('apply.messageHint')}
          className={TEXTAREA_CLASS}
        />
        {clientError ? (
          <p data-testid="apply-client-error" role="alert" className="mt-1 text-sm text-status-error">
            {clientError}
          </p>
        ) : null}
        {serverCode === 'EMAIL_NOT_VERIFIED' ? (
          <p data-testid="apply-verify-note" role="alert" className="mt-2 text-sm text-status-pending">
            {t('apply.unverifiedEmail')}{' '}
            <Link href="/verify-email" className="font-medium text-gold-strong">
              {t('apply.verifyCta')}
            </Link>
          </p>
        ) : null}
        {serverCode === 'DUPLICATE_APPLICATION' ? (
          <p data-testid="apply-error" role="alert" className="mt-2 text-sm text-status-error">
            {t('apply.duplicate')}
          </p>
        ) : null}
        {serverCode && serverCode !== 'EMAIL_NOT_VERIFIED' && serverCode !== 'DUPLICATE_APPLICATION' ? (
          <p data-testid="apply-error" role="alert" className="mt-2 text-sm text-status-error">
            {serverCode === 'POSITION_FULL'
              ? t('positions.fullNote')
              : serverCode === 'APPLICATIONS_CLOSED' ||
                  serverCode === 'APPLICATION_DEADLINE_PASSED'
                ? t('positions.closedNote')
                : t('shared.genericError')}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {t('shared.cancel')}
          </Button>
          <Button data-testid="apply-submit" onClick={submit} disabled={isSubmitting}>
            {isSubmitting ? t('apply.submitting') : t('apply.submit')}
          </Button>
        </div>
      </Card>
    </div>
  );

}

// Withdraw dialog: explicit confirm before POST withdraw (seat freed on
// re-read via detail invalidation in the hook).
export function WithdrawDialog({
  onClose,
  onConfirm,
  isSubmitting,
}: {
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}) {
  const t = useTranslations('opportunityDetails');
  return (
    <div
      data-testid="withdraw-confirm"
      role="dialog"
      aria-modal="true"
      aria-label={t('withdraw.confirmTitle')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
    >
      <Card title={t('withdraw.confirmTitle')} className="w-full max-w-md">
        <p className="text-sm text-ink-muted">{t('withdraw.confirmBody')}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {t('shared.cancel')}
          </Button>
          <Button
            data-testid="withdraw-confirm-action"
            variant="danger"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? t('withdraw.withdrawing') : t('withdraw.confirmAction')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Report dialog: required reason (validated client-side AND server-side),
// optional details, over POST /reports with targetType "opportunity".
export function ReportDialog({
  onClose,
  onSubmit,
  isSubmitting,
  submitted,
}: {
  onClose: () => void;
  onSubmit: (input: { reason: string; description?: string }) => void;
  isSubmitting: boolean;
  submitted: boolean;
}) {
  const t = useTranslations('opportunityDetails');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);

  function submit() {
    if (!reason.trim()) {
      setClientError(t('report.reasonRequired'));
      return;
    }
    setClientError(null);
    onSubmit({ reason: reason.trim(), description: description.trim() || undefined });
  }

  return (
    <div
      data-testid="report-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={t('report.dialogTitle')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
    >
      <Card title={t('report.dialogTitle')} className="w-full max-w-md">
        {submitted ? (
          <p data-testid="report-success" role="status" className="text-sm text-ink">
            {t('report.success')}
          </p>
        ) : (
          <>
            <Input
              id="report-reason"
              label={t('report.reasonLabel')}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              error={clientError ?? undefined}
            />
            <div className="mt-3">
              <label htmlFor="report-description" className="mb-1 block text-sm font-medium text-ink">
                {t('report.descriptionLabel')}
              </label>
              <textarea
                id="report-description"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={TEXTAREA_CLASS}
              />
            </div>
          </>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {submitted ? t('shared.close') : t('shared.cancel')}
          </Button>
          {!submitted ? (
            <Button data-testid="report-submit" onClick={submit} disabled={isSubmitting}>
              {isSubmitting ? t('report.submitting') : t('report.submit')}
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
