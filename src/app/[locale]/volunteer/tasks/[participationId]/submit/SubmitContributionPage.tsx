'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft,
  ArrowRight,
  CirclePlus,
  FileText,
  Image as ImageIcon,
  Link2,
  Lock,
  Mail,
  X,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { notify } from '@/lib/notify';
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
  evidenceMediaIdsOf,
  isAllowedEvidenceLink,
  linkedMediaIdOf,
  needsImageryConsent,
  submissionIdOf,
  submissionParticipantIdOf,
  submissionStatusOf,
  submitReadiness,
  validateEvidenceFile,
  type EvidenceKind,
} from '@/lib/api/submissions';
import { coverUrlOf } from '@/lib/api/opportunity';
import { getLoginHref, useSessionQuery } from '@/hooks/useSession';
import { useParticipationQuery } from '@/hooks/useTasks';
import { useCoverMediaQuery, useOpportunityDetailQuery } from '@/hooks/useOpportunity';
import { usePublicOrgProfileQuery } from '@/hooks/usePublicOrgs';
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

// Submit Contribution: form + sticky context rail ported from
// `Basmatak Tatatoua - Submit Contribution` code.html. Every visible field
// is backed by a real endpoint (see the per-field audit in the session
// summary): title/description/evidence/consent via the submissions API,
// opportunity/org/role/date/deliverables via GET /participations/:id,
// cover only when the opportunity detail carries a real coverMediaId,
// organization contact only as a mailto: from the public org profile's
// contact.email. Anything without a backing field is omitted, never faked:
// no messaging/chat button (no threads endpoint), no arbitrary external
// repository URL field (the schema has no external-link field — video links
// go through POST /media/links with the youtube/drive allowlist), no ZIP /
// audio uploads and no inflated size copy (uploads are jpeg/png/webp/pdf ≤ 5 MB), no coordinator
// person name or role, no reviewer name, no sidebar identity note, no civic
// footer links. Layout: single document scroll with a sticky right rail
// (top-24); the capped-height independent-scroll grid used on dense
// feed+filter screens is deliberately NOT applied here because trapping a
// form with a file picker and validation errors inside an inner scroll
// container breaks focus order, keyboard flow, and mobile behavior.

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

// Locale-aware name for backend join embeds (fr/ar + generic title/slug).
function joinText(
  join: {
    nameFr?: unknown;
    nameAr?: unknown;
    name?: unknown;
    title?: unknown;
    slug?: unknown;
  } | null | undefined,
  locale: string,
): string | null {
  if (!join) return null;
  const pick = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() !== '' ? value : null;
  const fr = pick(join.nameFr) ?? pick(join.title);
  const ar = pick(join.nameAr) ?? pick(join.title);
  const generic = pick(join.name) ?? pick(join.slug);
  const text = locale === 'ar' ? (ar ?? fr ?? generic) : (fr ?? ar ?? generic);
  return text;
}

function labelLike(value: unknown, locale: string): string | null {
  if (typeof value === 'string') return value.trim() !== '' ? value : null;
  if (value && typeof value === 'object') {
    const record = value as { nameFr?: unknown; nameAr?: unknown; name?: unknown };
    const fr = typeof record.nameFr === 'string' && record.nameFr.trim() !== '' ? record.nameFr : null;
    const ar = typeof record.nameAr === 'string' && record.nameAr.trim() !== '' ? record.nameAr : null;
    const generic = typeof record.name === 'string' && record.name.trim() !== '' ? record.name : null;
    return locale === 'ar' ? (ar ?? fr ?? generic) : (fr ?? ar ?? generic);
  }
  return null;
}

function formatDateLike(iso: string, locale: string): string | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(locale);
}

function scheduleText(schedule: unknown, locale: string): string | null {
  if (typeof schedule === 'string') return schedule.trim() !== '' ? schedule : null;
  if (schedule && typeof schedule === 'object') {
    const record = schedule as Record<string, unknown>;
    const start = typeof record.startDate === 'string'
      ? record.startDate
      : typeof record.startAt === 'string'
        ? record.startAt
        : null;
    const end = typeof record.endDate === 'string'
      ? record.endDate
      : typeof record.endAt === 'string'
        ? record.endAt
        : null;
    const startText = start ? formatDateLike(start, locale) : null;
    const endText = end ? formatDateLike(end, locale) : null;
    if (startText && endText && startText !== endText) return `${startText} – ${endText}`;
    return startText ?? endText;
  }
  return null;
}

// Deliverables arrive either as plain strings (position embeds) or as
// {title, description?} snapshots (submission rows). Anything else is
// dropped so the checklist never renders stringified objects.
function deliverableTexts(source: unknown): string[] {
  if (!Array.isArray(source)) return [];
  const out: string[] = [];
  for (const entry of source) {
    if (typeof entry === 'string') {
      const text = entry.trim();
      if (text !== '') out.push(text);
    } else if (entry && typeof entry === 'object') {
      const title = (entry as { title?: unknown }).title;
      if (typeof title === 'string' && title.trim() !== '') out.push(title.trim());
    }
  }
  return out;
}

// Evidence ids come from the shared lib helper, which tolerates both the
// list shape (plain ObjectId strings, as the e2e mocks serve) and the detail
// shape ({mediaId, media, url} objects from GET /submissions/:id
// withEvidence) so the editor hydrates on real data.

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function EvidenceKindIcon({ kind }: { kind: EvidenceKind }) {
  if (kind === 'image') return <ImageIcon size={18} aria-hidden="true" className="shrink-0 text-ink-muted" />;
  if (kind === 'link') return <Link2 size={18} aria-hidden="true" className="shrink-0 text-ink-muted" />;
  return <FileText size={18} aria-hidden="true" className="shrink-0 text-ink-muted" />;
}

// Submission lifecycle stepper over the REAL submission statuses only
// (draft → submitted → under_review → Verified Experience for approved).
// The mock's "In Progress" stage is not a submission status and is omitted;
// the final stage uses the neutral "Verified Experience" label with no
// registry wording, and rejected is surfaced by the status card (which owns
// the reviewer feedback + resubmit hint), not by inventing a stepper branch.
function LifecycleRail({ status }: { status: string }) {
  const t = useTranslations('submitContribution');
  const steps = [
    { key: 'draft', label: t('status.draft') },
    { key: 'submitted', label: t('status.submitted') },
    { key: 'under_review', label: t('status.under_review') },
    { key: 'approved', label: t('lifecycle.verifiedExperience') },
  ];
  const current =
    status === 'approved' ? 3 : status === 'under_review' ? 2 : status === 'submitted' ? 1 : 0;
  return (
    <section
      aria-label={t('rail.lifecycle')}
      data-testid="submit-lifecycle"
      className="rounded-lg border border-border bg-surface p-4 shadow-sm"
    >
      <h2 className="text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
        {t('rail.lifecycle')}
      </h2>
      <ol className="relative mt-3 flex flex-col gap-4">
        <span aria-hidden="true" className="absolute bottom-2 start-2 top-2 w-px bg-border" />
        {steps.map((step, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'todo';
          return (
            <li key={step.key} data-testid={`lifecycle-step-${step.key}`} className="relative flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`z-10 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  state === 'done'
                    ? 'border-status-success bg-status-success'
                    : state === 'current'
                      ? 'border-gold-strong bg-primary'
                      : 'border-border bg-surface'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${state === 'todo' ? 'bg-border' : 'bg-on-primary'}`} />
              </span>
              <span className="min-w-0">
                <span
                  aria-current={state === 'current' ? 'step' : undefined}
                  className={`block text-label-md ${state === 'current' ? 'font-semibold text-ink' : 'text-ink-muted'}`}
                >
                  {step.label}
                </span>
                {state === 'current' ? (
                  <span className="block text-label-xs text-ink-muted">{t('lifecycle.currentHint')}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function SubmitContributionPage({
  participationId,
}: {
  participationId: string;
}) {
  const t = useTranslations('submitContribution');
  const locale = useLocale();
  const router = useRouter();
  const sessionQuery = useSessionQuery();
  const mineQuery = useMySubmissionsQuery();

  const existing = (mineQuery.data ?? []).find(
    (s) => submissionParticipantIdOf(s) === participationId,
  );
  const existingId = existing ? submissionIdOf(existing) : undefined;
  const detailQuery = useSubmissionQuery(existingId);
  const submission = detailQuery.data ?? existing ?? null;

  // Participation context (opportunity/org/role/date/deliverables). Never
  // blocks the form: a 404/error simply omits the context cards.
  const participationQuery = useParticipationQuery(participationId);
  const participation = participationQuery.data ?? null;
  const participationRecord = (participation ?? {}) as Record<string, unknown>;
  const opportunityJoin = (participationRecord.opportunity ?? null) as {
    id?: unknown;
    _id?: unknown;
    slug?: unknown;
    title?: unknown;
  } | null;
  const organizationJoin = (participationRecord.organization ?? null) as {
    nameFr?: unknown;
    nameAr?: unknown;
    name?: unknown;
    slug?: unknown;
  } | null;
  const positionJoin = (participationRecord.position ?? null) as {
    title?: unknown;
    deliverables?: unknown;
  } | null;
  const opportunityIdRaw = nonEmptyString(participationRecord.opportunityId) ??
    nonEmptyString(opportunityJoin?.id) ??
    nonEmptyString(opportunityJoin?._id);
  const opportunitySlugRaw = nonEmptyString(opportunityJoin?.slug);
  const opportunityKey = (opportunitySlugRaw ?? opportunityIdRaw ?? '').trim() !== ''
    ? (opportunitySlugRaw ?? opportunityIdRaw ?? '').trim()
    : 'none';
  const opportunityDetailQuery = useOpportunityDetailQuery(opportunityKey);
  const coverQuery = useCoverMediaQuery(opportunityDetailQuery.data?.coverMediaId);
  const coverUrl = coverUrlOf(coverQuery.data);
  const organizationSlug = nonEmptyString(organizationJoin?.slug) ?? '';
  const orgProfileQuery = usePublicOrgProfileQuery(organizationSlug);
  const contactRaw = (orgProfileQuery.data as { contact?: { email?: unknown } } | undefined)?.contact?.email;
  const contactEmail =
    typeof contactRaw === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactRaw.trim())
      ? contactRaw.trim()
      : null;

  const opportunityTitle = nonEmptyString(opportunityJoin?.title);
  const organizationName = joinText(organizationJoin, locale);
  const roleName = nonEmptyString(positionJoin?.title);
  const dateText = scheduleText(participationRecord.schedule, locale);
  const locationLabels = participationRecord.locationLabels;
  const locationText = (() => {
    if (!locationLabels || typeof locationLabels !== 'object') return null;
    const record = locationLabels as Record<string, unknown>;
    const parts = [labelLike(record.wilaya, locale), labelLike(record.municipality, locale)].filter(
      (part): part is string => part !== null,
    );
    return parts.length > 0 ? parts.join(' · ') : null;
  })();
  const submissionDeliverables = (submission as { deliverables?: unknown } | null)?.deliverables;
  const scopeList = deliverableTexts(
    Array.isArray(submissionDeliverables) && submissionDeliverables.length > 0
      ? submissionDeliverables
      : positionJoin?.deliverables,
  );
  const opportunityHref =
    opportunityKey !== 'none' ? `/volunteer/opportunities/${encodeURIComponent(opportunityKey)}` : null;
  const hasContext = opportunityTitle !== null || organizationName !== null || roleName !== null;

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

  const next = `/volunteer/tasks/${participationId}/submit`;
  useEffect(() => {
    if (sessionQuery.isError) router.replace(getLoginHref(next));
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
    setItems(evidenceMediaIdsOf(submission).map((mediaId) => ({ mediaId, kind: 'unknown' as EvidenceKind })));
    setConsent(submission.consentConfirmed ?? false);
    setSaved(false);
    setSubmitted(false);
    setFormError(null);
  }, [submission]);

  if (sessionQuery.isPending || mineQuery.isPending) {
    return (
      <div data-testid="submit-loading" className="min-w-0">
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
          // Description is always sent (even empty) so clearing the field
          // persists instead of silently keeping the previous value.
          description,
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
      notify.error(check.reason === 'type' ? 'error.fileTypeNotAllowed' : 'error.fileTooLarge');
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
    <div data-testid="submit-contribution" className="flex min-w-0 flex-col gap-6">
      <div className="flex min-w-0 flex-col gap-2">
        <Link
          href="/volunteer/tasks"
          className="inline-flex w-fit items-center gap-1.5 text-label-md font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={16} aria-hidden="true" className="shrink-0 rtl:rotate-180" />
          <span>{t('page.backToTasks')}</span>
        </Link>
        <h1 className="text-headline-lg font-semibold text-ink">{t('page.title')}</h1>
        <p className="text-body-md text-ink-muted">{t('page.subtitle')}</p>
      </div>

      {hasContext ? (
        <section
          data-testid="submit-context"
          aria-label={opportunityTitle ?? organizationName ?? roleName ?? t('page.title')}
          className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            {opportunityTitle ? (
              <p className="truncate text-title-md font-semibold text-ink">{opportunityTitle}</p>
            ) : null}
            {organizationName || roleName ? (
              <p className="mt-0.5 truncate text-label-md text-ink-muted">
                {[roleName, organizationName].filter((part): part is string => part !== null).join(' · ')}
              </p>
            ) : null}
            {dateText || locationText ? (
              <p className="mt-0.5 truncate text-label-md text-ink-muted">
                {[dateText, locationText].filter((part): part is string => part !== null).join(' · ')}
              </p>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col gap-1 border-t border-border-muted pt-2 sm:shrink-0 sm:border-t-0 sm:pt-0 sm:text-end">
            {scopeList.length > 0 ? (
              <>
                <span className="text-label-xs text-ink-muted">{t('context.scopeLabel')}</span>
                <span className="text-label-md font-medium text-ink">{scopeList.join(' · ')}</span>
              </>
            ) : null}
            {opportunityHref ? (
              <Link
                href={opportunityHref}
                className="mt-1 inline-flex items-center gap-1 text-label-md font-medium text-gold-strong hover:underline sm:justify-end"
              >
                <span>{t('context.viewDetails')}</span>
                <ArrowRight size={14} aria-hidden="true" className="shrink-0 rtl:rotate-180" />
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-6">
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
              <Card>
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
                      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink placeholder:text-ink-muted focus:border-gold-strong focus:outline-none"
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
                          <span className="flex min-w-0 items-center gap-2">
                            <EvidenceKindIcon kind={item.kind} />
                            <span className="truncate text-sm text-ink">{item.mediaId}</span>
                          </span>
                          {editable ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              data-testid="evidence-remove"
                              disabled={deleteMutation.isPending}
                              onClick={() => handleRemove(item.mediaId)}
                            >
                              <X size={14} aria-hidden="true" className="shrink-0" />
                              <span>{deleteMutation.isPending ? t('evidence.removing') : t('evidence.remove')}</span>
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
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface-muted/50 px-4 py-6 text-center transition-colors hover:border-gold-strong"
                        >
                          <CirclePlus size={24} aria-hidden="true" className="shrink-0 text-ink-muted" />
                          <span className="text-label-md font-semibold text-ink">{t('evidence.pickFile')}</span>
                        </button>
                      )}
                      {fileError ? <SectionError testId="file-error" message={fileError} /> : null}
                      <div className="flex flex-col gap-2 border-t border-border-muted pt-3">
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

              <p
                data-testid="privacy-note"
                className="flex items-start gap-2 text-body-sm leading-relaxed text-ink-muted"
              >
                <Lock size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span>{t('privacy.body')}</span>
              </p>

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
                    <div className="flex flex-wrap items-center gap-3 border-t border-border-muted pt-3">
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
                      <Link
                        href="/volunteer/tasks"
                        className="text-sm font-medium text-ink-muted transition-colors hover:text-ink"
                      >
                        {t('shared.cancel')}
                      </Link>
                    </div>
                    {formError ? <SectionError testId="submit-error" message={formError} /> : null}
                  </div>
                </Card>
              ) : null}
              {!editable && formError ? <SectionError testId="submit-error" message={formError} /> : null}
            </>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24">
          {hasContext ? (
            <section
              aria-label={t('rail.opportunity')}
              data-testid="submit-opportunity"
              className="rounded-lg border border-border bg-surface p-4 shadow-sm"
            >
              <h2 className="text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
                {t('rail.opportunity')}
              </h2>
              {coverUrl ? (
                // Opportunity cover renders only when the detail endpoint
                // carries a real coverMediaId that resolves to a signed URL.
                // eslint-disable-next-line @next/next/no-img-element -- session-resolved media URL, omitted when absent
                <img
                  src={coverUrl}
                  alt=""
                  loading="lazy"
                  className="mt-3 aspect-video w-full rounded-md border border-border-muted bg-surface-muted object-cover"
                />
              ) : null}
              <div className="mt-3 flex min-w-0 flex-col gap-0.5">
                {opportunityTitle ? (
                  <p className="truncate text-title-sm font-semibold text-ink">{opportunityTitle}</p>
                ) : null}
                {organizationName ? (
                  <p className="truncate text-label-md text-ink-muted">{organizationName}</p>
                ) : null}
                {roleName ? (
                  <p className="truncate text-label-md text-ink-muted">{roleName}</p>
                ) : null}
                {dateText ? (
                  <p className="truncate text-label-md text-ink-muted">{dateText}</p>
                ) : null}
              </div>
              {opportunityHref ? (
                <Link
                  href={opportunityHref}
                  className="mt-2 inline-flex items-center gap-1 text-label-md font-medium text-gold-strong hover:underline"
                >
                  <span>{t('context.viewDetails')}</span>
                  <ArrowRight size={14} aria-hidden="true" className="shrink-0 rtl:rotate-180" />
                </Link>
              ) : null}
            </section>
          ) : null}

          {status ? <LifecycleRail status={status} /> : null}

          {scopeList.length > 0 ? (
            <section
              aria-label={t('rail.expected')}
              data-testid="submit-expected"
              className="rounded-lg border border-border bg-surface p-4 shadow-sm"
            >
              <h2 className="text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
                {t('rail.expected')}
              </h2>
              <ul className="mt-3 flex flex-col gap-2.5">
                {scopeList.map((entry, index) => (
                  <li key={`${entry}-${index}`} className="flex items-start gap-2.5 text-label-md text-ink">
                    <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-muted" />
                    <span className="min-w-0">{entry}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {organizationName && contactEmail ? (
            <section
              aria-label={t('rail.contact')}
              data-testid="submit-contact"
              className="rounded-lg border border-border bg-surface p-4 shadow-sm"
            >
              <h2 className="text-label-xs font-semibold uppercase tracking-wider text-ink-muted">
                {t('rail.contact')}
              </h2>
              <p className="mt-2 truncate text-title-sm font-semibold text-ink">{organizationName}</p>
              <a
                href={`mailto:${contactEmail}`}
                className="mt-1 inline-flex items-center gap-1.5 text-label-md font-medium text-gold-strong hover:underline"
              >
                <Mail size={14} aria-hidden="true" className="shrink-0" />
                <span>{t('rail.emailCta')}</span>
              </a>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
