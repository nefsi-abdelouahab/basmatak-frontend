'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { SessionExpiredScreen } from '@/components/system/SessionExpiredScreen';
import { ServerErrorScreen } from '@/components/system/ServerErrorScreen';
import { errorStateFor, mapToApiError } from '@/lib/api/errors';
import { DOSSIER_MIMES, validateUploadFile } from '@/lib/api/organizations';
import { useSessionQuery } from '@/hooks/useSession';
import {
  isEmailNotVerifiedError,
  useOwnOrganizationQuery,
  useSubmitVerificationMutation,
  useUploadOrgMedia,
  useVerificationStatusQuery,
  verificationViewOf,
} from '@/hooks/useOrgOnboarding';

interface PendingFile {
  key: number;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  progress: number;
  state: 'ready' | 'uploading' | 'failed';
  error?: 'type' | 'size' | 'upload';
}

let fileKey = 0;

export function VerificationDossierForm() {
  const t = useTranslations('orgOnboarding');
  const router = useRouter();
  const sessionQuery = useSessionQuery();
  const orgQuery = useOwnOrganizationQuery();
  const statusQuery = useVerificationStatusQuery();
  const submitMutation = useSubmitVerificationMutation();
  const uploadMedia = useUploadOrgMedia();

  const [files, setFiles] = useState<PendingFile[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const redirected = useRef(false);

  const emailVerified =
    sessionQuery.data?.emailVerifiedAt !== null &&
    sessionQuery.data?.emailVerifiedAt !== undefined;
  const gated = !sessionQuery.isPending && !emailVerified;

  useEffect(() => {
    if (gated && !redirected.current) {
      redirected.current = true;
      router.replace('/verify-email?status=unverified');
    }
  }, [gated, router]);

  if (statusQuery.isPending || orgQuery.isPending || sessionQuery.isPending) {
    return (
      <Card>
        <div data-testid="org-dossier-loading">
          <Loader label={t('dossier.loading')} />
          <p className="mt-2 text-ink-muted">{t('dossier.loading')}</p>
        </div>
      </Card>
    );
  }

  if (statusQuery.isError) {
    if (isEmailNotVerifiedError(statusQuery.error)) {
      return (
        <Card>
          <div data-testid="org-gate">
            <h1 className="mb-1 text-2xl font-bold text-ink">{t('gate.unverifiedTitle')}</h1>
            <p className="mb-4 text-ink-muted">{t('gate.unverifiedDescription')}</p>
            <Link
              href="/verify-email?status=unverified"
              className="text-sm font-medium text-primary"
            >
              {t('gate.verifyEmailCta')}
            </Link>
          </div>
        </Card>
      );
    }
    const state = errorStateFor(mapToApiError(statusQuery.error));
    if (state === 'session-expired') return <SessionExpiredScreen />;
    return <ServerErrorScreen />;
  }

  // Account-level gate (session says unverified): redirect runs in the effect
  // above; the gate card covers the frame before navigation completes.
  if (gated) {
    return (
      <Card>
        <div data-testid="org-gate">
          <h1 className="mb-1 text-2xl font-bold text-ink">{t('gate.unverifiedTitle')}</h1>
          <p className="mb-4 text-ink-muted">{t('gate.unverifiedDescription')}</p>
          <Link
            href="/verify-email?status=unverified"
            className="text-sm font-medium text-primary"
          >
            {t('gate.verifyEmailCta')}
          </Link>
        </div>
      </Card>
    );
  }

  const registryId = orgQuery.data?.registryId;
  const view = verificationViewOf(statusQuery.data?.verificationStatus);
  const rejectionReason = statusQuery.data?.latest?.rejectionReason ?? null;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: PendingFile[] = [];
    for (const file of Array.from(list)) {
      const check = validateUploadFile({ type: file.type, size: file.size }, DOSSIER_MIMES);
      fileKey += 1;
      next.push({
        key: fileKey,
        name: file.name,
        type: file.type,
        size: file.size,
        blob: file,
        progress: 0,
        state: check.ok ? 'ready' : 'failed',
        error: check.ok ? undefined : check.reason,
      });
    }
    setFiles((prev) => [...prev, ...next]);
    setSubmitted(false);
  }

  async function onSubmit() {
    setSubmitError(null);
    setSubmitted(false);
    const ready = files.filter((f) => f.state === 'ready');
    if (ready.length === 0 && (statusQuery.data?.latest?.documents ?? []).length === 0) return;

    try {
      const mediaIds: string[] = [];
      for (const file of ready) {
        setFiles((prev) =>
          prev.map((f) => (f.key === file.key ? { ...f, state: 'uploading' as const } : f)),
        );
        try {
          const mediaId = await uploadMedia(
            { name: file.name, type: file.type, size: file.size, blob: file.blob },
            {
              purpose: 'verification_document',
              allowed: DOSSIER_MIMES,
              onProgress: (p) =>
                setFiles((prev) =>
                  prev.map((f) => (f.key === file.key ? { ...f, progress: p.percent } : f)),
                ),
            },
          );
          mediaIds.push(mediaId);
          setFiles((prev) => prev.filter((f) => f.key !== file.key));
        } catch {
          setFiles((prev) =>
            prev.map((f) =>
              f.key === file.key ? { ...f, state: 'failed' as const, error: 'upload' as const } : f,
            ),
          );
          throw new Error('UPLOAD_FAILED');
        }
      }
      const previous = statusQuery.data?.latest?.documents ?? [];
      await submitMutation.mutateAsync({ documents: [...previous, ...mediaIds] });
      await statusQuery.refetch();
      setSubmitted(true);
    } catch (err) {
      if (isEmailNotVerifiedError(err)) {
        router.replace('/verify-email?status=unverified');
        return;
      }
      const apiError = mapToApiError(err);
      if (apiError.code === 'ORG_ALREADY_VERIFIED') {
        setSubmitError(t('dossier.alreadyVerified'));
      } else if (err instanceof Error && err.message === 'UPLOAD_FAILED') {
        setSubmitError(t('dossier.genericError'));
      } else {
        setSubmitError(t('dossier.genericError'));
      }
    }
  }

  return (
    <div data-testid="org-dossier" className="flex flex-col gap-6">
      <Card>
        <h1 className="mb-1 text-2xl font-bold text-ink">{t('dossier.title')}</h1>
        <p className="mb-2 text-ink-muted">{t('dossier.subtitle')}</p>
        {registryId ? (
          <p data-testid="org-registry-code" className="mb-4 text-sm text-ink-muted">
            {t('dossier.orgCodeLabel')}: <span className="font-semibold text-ink">{registryId}</span>
          </p>
        ) : null}

        {view === 'verified' ? (
          <p data-testid="org-dossier-verified" className="text-sm text-status-success">
            {t('dossier.verifiedTitle')} — {t('dossier.verifiedDescription')}
          </p>
        ) : (
          <>
            {view === 'pending' ? (
              <div
                data-testid="org-pending-review"
                className="mb-4 rounded-md border border-border bg-surface-muted px-4 py-3"
              >
                <p className="text-sm font-medium text-ink">{t('dossier.pendingTitle')}</p>
                <p className="mt-1 text-sm text-ink-muted">{t('dossier.pendingDescription')}</p>
              </div>
            ) : null}
            {view === 'rejected' ? (
              <div className="mb-4 rounded-md border border-border bg-surface-muted px-4 py-3">
                <p className="text-sm font-medium text-ink">{t('dossier.rejectedTitle')}</p>
                {rejectionReason ? (
                  <p className="mt-1 text-sm text-ink-muted">
                    {t('dossier.rejectionReasonLabel')}: {rejectionReason}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mb-2">
              <label htmlFor="org-dossier-files" className="mb-1 block text-sm font-medium text-ink">
                {t('dossier.addDocuments')}
              </label>
              <input
                id="org-dossier-files"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => addFiles(e.target.files)}
                className="w-full text-sm text-ink"
              />
              <p className="mt-1 text-sm text-ink-muted">{t('dossier.documentHint')}</p>
            </div>

            {files.length > 0 ? (
              <ul className="mb-4 flex flex-col gap-2">
                {files.map((file) => (
                  <li
                    key={file.key}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span className="truncate text-ink">{file.name}</span>
                    {file.state === 'uploading' ? (
                      <span className="shrink-0 text-ink-muted">{file.progress}%</span>
                    ) : file.state === 'failed' ? (
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-status-error">
                          {file.error === 'size'
                            ? t('dossier.fileSizeError')
                            : t('dossier.fileTypeError')}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setFiles((prev) => prev.filter((f) => f.key !== file.key))
                          }
                          className="font-medium text-primary"
                        >
                          {t('dossier.removeFile')}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setFiles((prev) => prev.filter((f) => f.key !== file.key))}
                        className="shrink-0 font-medium text-primary"
                      >
                        {t('dossier.removeFile')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}

            {submitError ? (
              <p data-testid="org-dossier-error" className="mb-2 text-sm text-status-error">
                {submitError}
              </p>
            ) : null}
            {submitted ? (
              <p data-testid="org-dossier-submitted" className="mb-2 text-sm text-status-success">
                {t('dossier.submitted')}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={onSubmit}
                disabled={submitMutation.isPending || files.every((f) => f.state !== 'ready')}
              >
                {submitMutation.isPending
                  ? t('dossier.submitting')
                  : view === 'rejected'
                    ? t('dossier.resubmit')
                    : t('dossier.submit')}
              </Button>
              <Link
                href="/org/complete-profile"
                className="text-sm font-medium text-primary"
              >
                {t('dossier.completeProfileCta')}
              </Link>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
