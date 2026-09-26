'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { SessionExpiredScreen } from '@/components/system/SessionExpiredScreen';
import { ServerErrorScreen } from '@/components/system/ServerErrorScreen';
import { NotFoundScreen } from '@/components/system/NotFoundScreen';
import { errorStateFor, mapToApiError } from '@/lib/api/errors';
import {
  evidenceKindOfMime,
  isAllowedEvidenceLink,
  linkedMediaIdOf,
  needsImageryConsent,
  submissionIdOf,
  submissionStatusOf,
  submitReadiness,
  validateEvidenceFile,
  type EvidenceKind,
} from '@/lib/api/submissions';
import { getLoginHref, useSessionQuery } from '@/hooks/useSession';
import {
  isConflictError,
  isConsentRequiredError,
  useCreateMediaLinkMutation,
  useCreateSubmissionMutation,
  useDeleteMediaMutation,
  useMySubmissionsQuery,
  usePatchSubmissionMutation,
  useSubmissionQuery,
  useSubmitSubmissionMutation,
  useUploadEvidence,
} from '@/hooks/useSubmissions';

// F7-owned route-local bits. ProgressBar duplicates the OQ1-approved thin
// token-driven bar (F2 precedent) without importing F2-owned files.
function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  return (
    <div
      data-testid="upload-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label}
      className="h-1.5 w-full rounded-full bg-border-muted"
    >
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${clamped}%` }} />
    </div>
  );
}

function SectionError({ message, testId }: { message: string; testId: string }) {
  return (
    <p data-testid={testId} role="alert" className="text-sm text-status-error">
      {message}
    </p>
  );
}

interface EvidenceItem {
  mediaId: string;
  kind: EvidenceKind;
}

function statusTone(status: string): PillTone {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'error';
  if (status === 'submitted' || status === 'under_review') return 'pending';
  return 'neutral';
}

export function SubmitContributionPage({
  locale,
  participationId,
}: {
  locale: string;
  participationId: string;
}) {
  const t = useTranslations('submitContribution');
  const router = useRouter();
  const sessionQuery = useSessionQuery();
  const mineQuery = useMySubmissionsQuery();

  const existing = (mineQuery.data ?? []).find((s) => s.participationId === participationId);
  const existingId = existing ? submissionIdOf(existing) : undefined;
  const detailQuery = useSubmissionQuery(existingId);
  const submission = detailQuery.data ?? existing ?? null;

  const createMutation = useCreateSubmissionMutation();
  const patchMutation = usePatchSubmissionMutation();
  const submitMutation = useSubmitSubmissionMutation();
  const linkMutation = useCreateMediaLinkMutation();
  const deleteMutation = useDeleteMediaMutation();
  const uploadEvidence = useUploadEvidence();

  const [newTitle, setNewTitle] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [consent, setConsent] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const hydratedFor = useRef<string | null>(null);

  const next = `/${locale}/volunteer/tasks/${participationId}/submit`;
  useEffect(() => {
    if (sessionQuery.isError) router.replace(getLoginHref(locale, next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionQuery.isError]);

  // Hydrate the editor once per submission record.
  useEffect(() => {
    if (!submission) return;
    const id = submissionIdOf(submission);
    if (hydratedFor.current === id) return;
    hydratedFor.current = id;
    setTitle(submission.title ?? '');
    setDescription(submission.description ?? '');
    setItems((submission.evidence ?? []).map((mediaId) => ({ mediaId, kind: 'unknown' as EvidenceKind })));
    setConsent(submission.consentConfirmed ?? false);
    setSaved(false);
    setSubmitted(false);
    setFormError(null);
  }, [submission]);

  if (sessionQuery.isPending || mineQuery.isPending) {
    return (
      <div data-testid="submit-loading" className="mx-auto w-full max-w-3xl p-4">
        <Loader label={t('shared.loading')} />
      </div>
    );
  }
  if (sessionQuery.isError) return null;
  if (mineQuery.isError) {
    const state = errorStateFor(mapToApiError(mineQuery.error));
    if (state === 'session-expired') return <SessionExpiredScreen />;
    return <ServerErrorScreen />;
  }

  const status = submission ? submissionStatusOf(submission) : null;
  const editable = status === null || status === 'draft' || status === 'rejected';
  const consentRequired = needsImageryConsent(items);
  const readiness = submitReadiness({ description, evidence: items.map((i) => i.mediaId) });
  const submitBlocked =
    !readiness.ok || (consentRequired && !consent) || submitMutation.isPending;

  async function handleCreate() {
    setFormError(null);
    if (newTitle.trim().length > 200) {
      setFormError(t('draft.titleTooLong'));
      return;
    }
    try {
      await createMutation.mutateAsync({
        participationId,
        input: newTitle.trim() ? { title: newTitle.trim() } : {},
      });
    } catch (err) {
      // A 409 means a submission already exists (one per participant):
      // re-read the list instead of duplicating.
      if (!isConflictError(err)) setFormError(t('draft.createError'));
      mineQuery.refetch();
    }
  }

  async function handleSave() {
    if (!submission) return;
    setFormError(null);
    setSaved(false);
    if (title.trim().length > 200) {
      setFormError(t('draft.titleTooLong'));
      return;
    }
    try {
      await patchMutation.mutateAsync({
        submissionId: submissionIdOf(submission),
        input: {
          ...(title.trim() ? { title: title.trim() } : {}),
          ...(description ? { description } : {}),
          evidence: items.map((i) => i.mediaId),
          ...(consent ? { consentConfirmed: true } : {}),
        },
      });
      setSaved(true);
    } catch {
      setFormError(t('draft.saveError'));
    }
  }

  async function handlePickFile(event: ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0];
    event.target.value = '';
    if (!f || !submission) return;
    setFileError(null);
    const check = validateEvidenceFile({ name: f.name, type: f.type, size: f.size });
    if (!check.ok) {
      setFileError(check.reason === 'type' ? t('evidence.typeError') : t('evidence.sizeError'));
      return;
    }
    setUploading(true);
    setUploadPercent(0);
    try {
      const mediaId = await uploadEvidence(
        { name: f.name, type: f.type, size: f.size, bytes: f },
        { onProgress: (p) => setUploadPercent(p.percent) },
      );
      const next = [...items, { mediaId, kind: evidenceKindOfMime(f.type) }];
      setItems(next);
      await patchMutation.mutateAsync({
        submissionId: submissionIdOf(submission),
        input: { evidence: next.map((i) => i.mediaId) },
      });
    } catch {
      setFileError(t('evidence.uploadError'));
    } finally {
      setUploading(false);
      setUploadPercent(null);
    }
  }

  async function handleAddLink() {
    if (!submission) return;
    setLinkError(null);
    const check = isAllowedEvidenceLink(linkUrl);
    if (!check.ok) {
      setLinkError(check.reason === 'host' ? t('evidence.linkHostError') : t('evidence.linkUrlError'));
      return;
    }
    try {
      const linked = await linkMutation.mutateAsync({ url: check.url });
      const mediaId = linkedMediaIdOf(linked);
      const next = [...items, { mediaId, kind: 'link' as EvidenceKind }];
      setItems(next);
      setLinkUrl('');
      await patchMutation.mutateAsync({
        submissionId: submissionIdOf(submission),
        input: { evidence: next.map((i) => i.mediaId) },
      });
    } catch {
      setLinkError(t('evidence.linkError'));
    }
  }

  async function handleRemove(mediaId: string) {
    if (!submission) return;
    setFormError(null);
    const next = items.filter((i) => i.mediaId !== mediaId);
    try {
      await deleteMutation.mutateAsync(mediaId);
      setItems(next);
      await patchMutation.mutateAsync({
        submissionId: submissionIdOf(submission),
        input: { evidence: next.map((i) => i.mediaId) },
      });
    } catch {
      setFormError(t('evidence.removeError'));
    }
  }

  async function handleSubmit() {
    if (!submission || submitBlocked) return;
    setFormError(null);
    setSubmitted(false);
    const check = submitReadiness({ description, evidence: items.map((i) => i.mediaId) });
    if (!check.ok) {
      setFormError(
        check.reason === 'description' ? t('draft.descriptionRequired') : t('evidence.required'),
      );
      return;
    }
    if (consentRequired && !consent) {
      setFormError(t('consent.requiredError'));
      return;
    }
    try {
      // Persist the latest editor state first (rejected→draft resubmit path),
      // then submit. Consent travels on both calls when checked.
      await patchMutation.mutateAsync({
        submissionId: submissionIdOf(submission),
        input: {
          ...(title.trim() ? { title: title.trim() } : {}),
          description,
          evidence: items.map((i) => i.mediaId),
          ...(consent ? { consentConfirmed: true } : {}),
        },
      });
      await submitMutation.mutateAsync({
        submissionId: submissionIdOf(submission),
        input: consent ? { consentConfirmed: true } : {},
      });
      setSubmitted(true);
    } catch (err) {
      if (isConsentRequiredError(err)) setFormError(t('consent.requiredError'));
      else setFormError(t('submit.submitError'));
    }
  }

  return (
    <div data-testid="submit-contribution" className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t('page.title')}</h1>
        <p className="text-sm text-ink-muted">{t('page.subtitle')}</p>
        <Link href="/volunteer/tasks" className="mt-1 inline-block text-sm font-medium text-primary">
          {t('page.backToTasks')}
        </Link>
      </div>

      {status ? (
        <Card title={t('status.label')}>
          <div data-testid="submit-status" className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Pill tone={statusTone(status)}>
                <span data-testid="status-value">{t(`status.${status}`)}</span>
              </Pill>
            </div>
            {status === 'rejected' && submission?.rejectionReason ? (
              <div>
                <p className="text-sm font-medium text-ink">{t('status.rejectionReasonLabel')}</p>
                <p data-testid="rejection-reason" className="text-sm text-ink-muted">
                  {submission.rejectionReason}
                </p>
                <p className="mt-1 text-sm text-ink-muted">{t('status.resubmitHint')}</p>
              </div>
            ) : null}
            {status === 'rejected' && !submission?.rejectionReason ? (
              <p className="text-sm text-ink-muted">{t('status.resubmitHint')}</p>
            ) : null}
            {submitted ? (
              <p data-testid="submit-done" className="text-sm text-status-success">
                {t('submit.submitted')}
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {!submission ? (
        <Card title={t('page.title')}>
          <div data-testid="new-draft" className="flex flex-col gap-3">
            <Input
              id="new-title"
              label={t('draft.titleLabel')}
              hint={t('draft.titleHint')}
              value={newTitle}
              maxLength={201}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <div>
              <Button
                type="button"
                data-testid="create-button"
                disabled={createMutation.isPending}
                onClick={handleCreate}
              >
                {createMutation.isPending ? t('shared.saving') : t('shared.save')}
              </Button>
            </div>
            {formError ? <SectionError testId="draft-error" message={formError} /> : null}
          </div>
        </Card>
      ) : detailQuery.isPending ? (
        <div data-testid="submit-loading">
          <Loader label={t('shared.loading')} />
        </div>
      ) : detailQuery.isError && !existing ? (
        <NotFoundScreen />
      ) : (
        <>
          <Card title={t('page.title')}>
            <div className="flex flex-col gap-4">
              <Input
                id="draft-title"
                data-testid="draft-title"
                label={t('draft.titleLabel')}
                hint={t('draft.titleHint')}
                value={title}
                maxLength={201}
                disabled={!editable}
                onChange={(e) => setTitle(e.target.value)}
              />
              <div>
                <label htmlFor="draft-description" className="mb-1 block text-sm font-medium text-ink">
                  {t('draft.descriptionLabel')}
                </label>
                <textarea
                  id="draft-description"
                  data-testid="draft-description"
                  value={description}
                  disabled={!editable}
                  rows={5}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
                />
                <p className="mt-1 text-sm text-ink-muted">{t('draft.descriptionHint')}</p>
              </div>
              {editable ? (
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    data-testid="draft-save"
                    disabled={patchMutation.isPending}
                    onClick={handleSave}
                  >
                    {patchMutation.isPending ? t('shared.saving') : t('shared.save')}
                  </Button>
                  {saved ? (
                    <p data-testid="draft-saved" className="mt-1 text-sm text-status-success">
                      {t('draft.draftSaved')}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Card>

          <Card title={t('evidence.title')}>
            <div data-testid="evidence-section" className="flex flex-col gap-3">
              <p className="text-sm text-ink-muted">{t('evidence.hint')}</p>
              {items.length === 0 ? (
                <p data-testid="evidence-empty" className="text-sm text-ink-muted">
                  {t('evidence.empty')}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {items.map((item) => (
                    <li
                      key={item.mediaId}
                      data-testid="evidence-item"
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <span className="truncate text-sm text-ink">{item.mediaId}</span>
                      {editable ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          data-testid="evidence-remove"
                          disabled={deleteMutation.isPending}
                          onClick={() => handleRemove(item.mediaId)}
                        >
                          {deleteMutation.isPending ? t('evidence.removing') : t('evidence.remove')}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {editable ? (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    aria-label={t('evidence.pickFile')}
                    onChange={handlePickFile}
                  />
                  {uploading ? (
                    <div className="flex flex-col gap-2">
                      <Loader label={t('evidence.uploading')} />
                      {uploadPercent !== null ? (
                        <ProgressBar percent={uploadPercent} label={t('evidence.uploading')} />
                      ) : null}
                      {uploadPercent !== null ? (
                        <p data-testid="evidence-upload-progress" className="text-sm text-ink-muted">
                          {t('evidence.progress', { percent: uploadPercent })}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div>
                      <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
                        {t('evidence.pickFile')}
                      </Button>
                    </div>
                  )}
                  {fileError ? <SectionError testId="file-error" message={fileError} /> : null}
                  <div className="flex flex-col gap-2">
                    <Input
                      id="evidence-link"
                      data-testid="link-input"
                      label={t('evidence.linkLabel')}
                      hint={`${t('evidence.linkHint')} ${t('evidence.allowlistHint')}`}
                      value={linkUrl}
                      inputMode="url"
                      onChange={(e) => setLinkUrl(e.target.value)}
                    />
                    <div>
                      <Button
                        type="button"
                        variant="secondary"
                        data-testid="link-add"
                        disabled={linkMutation.isPending || !linkUrl.trim()}
                        onClick={handleAddLink}
                      >
                        {linkMutation.isPending ? t('evidence.addingLink') : t('evidence.linkAdd')}
                      </Button>
                    </div>
                    {linkError ? <SectionError testId="link-error" message={linkError} /> : null}
                  </div>
                </>
              ) : null}
            </div>
          </Card>

          {editable ? (
            <Card title={t('status.label')}>
              <div className="flex flex-col gap-3">
                <Checkbox
                  id="imagery-consent"
                  data-testid="consent-checkbox"
                  label={t('consent.label')}
                  checked={consent}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setConsent(e.target.checked)}
                />
                <p className="text-sm text-ink-muted">{t('consent.helper')}</p>
                <div>
                  <Button
                    type="button"
                    data-testid="submit-button"
                    disabled={submitBlocked}
                    onClick={handleSubmit}
                  >
                    {submitMutation.isPending
                      ? t('submit.submitting')
                      : status === 'rejected'
                        ? t('submit.resubmitCta')
                        : t('submit.cta')}
                  </Button>
                </div>
                {formError ? <SectionError testId="submit-error" message={formError} /> : null}
              </div>
            </Card>
          ) : null}
          {!editable && formError ? <SectionError testId="submit-error" message={formError} /> : null}
        </>
      )}
    </div>
  );
}
