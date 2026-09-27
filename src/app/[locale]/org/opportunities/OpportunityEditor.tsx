'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Select } from '@/components/ui/Select';
import { ForbiddenScreen } from '@/components/system/ForbiddenScreen';
import { NotFoundScreen } from '@/components/system/NotFoundScreen';
import { ServerErrorScreen } from '@/components/system/ServerErrorScreen';
import { SessionExpiredScreen } from '@/components/system/SessionExpiredScreen';
import { errorStateFor, mapToApiError } from '@/lib/api/errors';
import {
  FIELDS_LOCKED_AFTER_PUBLISH,
  lifecycleAvailability,
  opportunityIdOf,
  opportunityStatusOf,
  positionIdOf,
  positionInputIssues,
  skillCategoryIdOf,
  skillCategoryLabelOf,
  validateCoverFile,
  type CreatePositionInput,
  type LifecycleAction,
  type OwnerOpportunity,
  type OwnerPosition,
  type PublishGateStatus,
  type UpdatePositionInput,
} from '@/lib/api/orgOpps';
import {
  isFieldLockedError,
  isOrgNotVerifiedError,
  isPublishGateLockedError,
  isPublishingDisabledError,
  useCreateOpportunityMutation,
  useCreatePositionMutation,
  useDeletePositionMutation,
  useLifecycleActionMutation,
  useOppMunicipalitiesQuery,
  useOppSkillCategoriesQuery,
  useOppWilayasQuery,
  useOwnOpportunityQuery,
  useOwnOrgGateQuery,
  usePatchOpportunityMutation,
  usePatchPositionMutation,
  usePublishGateQuery,
  useUploadOpportunityCover,
} from '@/hooks/useOrgOpps';
import { OppSectionError, OppStatusPill, RequireOrgOpps } from './OrgOpportunitiesPage';

// F10-owned shared editor for org/opportunities/new + org/opportunities/[id].
// Full v2 field set only — no perks/logistics inputs (FCD CUT), no
// opportunity-PDF button (no backend endpoint), no applications UI (F11).

interface EditorForm {
  title: string;
  description: string;
  categoryId: string;
  mode: string;
  startDate: string;
  endDate: string;
  durationMinutes: string;
  prerequisites: string;
  applicationDeadline: string;
  wilayaId: string;
  municipalityId: string;
  address: string;
}

const EMPTY_FORM: EditorForm = {
  title: '',
  description: '',
  categoryId: '',
  mode: '',
  startDate: '',
  endDate: '',
  durationMinutes: '',
  prerequisites: '',
  applicationDeadline: '',
  wilayaId: '',
  municipalityId: '',
  address: '',
};

function isoDay(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function linesOf(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

function formFromOpp(opp: OwnerOpportunity): EditorForm {
  return {
    title: opp.title ?? '',
    description: opp.description ?? '',
    categoryId: opp.categoryId ?? '',
    mode: opp.mode ?? '',
    startDate: isoDay(opp.startDate),
    endDate: isoDay(opp.endDate),
    durationMinutes: opp.durationMinutes === null || opp.durationMinutes === undefined ? '' : String(opp.durationMinutes),
    prerequisites: (opp.prerequisites ?? []).join('\n'),
    applicationDeadline: isoDay(opp.applicationDeadline),
    wilayaId: opp.location?.wilayaId ?? '',
    municipalityId: opp.location?.municipalityId ?? '',
    address: opp.location?.address ?? '',
  };
}

function LifecycleBar({
  opportunityId,
  status,
  verificationStatus,
  gate,
  onDone,
}: {
  opportunityId: string;
  status: string;
  verificationStatus: string | undefined;
  gate: PublishGateStatus | undefined;
  onDone: (message: string) => void;
}) {
  const t = useTranslations('orgOpportunities');
  const availability = lifecycleAvailability(status, verificationStatus, gate?.locked);
  const lifecycleMutation = useLifecycleActionMutation();
  const [pendingAction, setPendingAction] = useState<LifecycleAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const ACTION_COPY: Record<LifecycleAction, { title: string; description: string; done: string }> = {
    publish: {
      title: t('editor.confirmPublishTitle'),
      description: t('editor.confirmPublishDescription'),
      done: t('editor.published'),
    },
    close: {
      title: t('editor.confirmCloseTitle'),
      description: t('editor.confirmCloseDescription'),
      done: t('editor.closed'),
    },
    cancel: {
      title: t('editor.confirmCancelTitle'),
      description: t('editor.confirmCancelDescription'),
      done: t('editor.cancelled'),
    },
    complete: {
      title: t('editor.confirmCompleteTitle'),
      description: t('editor.confirmCompleteDescription'),
      done: t('editor.completed'),
    },
  };

  const run = async (action: LifecycleAction) => {
    setActionError(null);
    try {
      await lifecycleMutation.mutateAsync({ opportunityId, action });
      setPendingAction(null);
      onDone(ACTION_COPY[action].done);
    } catch (err) {
      if (isOrgNotVerifiedError(err)) setActionError(t('editor.notVerifiedError'));
      else if (isPublishGateLockedError(err)) setActionError(t('editor.gateLockedError'));
      else if (isPublishingDisabledError(err)) setActionError(t('editor.publishingDisabledError'));
      else setActionError(t('editor.genericError'));
      setPendingAction(null);
    }
  };

  const buttons: { action: LifecycleAction; label: string }[] = [];
  if (availability.canPublish) buttons.push({ action: 'publish', label: t('editor.publish') });
  if (availability.canClose) buttons.push({ action: 'close', label: t('editor.close') });
  if (availability.canCancel) buttons.push({ action: 'cancel', label: t('editor.cancel') });
  if (availability.canComplete) buttons.push({ action: 'complete', label: t('editor.complete') });

  return (
    <Card title={status}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {buttons.length === 0 ? (
            <span data-testid="lifecycle-none" className="text-sm text-ink-muted">
              {availability.publishLockedReason === 'unverified'
                ? t('editor.notVerifiedError')
                : availability.publishLockedReason === 'gate-locked'
                  ? t('editor.gateLockedError')
                  : ''}
            </span>
          ) : (
            buttons.map(({ action, label }) => (
              <Button
                key={action}
                type="button"
                variant={action === 'publish' ? 'primary' : 'secondary'}
                size="sm"
                data-testid={`lifecycle-${action}`}
                disabled={lifecycleMutation.isPending}
                onClick={() => setPendingAction(action)}
              >
                {lifecycleMutation.isPending ? t('editor.publishing') : label}
              </Button>
            ))
          )}
        </div>
        {availability.publishLockedReason === 'unverified' && status === 'draft' ? (
          <p data-testid="publish-locked-unverified" className="text-sm text-status-pending">
            {t('editor.notVerifiedError')}
          </p>
        ) : null}
        {availability.publishLockedReason === 'gate-locked' && status === 'draft' ? (
          <p data-testid="publish-locked-gate" className="text-sm text-status-pending">
            {t('editor.gateLockedError')}
          </p>
        ) : null}
        {pendingAction ? (
          <div data-testid="lifecycle-confirm" className="flex flex-col gap-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium text-ink">{ACTION_COPY[pendingAction].title}</p>
            <p className="text-sm text-ink-muted">{ACTION_COPY[pendingAction].description}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                data-testid="lifecycle-confirm-confirm"
                disabled={lifecycleMutation.isPending}
                onClick={() => run(pendingAction)}
              >
                {t('editor.confirmAction')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPendingAction(null)}
              >
                {t('editor.cancelAction')}
              </Button>
            </div>
          </div>
        ) : null}
        {actionError ? (
          <p data-testid="lifecycle-error" role="alert" className="text-sm text-status-error">
            {actionError}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function PositionsEditor({
  opportunityId,
  positions,
  local,
  onLocalChange,
}: {
  opportunityId: string | null;
  positions: OwnerPosition[];
  local: CreatePositionInput[];
  onLocalChange: (next: CreatePositionInput[]) => void;
}) {
  const t = useTranslations('orgOpportunities');
  const createPositionMutation = useCreatePositionMutation();
  const patchPositionMutation = usePatchPositionMutation();
  const deletePositionMutation = useDeletePositionMutation();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', requiredCount: '1', deliverables: '', startAt: '' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const resetDraft = () => {
    setDraft({ title: '', requiredCount: '1', deliverables: '', startAt: '' });
    setAdding(false);
    setEditingId(null);
    setError(null);
  };

  const readDraft = (): { input: CreatePositionInput; issues: string[] } => {
    const requiredCount = Number.parseInt(draft.requiredCount, 10);
    const input: CreatePositionInput = {
      title: draft.title.trim(),
      requiredCount: Number.isNaN(requiredCount) ? 0 : requiredCount,
    };
    const deliverables = linesOf(draft.deliverables);
    if (deliverables.length > 0) input.deliverables = deliverables;
    if (draft.startAt !== '') input.startAt = draft.startAt;
    return { input, issues: positionInputIssues({ title: input.title, requiredCount: input.requiredCount }) };
  };

  const saveServer = async () => {
    if (!opportunityId) return;
    const { input, issues } = readDraft();
    if (issues.length > 0) {
      setError(t('editor.requiredError'));
      return;
    }
    try {
      if (editingId) {
        const update: UpdatePositionInput = {
          title: input.title,
          requiredCount: input.requiredCount,
        };
        if (input.deliverables) update.deliverables = input.deliverables;
        if (input.startAt) update.startAt = input.startAt;
        await patchPositionMutation.mutateAsync({ opportunityId, positionId: editingId, input: update });
      } else {
        await createPositionMutation.mutateAsync({ opportunityId, input });
      }
      resetDraft();
    } catch {
      setError(t('editor.genericError'));
    }
  };

  const saveLocal = () => {
    const { input, issues } = readDraft();
    if (issues.length > 0) {
      setError(t('editor.requiredError'));
      return;
    }
    if (editingId) {
      onLocalChange(
        local.map((p, i) => (String(i) === editingId ? input : p)),
      );
    } else {
      onLocalChange([...local, input]);
    }
    resetDraft();
  };

  const startEdit = (id: string, source: { title?: string; requiredCount?: number; deliverables?: string[] | null; startAt?: string | null }) => {
    setDraft({
      title: source.title ?? '',
      requiredCount: String(source.requiredCount ?? 1),
      deliverables: (source.deliverables ?? []).join('\n'),
      startAt: isoDay(source.startAt),
    });
    setEditingId(id);
    setAdding(true);
    setError(null);
  };

  const rows: { key: string; title: string; requiredCount?: number; filledCount?: number; deliverables: string[] }[] =
    opportunityId
      ? positions.map((p) => ({
          key: positionIdOf(p),
          title: p.title ?? '',
          requiredCount: p.requiredCount,
          filledCount: p.filledCount ?? undefined,
          deliverables: p.deliverables ?? [],
        }))
      : local.map((p, i) => ({
          key: String(i),
          title: p.title,
          requiredCount: p.requiredCount,
          filledCount: undefined,
          deliverables: p.deliverables ?? [],
        }));

  return (
    <Card title={t('editor.positionsTitle')}>
      <div className="flex flex-col gap-3" data-testid="positions-editor">
        {rows.length === 0 && !adding ? (
          <p data-testid="positions-empty" className="text-sm text-ink-muted">
            {t('editor.positionEmpty')}
          </p>
        ) : null}
        {notice ? (
          <p data-testid="position-notice" role="status" className="text-sm text-ink">
            {notice}
          </p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.key}
              data-testid="position-row"
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
            >
              <div>
                <p className="text-sm font-medium text-ink">{row.title}</p>
                <p className="text-xs text-ink-muted">
                  {t('editor.positionSeatsLabel')}: {row.requiredCount ?? '–'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid={`position-edit-${row.key}`}
                  onClick={() =>
                    startEdit(row.key, {
                      title: row.title,
                      requiredCount: row.requiredCount,
                      deliverables: row.deliverables,
                    })
                  }
                >
                  {t('editor.positionEdit')}
                </Button>
                {opportunityId ? (
                  removingId === row.key ? (
                    <span className="flex gap-2">
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        data-testid={`position-remove-confirm-${row.key}`}
                        onClick={async () => {
                          try {
                            await deletePositionMutation.mutateAsync({
                              opportunityId,
                              positionId: row.key,
                            });
                            setRemovingId(null);
                            setNotice(t('editor.positionRemoved'));
                          } catch {
                            setError(t('editor.genericError'));
                          }
                        }}
                      >
                        {t('editor.confirmAction')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemovingId(null)}
                      >
                        {t('editor.cancelAction')}
                      </Button>
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      data-testid={`position-remove-${row.key}`}
                      onClick={() => setRemovingId(row.key)}
                    >
                      {t('editor.positionRemove')}
                    </Button>
                  )
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-testid={`position-remove-${row.key}`}
                    onClick={() => onLocalChange(local.filter((_, i) => String(i) !== row.key))}
                  >
                    {t('editor.positionRemove')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {adding ? (
          <div data-testid="position-form" className="flex flex-col gap-3 rounded-md border border-border p-3">
            <Input
              id="position-title"
              label={t('editor.positionTitleLabel')}
              value={draft.title}
              onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
            />
            <Input
              id="position-seats"
              label={t('editor.positionSeatsLabel')}
              type="number"
              min={1}
              value={draft.requiredCount}
              onChange={(event) => setDraft((d) => ({ ...d, requiredCount: event.target.value }))}
            />
            <div>
              <label htmlFor="position-deliverables" className="mb-1 block text-sm font-medium text-ink">
                {t('editor.positionDeliverablesLabel')}
              </label>
              <textarea
                id="position-deliverables"
                rows={3}
                placeholder={t('editor.positionDeliverablesHint')}
                value={draft.deliverables}
                onChange={(event) => setDraft((d) => ({ ...d, deliverables: event.target.value }))}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink focus:border-primary focus:outline-none"
              />
            </div>
            <Input
              id="position-start"
              label={t('editor.positionStartLabel')}
              type="date"
              value={draft.startAt}
              onChange={(event) => setDraft((d) => ({ ...d, startAt: event.target.value }))}
            />
            {error ? <OppSectionError message={error} testId="position-error" /> : null}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                data-testid="position-save"
                onClick={opportunityId ? saveServer : saveLocal}
              >
                {t('editor.positionSave')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={resetDraft}>
                {t('editor.positionCancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="position-add"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
              setError(null);
            }}
          >
            {t('editor.positionAdd')}
          </Button>
        )}
      </div>
    </Card>
  );
}

export function OpportunityEditor({
  locale,
  opportunityId,
}: {
  locale: string;
  opportunityId?: string;
}) {
  const t = useTranslations('orgOpportunities');
  const router = useRouter();
  const uploadCover = useUploadOpportunityCover();
  const createMutation = useCreateOpportunityMutation();
  const patchMutation = usePatchOpportunityMutation();

  const existingQuery = useOwnOpportunityQuery(opportunityId);
  const gateQuery = usePublishGateQuery();
  const orgGateQuery = useOwnOrgGateQuery();
  const categoriesQuery = useOppSkillCategoriesQuery();
  const wilayasQuery = useOppWilayasQuery();

  const [form, setForm] = useState<EditorForm>(EMPTY_FORM);
  const [hydrated, setHydrated] = useState(!opportunityId);
  const [coverMediaId, setCoverMediaId] = useState<string | null>(null);
  const [coverProgress, setCoverProgress] = useState<number | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof EditorForm, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [lifecycleNotice, setLifecycleNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [localPositions, setLocalPositions] = useState<CreatePositionInput[]>([]);

  const existing = existingQuery.data;
  const isEdit = opportunityId !== undefined;

  useEffect(() => {
    if (existing && !hydrated) {
      setForm(formFromOpp(existing));
      setCoverMediaId(existing.coverMediaId ?? null);
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, hydrated]);

  const municipalitiesQuery = useOppMunicipalitiesQuery(form.wilayaId || undefined);

  const status = existing ? opportunityStatusOf(existing) : 'draft';
  const published = status === 'published';
  const lockedFields = useMemo(
    () => (published ? new Set<string>(FIELDS_LOCKED_AFTER_PUBLISH) : new Set<string>()),
    [published],
  );

  if (isEdit && existingQuery.isPending) {
    return (
      <Card>
        <div data-testid="opp-editor-loading">
          <Loader label={t('editor.loading')} />
        </div>
      </Card>
    );
  }

  if (isEdit && existingQuery.isError) {
    const state = errorStateFor(mapToApiError(existingQuery.error));
    if (state === 'session-expired') return <SessionExpiredScreen />;
    if (state === 'forbidden') return <ForbiddenScreen />;
    if (state === 'not-found') return <NotFoundScreen />;
    return <ServerErrorScreen />;
  }

  if (!hydrated) return null;

  const set = (key: keyof EditorForm) => (value: string) => {
    setForm((prev) => (key === 'wilayaId' ? { ...prev, [key]: value, municipalityId: '' } : { ...prev, [key]: value }));
    setSaved(false);
  };

  function validate(): boolean {
    const errors: Partial<Record<keyof EditorForm, string>> = {};
    if (form.title.trim() === '') errors.title = t('editor.requiredError');
    if (form.description.trim() === '') errors.description = t('editor.requiredError');
    if (form.durationMinutes !== '') {
      const minutes = Number.parseInt(form.durationMinutes, 10);
      if (!Number.isInteger(minutes) || minutes < 1) errors.durationMinutes = t('editor.invalidDurationError');
    }
    for (const key of ['startDate', 'endDate', 'applicationDeadline'] as const) {
      if (form[key] !== '' && Number.isNaN(Date.parse(form[key]))) errors[key] = t('editor.invalidDateError');
    }
    if (form.startDate !== '' && form.endDate !== '' && form.endDate < form.startDate) {
      errors.endDate = t('editor.endBeforeStartError');
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function onCoverFile(file: File | undefined) {
    if (!file) return;
    const check = validateCoverFile({ name: file.name, type: file.type, size: file.size });
    if (!check.ok) {
      setCoverError(check.reason === 'type' ? t('editor.coverTypeError') : t('editor.coverSizeError'));
      return;
    }
    setCoverError(null);
    setCoverProgress(0);
    try {
      const mediaId = await uploadCover(
        { name: file.name, type: file.type, size: file.size, blob: file },
        { onProgress: (p) => setCoverProgress(p.percent) },
      );
      setCoverMediaId(mediaId);
      setCoverProgress(null);
    } catch {
      setCoverError(t('editor.genericError'));
      setCoverProgress(null);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate() || coverProgress !== null) return;
    setFormError(null);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      ...(form.categoryId !== '' ? { categoryId: form.categoryId } : {}),
      ...(form.mode !== '' ? { mode: form.mode as 'onsite' | 'remote' | 'hybrid' } : {}),
      ...(form.startDate !== '' ? { startDate: form.startDate } : {}),
      ...(form.endDate !== '' ? { endDate: form.endDate } : {}),
      ...(form.durationMinutes !== '' ? { durationMinutes: Number.parseInt(form.durationMinutes, 10) } : {}),
      ...(coverMediaId ? { coverMediaId } : {}),
      ...(linesOf(form.prerequisites).length > 0 ? { prerequisites: linesOf(form.prerequisites) } : {}),
      ...(form.applicationDeadline !== '' ? { applicationDeadline: form.applicationDeadline } : {}),
      ...(form.wilayaId !== '' || form.municipalityId !== '' || form.address.trim() !== ''
        ? {
            location: {
              ...(form.wilayaId !== '' ? { wilayaId: form.wilayaId } : {}),
              ...(form.municipalityId !== '' ? { municipalityId: form.municipalityId } : {}),
              ...(form.address.trim() !== '' ? { address: form.address.trim() } : {}),
            },
          }
        : {}),
    };
    try {
      if (isEdit && opportunityId) {
        await patchMutation.mutateAsync({ opportunityId, input: payload });
        setSaved(true);
      } else {
        const created = await createMutation.mutateAsync({
          ...payload,
          ...(localPositions.length > 0 ? { positions: localPositions } : {}),
        });
        const createdId = opportunityIdOf(created);
        // NOTE: next-intl useRouter prefixes the active locale itself — passing
        // a locale-prefixed path here would double it (/{locale}/{locale}/…).
        if (createdId) router.push(`/org/opportunities/${createdId}`);
      }
    } catch (err) {
      if (isFieldLockedError(err)) setFormError(t('editor.fieldLockedError'));
      else setFormError(t('editor.genericError'));
    }
  }

  const pending = createMutation.isPending || patchMutation.isPending;
  const lockedHint = (field: string) =>
    lockedFields.has(field) ? (
      <p data-testid={`locked-hint-${field}`} className="mt-1 text-xs text-ink-muted">
        {t('editor.lockedFieldHint')}
      </p>
    ) : null;

  return (
    <div data-testid="opp-editor" className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">
          {isEdit ? t('editor.editTitle') : t('editor.newTitle')}
        </h1>
        {isEdit && existing ? <OppStatusPill status={status} /> : null}
      </div>
      {!isEdit ? <p className="text-sm text-ink-muted">{t('editor.newSubtitle')}</p> : null}

      {isEdit && opportunityId ? (
        <LifecycleBar
          opportunityId={opportunityId}
          status={status}
          verificationStatus={orgGateQuery.data?.verificationStatus}
          gate={gateQuery.data}
          onDone={(message) => {
            setLifecycleNotice(message);
            setFormError(null);
          }}
        />
      ) : null}
      {lifecycleNotice ? (
        <p data-testid="lifecycle-success" role="status" className="text-sm text-ink">
          {lifecycleNotice}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <Card>
          <div className="flex flex-col gap-4">
            <Input
              id="opp-title"
              label={t('editor.titleLabel')}
              value={form.title}
              error={fieldErrors.title}
              onChange={(event) => set('title')(event.target.value)}
            />
            <div>
              <label htmlFor="opp-description" className="mb-1 block text-sm font-medium text-ink">
                {t('editor.descriptionLabel')}
              </label>
              <textarea
                id="opp-description"
                rows={5}
                value={form.description}
                onChange={(event) => set('description')(event.target.value)}
                aria-invalid={fieldErrors.description ? true : undefined}
                className={`w-full rounded-md border bg-surface px-3 py-2 text-ink focus:outline-none ${fieldErrors.description ? 'border-status-error' : 'border-border focus:border-primary'}`}
              />
              {fieldErrors.description ? (
                <p className="mt-1 text-sm text-status-error">{fieldErrors.description}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                id="opp-category"
                label={t('editor.categoryLabel')}
                value={form.categoryId}
                onChange={(event) => set('categoryId')(event.target.value)}
                options={[
                  { value: '', label: t('editor.categoryPlaceholder') },
                  ...(categoriesQuery.data ?? []).map((c) => ({
                    value: skillCategoryIdOf(c),
                    label: skillCategoryLabelOf(c, locale),
                  })),
                ]}
              />
              <div>
                <Select
                  id="opp-mode"
                  label={t('editor.modeLabel')}
                  value={form.mode}
                  disabled={lockedFields.has('mode')}
                  onChange={(event) => set('mode')(event.target.value)}
                  options={[
                    { value: '', label: t('editor.selectPlaceholder') },
                    { value: 'onsite', label: t('editor.modeOnsite') },
                    { value: 'remote', label: t('editor.modeRemote') },
                    { value: 'hybrid', label: t('editor.modeHybrid') },
                  ]}
                />
                {lockedHint('mode')}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Input
                id="opp-start"
                label={t('editor.startDateLabel')}
                type="date"
                value={form.startDate}
                error={fieldErrors.startDate}
                onChange={(event) => set('startDate')(event.target.value)}
              />
              <div>
                <Input
                  id="opp-end"
                  label={t('editor.endDateLabel')}
                  type="date"
                  value={form.endDate}
                  error={fieldErrors.endDate}
                  disabled={lockedFields.has('endDate')}
                  onChange={(event) => set('endDate')(event.target.value)}
                />
                {lockedHint('endDate')}
              </div>
              <div>
                <Input
                  id="opp-duration"
                  label={t('editor.durationLabel')}
                  type="number"
                  min={1}
                  value={form.durationMinutes}
                  error={fieldErrors.durationMinutes}
                  disabled={lockedFields.has('durationMinutes')}
                  onChange={(event) => set('durationMinutes')(event.target.value)}
                />
                {lockedHint('durationMinutes')}
              </div>
            </div>
            <div>
              <label htmlFor="opp-prerequisites" className="mb-1 block text-sm font-medium text-ink">
                {t('editor.prerequisitesLabel')}
              </label>
              <textarea
                id="opp-prerequisites"
                rows={3}
                placeholder={t('editor.prerequisitesHint')}
                value={form.prerequisites}
                disabled={lockedFields.has('prerequisites')}
                onChange={(event) => set('prerequisites')(event.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink focus:border-primary focus:outline-none disabled:opacity-50"
              />
              {lockedHint('prerequisites')}
            </div>
            <Input
              id="opp-deadline"
              label={t('editor.deadlineLabel')}
              type="date"
              value={form.applicationDeadline}
              error={fieldErrors.applicationDeadline}
              onChange={(event) => set('applicationDeadline')(event.target.value)}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Select
                id="opp-wilaya"
                label={t('editor.wilayaLabel')}
                value={form.wilayaId}
                onChange={(event) => set('wilayaId')(event.target.value)}
                options={[
                  { value: '', label: t('editor.selectPlaceholder') },
                  ...(wilayasQuery.data ?? []).map((w) => ({
                    value: w.code,
                    label: locale === 'ar' ? w.nameAr : w.nameFr,
                  })),
                ]}
              />
              <Select
                id="opp-municipality"
                label={t('editor.municipalityLabel')}
                value={form.municipalityId}
                onChange={(event) => set('municipalityId')(event.target.value)}
                options={[
                  { value: '', label: t('editor.selectPlaceholder') },
                  ...(municipalitiesQuery.data ?? []).map((m) => ({
                    value: m.code,
                    label: locale === 'ar' ? m.nameAr : m.nameFr,
                  })),
                ]}
              />
              <Input
                id="opp-address"
                label={t('editor.addressLabel')}
                value={form.address}
                onChange={(event) => set('address')(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="opp-cover" className="mb-1 block text-sm font-medium text-ink">
                {t('editor.coverLabel')}
              </label>
              <input
                id="opp-cover"
                data-testid="field-cover"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => onCoverFile(event.target.files?.[0])}
                className="w-full text-sm text-ink"
              />
              <p className="mt-1 text-sm text-ink-muted">{t('editor.coverHint')}</p>
              {coverProgress !== null ? (
                <p data-testid="cover-progress" className="mt-1 text-sm text-ink-muted">
                  {t('editor.coverUploading')} {coverProgress}%
                </p>
              ) : null}
              {coverMediaId ? (
                <p data-testid="cover-success" className="mt-1 text-sm text-ink">
                  {coverMediaId}
                </p>
              ) : null}
              {coverError ? <OppSectionError message={coverError} testId="cover-error" /> : null}
            </div>
          </div>
        </Card>

        <PositionsEditor
          opportunityId={isEdit && opportunityId ? opportunityId : null}
          positions={existing?.positions ?? []}
          local={localPositions}
          onLocalChange={setLocalPositions}
        />

        {formError ? <OppSectionError message={formError} testId="editor-error" /> : null}
        {saved ? (
          <p data-testid="editor-success" role="status" className="text-sm text-ink">
            {t('editor.saved')}
          </p>
        ) : null}
        <div>
          <Button type="submit" data-testid="editor-submit" disabled={pending || coverProgress !== null}>
            {isEdit ? (pending ? t('editor.saving') : t('editor.save')) : pending ? t('editor.creating') : t('editor.create')}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function NewOpportunityScreen({ locale }: { locale: string }) {
  return (
    <RequireOrgOpps locale={locale} next={`/${locale}/org/opportunities/new`}>
      <OpportunityEditor locale={locale} />
    </RequireOrgOpps>
  );
}

export function EditOpportunityScreen({ locale, opportunityId }: { locale: string; opportunityId: string }) {
  return (
    <RequireOrgOpps locale={locale} next={`/${locale}/org/opportunities/${opportunityId}`}>
      <OpportunityEditor locale={locale} opportunityId={opportunityId} />
    </RequireOrgOpps>
  );
}
