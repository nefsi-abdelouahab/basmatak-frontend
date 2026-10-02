'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Camera,
  Circle,
  CircleCheck,
  ExternalLink,
  Eye,
  ImagePlus,
  Info,
  Send,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
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
import { accountMediaUrlOf } from '@/lib/api/orgAccount';
import type { OpportunityCard as OpportunityCardData } from '@/lib/api/feed';
import {
  FIELDS_LOCKED_AFTER_PUBLISH,
  lifecycleAvailability,
  opportunityIdOf,
  opportunityStatusOf,
  positionIdOf,
  positionInputIssues,
  skillCategoryIdOf,
  skillCategoryLabelOf,
  skillIdOf,
  skillIdsOfSkills,
  skillLabelOf,
  validateCoverFile,
  type CreatePositionInput,
  type LifecycleAction,
  type OwnerOpportunity,
  type OwnerPosition,
  type PublishGateStatus,
  type SkillOption,
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
  useOppSkillsQuery,
  useOppWilayasQuery,
  useOwnOpportunityQuery,
  useOwnOrgGateQuery,
  usePatchOpportunityMutation,
  usePatchPositionMutation,
  usePublishGateQuery,
  useUploadOpportunityCover,
} from '@/hooks/useOrgOpps';
import { useAccountMediaQuery } from '@/hooks/useOrgAccount';
import { useMyOrganizationQuery } from '@/hooks/useOrgStats';
import { OpportunityCard } from '@/app/[locale]/volunteer/opportunities/OpportunityCard';
import { OppSectionError, OppStatusPill, RequireOrgOpps } from './OrgOpportunitiesPage';

// Create Opportunity rebuild from
// `design/Basmatak Tatatoua - Create Opportunity/` (code.html + screen.png):
// back link + title + subtitle with top Save draft / Publish actions, center
// form (cover photo, basic info, when/where, volunteer positions,
// requirements), right sticky rail (live feed-card preview + publishing
// checklist + neutral publishing note), bottom action bar.
//
// Field audit vs the real backend (CreateOpportunityDto / CreatePositionDto in
// backend/src/opportunities/dto/opportunity.dto.ts, MEDIA_PURPOSES +
// AppValidationPipe whitelist+forbidNonWhitelisted):
// - REAL, wired as-is: title (<=200), description (<=200, plain text),
//   categoryId (ObjectId from GET /skill-categories — never hardcoded),
//   startDate/endDate (ISO, endDate >= startDate, locked post-publish),
//   durationMinutes (int >= 1, locked post-publish), mode
//   (onsite|remote|hybrid, locked post-publish), applicationDeadline (ISO,
//   apply rejected 410 once the date passes), coverMediaId (2-step upload,
//   purpose opportunity_cover, jpeg/png/webp <= 5 MB), prerequisites[]
//   (<=20 x <=500, one-per-line), positions[].title/requiredCount (required),
//   positions[].description (<=2000), positions[].requiredSkills (ObjectIds
//   from GET /skills), positions[].deliverables[] (<=20 x <=500, one-per-line),
//   positions[].startAt (ISO, optional).
// - REAL but adjusted: the free-text Location input has no backing field
//   (LocationDto only accepts wilayaId/municipalityId/coordinates, and the
//   global pipe rejects anything else — the previous address input could 400
//   the whole save, so it is deleted and the real wilaya/municipality picker
//   is the location control); the on-site checkbox is a lossy subset of the
//   real mode enum, so a real 3-way mode selector replaces it; the
//   ratio/dimension cover hint is invented (the API constrains mime+size
//   only), so the hint states the real constraints; the markdown-support note
//   is deleted (no markdown anywhere in backend or frontend); the exact-time
//   auto-close precision is invented (the deadline closes applications once
//   the date passes, day granularity), so the note says exactly that.
// - REAL frontend-only: the publishing checklist (client validation over live
//   form state) and the feed-card preview (live form data rendered through
//   the REAL OpportunityCard with interactive={false} — no separate
//   hardcoded preview markup; the unpublished draft has no id to
//   favorite/share/open, so the card's action footer is omitted, not faked).
// - DELETED, never rephrased: the sidebar verification note, the whole
//   civic-commitment card (no backing feature), and every remaining
//   forbidden-copy string. The rail keeps one neutral publishing note backed
//   by real lifecycle truth (drafts are org-visible only; publishing makes
//   the row visible to volunteers).
// - NOT built: perks/logistics inputs (FCD CUT — no such paths exist).
//
// Layout: single scrolling document with a sticky right rail
// (lg:grid-cols-[minmax(0,1fr)_300px] + lg:sticky lg:top-24) — the Submit
// Contribution pattern, deliberately NOT the independent-scroll-per-column
// grid from Opportunities/Participations: trapping a long creation form with
// a file picker and inline validation inside an inner scroll container
// breaks focus order, keyboard flow, and mobile behavior. The left org
// sidebar is untouched (Shell owns it); this file adds no ad-hoc page
// padding (Container gutters come from the Shell).

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
    description: (opp.description as string | null) ?? '',
    categoryId: opp.categoryId ?? '',
    mode: opp.mode ?? '',
    startDate: isoDay(opp.startDate),
    endDate: isoDay(opp.endDate),
    durationMinutes:
      opp.durationMinutes === null || opp.durationMinutes === undefined
        ? ''
        : String(opp.durationMinutes),
    prerequisites: (opp.prerequisites ?? []).join('\n'),
    applicationDeadline: isoDay(opp.applicationDeadline),
    wilayaId: opp.location?.wilayaId ?? '',
    municipalityId: opp.location?.municipalityId ?? '',
  };
}

function validDay(value: string): boolean {
  return value !== '' && !Number.isNaN(Date.parse(value));
}

function labelOf(
  rows: { code?: string; nameFr?: string; nameAr?: string }[] | undefined,
  code: string,
): { nameFr: string; nameAr: string } | null {
  const row = (rows ?? []).find((r) => r.code === code);
  if (!row) return null;
  return { nameFr: row.nameFr ?? '', nameAr: row.nameAr ?? '' };
}

function skillNameOf(skills: SkillOption[] | undefined, id: string): { nameFr: string; nameAr: string } {
  const row = (skills ?? []).find((s) => skillIdOf(s) === id);
  if (!row) return { nameFr: '', nameAr: '' };
  const label = skillLabelOf(row, 'fr');
  const labelAr = skillLabelOf(row, 'ar');
  return { nameFr: label, nameAr: labelAr };
}

function LifecycleBar({
  opportunityId,
  status,
  verificationStatus,
  gate,
  only,
  onDone,
}: {
  opportunityId: string;
  status: string;
  verificationStatus: string | undefined;
  gate: PublishGateStatus | undefined;
  only?: LifecycleAction[];
  onDone: (message: string) => void;
}) {
  const t = useTranslations('orgOpportunities');
  const availability = lifecycleAvailability(status, verificationStatus, gate?.locked);
  const lifecycleMutation = useLifecycleActionMutation();
  const [pendingAction, setPendingAction] = useState<LifecycleAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const ACTION_COPY: Record<LifecycleAction, { title: string; description: string; done: string }> = {
    publish: {
      title: t('create.confirmPublishTitle'),
      description: t('create.confirmPublishDescription'),
      done: t('create.published'),
    },
    close: {
      title: t('create.confirmCloseTitle'),
      description: t('create.confirmCloseDescription'),
      done: t('create.closed'),
    },
    cancel: {
      title: t('create.confirmCancelTitle'),
      description: t('create.confirmCancelDescription'),
      done: t('create.cancelled'),
    },
    complete: {
      title: t('create.confirmCompleteTitle'),
      description: t('create.confirmCompleteDescription'),
      done: t('create.completed'),
    },
  };

  const run = async (action: LifecycleAction) => {
    setActionError(null);
    try {
      await lifecycleMutation.mutateAsync({ opportunityId, action });
      setPendingAction(null);
      onDone(ACTION_COPY[action].done);
    } catch (err) {
      if (isOrgNotVerifiedError(err)) setActionError(t('create.notVerifiedError'));
      else if (isPublishGateLockedError(err)) setActionError(t('create.gateLockedError'));
      else if (isPublishingDisabledError(err)) setActionError(t('create.publishingDisabledError'));
      else setActionError(t('create.genericError'));
      setPendingAction(null);
    }
  };

  const buttons: { action: LifecycleAction; label: string }[] = [];
  if ((!only || only.includes('publish')) && availability.canPublish)
    buttons.push({ action: 'publish', label: t('create.publish') });
  if ((!only || only.includes('close')) && availability.canClose)
    buttons.push({ action: 'close', label: t('create.close') });
  if ((!only || only.includes('cancel')) && availability.canCancel)
    buttons.push({ action: 'cancel', label: t('create.cancelOpportunity') });
  if ((!only || only.includes('complete')) && availability.canComplete)
    buttons.push({ action: 'complete', label: t('create.complete') });

  if (buttons.length === 0 && !pendingAction && !actionError) return null;

  return (
    <Card title={status}>
      <div className="flex flex-col gap-3">
        {buttons.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {buttons.map(({ action, label }) => (
              <Button
                key={action}
                type="button"
                variant={action === 'publish' ? 'primary' : 'secondary'}
                size="sm"
                data-testid={`lifecycle-${action}`}
                disabled={lifecycleMutation.isPending}
                onClick={() => setPendingAction(action)}
              >
                {lifecycleMutation.isPending ? t('create.publishing') : label}
              </Button>
            ))}
          </div>
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
                {t('create.confirmAction')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPendingAction(null)}>
                {t('create.cancelAction')}
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

interface PositionDraft {
  title: string;
  requiredCount: string;
  description: string;
  skillIds: string[];
  deliverables: string;
  startAt: string;
}

const EMPTY_POSITION_DRAFT: PositionDraft = {
  title: '',
  requiredCount: '1',
  description: '',
  skillIds: [],
  deliverables: '',
  startAt: '',
};

interface PreviewPosition {
  key: string;
  title: string;
  requiredCount?: number;
  filledCount?: number;
  description?: string;
  skillIds: string[];
  deliverables: string[];
  startAt?: string | null;
}

function positionRowsForPreview(
  opportunityId: string | null,
  server: OwnerPosition[],
  local: CreatePositionInput[],
): PreviewPosition[] {
  if (opportunityId) {
    return server.map((p) => ({
      key: positionIdOf(p),
      title: p.title ?? '',
      requiredCount: p.requiredCount,
      filledCount: p.filledCount ?? undefined,
      description: (p.description as string | null) ?? undefined,
      skillIds: skillIdsOfSkills(p.requiredSkills),
      deliverables: p.deliverables ?? [],
      startAt: p.startAt ?? null,
    }));
  }
  return local.map((p, i) => ({
    key: `local-${i}`,
    title: p.title,
    requiredCount: p.requiredCount,
    filledCount: 0,
    description: p.description,
    skillIds: (p.requiredSkills ?? []).filter((id) => typeof id === 'string'),
    deliverables: p.deliverables ?? [],
    startAt: p.startAt ?? null,
  }));
}

function PositionsEditor({
  locale,
  opportunityId,
  positions,
  local,
  onLocalChange,
}: {
  locale: string;
  opportunityId: string | null;
  positions: OwnerPosition[];
  local: CreatePositionInput[];
  onLocalChange: (next: CreatePositionInput[]) => void;
}) {
  const t = useTranslations('orgOpportunities');
  const createPositionMutation = useCreatePositionMutation();
  const patchPositionMutation = usePatchPositionMutation();
  const deletePositionMutation = useDeletePositionMutation();
  const skillsQuery = useOppSkillsQuery();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PositionDraft>(EMPTY_POSITION_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const allSkills = useMemo(
    () => (skillsQuery.data ?? []).filter((s) => skillIdOf(s) !== ''),
    [skillsQuery.data],
  );

  const resetDraft = () => {
    setDraft(EMPTY_POSITION_DRAFT);
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
    const description = draft.description.trim();
    if (description !== '') input.description = description.slice(0, 2000);
    if (draft.skillIds.length > 0) input.requiredSkills = [...draft.skillIds];
    const deliverables = linesOf(draft.deliverables);
    if (deliverables.length > 0) input.deliverables = deliverables;
    if (draft.startAt !== '') input.startAt = draft.startAt;
    const issues = positionInputIssues({ title: input.title, requiredCount: input.requiredCount });
    if (description.length > 2000) issues.push('description');
    return { input, issues };
  };

  const saveServer = async () => {
    if (!opportunityId) return;
    const { input, issues } = readDraft();
    if (issues.length > 0) {
      setError(t('create.requiredError'));
      return;
    }
    try {
      if (editingId) {
        const update: UpdatePositionInput = {
          title: input.title,
          description: input.description,
          requiredCount: input.requiredCount,
          requiredSkills: input.requiredSkills ?? [],
        };
        if (input.deliverables) update.deliverables = input.deliverables;
        if (input.startAt) update.startAt = input.startAt;
        await patchPositionMutation.mutateAsync({ opportunityId, positionId: editingId, input: update });
      } else {
        await createPositionMutation.mutateAsync({ opportunityId, input });
      }
      resetDraft();
    } catch {
      setError(t('create.genericError'));
    }
  };

  const saveLocal = () => {
    const { input, issues } = readDraft();
    if (issues.length > 0) {
      setError(t('create.requiredError'));
      return;
    }
    if (editingId) {
      onLocalChange(local.map((p, i) => (`local-${i}` === editingId ? input : p)));
    } else {
      onLocalChange([...local, input]);
    }
    resetDraft();
  };

  const startEdit = (id: string, source: PreviewPosition) => {
    setDraft({
      title: source.title,
      requiredCount: String(source.requiredCount ?? 1),
      description: source.description ?? '',
      skillIds: source.skillIds,
      deliverables: source.deliverables.join('\n'),
      startAt: isoDay(source.startAt),
    });
    setEditingId(id);
    setAdding(true);
    setError(null);
  };

  const rows = positionRowsForPreview(opportunityId, positions, local);
  const configuredCount = rows.length;

  const toggleSkill = (id: string) => {
    setDraft((d) => ({
      ...d,
      skillIds: d.skillIds.includes(id) ? d.skillIds.filter((s) => s !== id) : [...d.skillIds, id],
    }));
  };

  return (
    <section aria-labelledby="positions-heading" className="rounded-xl border border-border bg-surface p-6 shadow-sm md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-4">
        <div>
          <h2 id="positions-heading" className="text-title-lg font-semibold text-ink">
            {t('create.positionsTitle')}
          </h2>
          <p className="mt-0.5 text-body-sm text-ink-muted">{t('create.positionsSubtitle')}</p>
        </div>
        <span className="text-label-sm font-medium text-ink-muted">
          {configuredCount === 1 ? t('create.rolesConfiguredOne') : t('create.rolesConfigured', { count: configuredCount })}
        </span>
      </div>

      <div className="mt-6 flex flex-col gap-4" data-testid="positions-editor">
        {rows.length === 0 && !adding ? (
          <p data-testid="positions-empty" className="text-sm text-ink-muted">
            {t('create.positionEmpty')}
          </p>
        ) : null}
        {notice ? (
          <p data-testid="position-notice" role="status" className="text-sm text-ink">
            {notice}
          </p>
        ) : null}

        {rows.map((row) => {
          const seats =
            typeof row.requiredCount === 'number'
              ? row.requiredCount === 1
                ? t('create.seatsOne')
                : t('create.seats', { count: row.requiredCount })
              : null;
          const skillNames = row.skillIds
            .map((id) => {
              const found = allSkills.find((s) => skillIdOf(s) === id);
              return found ? skillLabelOf(found, locale) : null;
            })
            .filter((name): name is string => name !== null && name !== '');
          return (
            <div
              key={row.key}
              data-testid="position-row"
              className="flex flex-col gap-4 rounded-lg border border-border bg-surface-muted/40 p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="text-title-md font-semibold text-ink">{row.title}</h3>
                    {seats ? (
                      <>
                        <span aria-hidden="true" className="text-ink-muted">
                          ·
                        </span>
                        <span className="text-label-sm font-medium text-ink-muted">{seats}</span>
                      </>
                    ) : null}
                  </div>
                  {row.description ? (
                    <p className="mt-2 text-body-md leading-relaxed text-ink-muted">{row.description}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-testid={`position-edit-${row.key}`}
                    onClick={() => startEdit(row.key, row)}
                  >
                    {t('create.positionEdit')}
                  </Button>
                  <span aria-hidden="true" className="text-border">
                    ·
                  </span>
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
                              setNotice(t('create.positionRemoved'));
                            } catch {
                              setError(t('create.genericError'));
                            }
                          }}
                        >
                          {t('create.confirmAction')}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setRemovingId(null)}>
                          {t('create.cancelAction')}
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
                        {t('create.positionRemove')}
                      </Button>
                    )
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      data-testid={`position-remove-${row.key}`}
                      onClick={() => onLocalChange(local.filter((_, i) => `local-${i}` !== row.key))}
                    >
                      {t('create.positionRemove')}
                    </Button>
                  )}
                </div>
              </div>

              {skillNames.length > 0 ? (
                <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                  <span className="text-label-xs font-medium uppercase tracking-wider text-ink-muted">
                    {t('create.requiredSkillsLabel')}
                  </span>
                  <p className="text-body-sm text-ink">{skillNames.join(' · ')}</p>
                </div>
              ) : null}

              {row.deliverables.length > 0 ? (
                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <span className="text-label-xs font-medium uppercase tracking-wider text-ink-muted">
                    {t('create.deliverablesLabel')}
                  </span>
                  <ul className="flex flex-col gap-1.5">
                    {row.deliverables.map((d, i) => (
                      <li key={`${row.key}-d-${i}`} className="flex items-start gap-2 text-body-sm text-ink">
                        <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-muted" />
                        <span className="min-w-0">{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          );
        })}

        {adding ? (
          <div data-testid="position-form" className="flex flex-col gap-4 rounded-lg border border-border p-6">
            <Input
              id="position-title"
              label={t('create.positionTitleLabel')}
              value={draft.title}
              maxLength={201}
              onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                id="position-seats"
                label={t('create.positionSeatsLabel')}
                type="number"
                min={1}
                value={draft.requiredCount}
                onChange={(event) => setDraft((d) => ({ ...d, requiredCount: event.target.value }))}
              />
              <Input
                id="position-start"
                label={t('create.positionStartLabel')}
                type="date"
                value={draft.startAt}
                onChange={(event) => setDraft((d) => ({ ...d, startAt: event.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="position-description" className="mb-1 block text-sm font-medium text-ink">
                {t('create.positionDescLabel')}
              </label>
              <textarea
                id="position-description"
                rows={3}
                placeholder={t('create.positionDescHint')}
                value={draft.description}
                onChange={(event) => setDraft((d) => ({ ...d, description: event.target.value }))}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
              />
            </div>
            <fieldset>
              <legend className="mb-1 block text-sm font-medium text-ink">{t('create.positionSkillsLabel')}</legend>
              <p className="mb-2 text-sm text-ink-muted">{t('create.positionSkillsHint')}</p>
              {skillsQuery.isPending ? (
                <p className="text-sm text-ink-muted">{t('create.loading')}</p>
              ) : allSkills.length === 0 ? (
                <p className="text-sm text-ink-muted">{t('create.positionSkillsEmpty')}</p>
              ) : (
                <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-md border border-border bg-surface p-3">
                  {allSkills.map((skill) => {
                    const id = skillIdOf(skill);
                    const checked = draft.skillIds.includes(id);
                    return (
                      <label
                        key={id}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-label-sm transition-colors ${
                          checked
                            ? 'border-primary bg-primary/10 font-medium text-ink'
                            : 'border-border text-ink-muted hover:text-ink'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSkill(id)}
                          className="h-4 w-4 shrink-0 accent-primary"
                        />
                        <span>{skillLabelOf(skill, locale)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>
            <div>
              <label htmlFor="position-deliverables" className="mb-1 block text-sm font-medium text-ink">
                {t('create.positionDeliverablesLabel')}
              </label>
              <textarea
                id="position-deliverables"
                rows={3}
                placeholder={t('create.positionDeliverablesHint')}
                value={draft.deliverables}
                onChange={(event) => setDraft((d) => ({ ...d, deliverables: event.target.value }))}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-[13px] leading-relaxed text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
              />
            </div>
            {error ? <OppSectionError message={error} testId="position-error" /> : null}
            <div className="flex gap-2">
              <Button type="button" variant="primary" size="sm" data-testid="position-save" onClick={opportunityId ? saveServer : saveLocal}>
                {t('create.positionSave')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={resetDraft}>
                {t('create.positionCancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div>
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
              {t('create.positionAdd')}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export function OpportunityEditor({ locale, opportunityId }: { locale: string; opportunityId?: string }) {
  const t = useTranslations('orgOpportunities');
  const router = useRouter();
  const uploadCover = useUploadOpportunityCover();
  const createMutation = useCreateOpportunityMutation();
  const patchMutation = usePatchOpportunityMutation();
  const lifecycleMutation = useLifecycleActionMutation();

  const existingQuery = useOwnOpportunityQuery(opportunityId);
  const gateQuery = usePublishGateQuery();
  const orgGateQuery = useOwnOrgGateQuery();
  const orgQuery = useMyOrganizationQuery();
  const categoriesQuery = useOppSkillCategoriesQuery();
  const wilayasQuery = useOppWilayasQuery();
  const skillsQuery = useOppSkillsQuery();

  const [form, setForm] = useState<EditorForm>(EMPTY_FORM);
  const [hydrated, setHydrated] = useState(!opportunityId);
  const [coverMediaId, setCoverMediaId] = useState<string | null>(null);
  const [coverProgress, setCoverProgress] = useState<number | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof EditorForm, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [lifecycleNotice, setLifecycleNotice] = useState<string | null>(null);
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const [localPositions, setLocalPositions] = useState<CreatePositionInput[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const existing = existingQuery.data;
  const isEdit = opportunityId !== undefined;
  const effectiveId = opportunityId ?? null;

  useEffect(() => {
    if (existing && !hydrated) {
      setForm(formFromOpp(existing));
      setCoverMediaId(existing.coverMediaId ?? null);
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, hydrated]);

  const municipalitiesQuery = useOppMunicipalitiesQuery(form.wilayaId || undefined);
  const coverQuery = useAccountMediaQuery(coverMediaId);
  const coverUrl = accountMediaUrlOf(coverQuery.data);

  const status = existing ? opportunityStatusOf(existing) : 'draft';
  const published = status === 'published';
  const lockedFields = useMemo(
    () => (published ? new Set<string>(FIELDS_LOCKED_AFTER_PUBLISH) : new Set<string>()),
    [published],
  );

  const serverPositions = useMemo(() => (Array.isArray(existing?.positions) ? existing.positions : []), [existing]);
  const previewRows = useMemo(
    () => positionRowsForPreview(effectiveId, serverPositions, localPositions),
    [effectiveId, serverPositions, localPositions],
  );

  // Real client-side publishing checklist over live form state (no backend
  // claim — each tick re-derives from the form, the cover upload state, and
  // the position rows above).
  const checklist = useMemo(() => {
    const basic = form.title.trim() !== '' && form.description.trim() !== '' && form.categoryId !== '';
    const datesOk =
      form.wilayaId !== '' &&
      validDay(form.startDate) &&
      (form.endDate === '' || (validDay(form.endDate) && form.endDate >= form.startDate)) &&
      (form.applicationDeadline === '' || validDay(form.applicationDeadline));
    const positionsOk =
      previewRows.length > 0 &&
      previewRows.every(
        (row) =>
          row.title.trim() !== '' &&
          typeof row.requiredCount === 'number' &&
          row.requiredCount >= 1 &&
          row.deliverables.length > 0,
      );
    const cover = coverMediaId !== null;
    return { basic, dates: datesOk, positions: positionsOk, cover };
  }, [form, previewRows, coverMediaId]);
  const checklistDone = [checklist.basic, checklist.dates, checklist.positions, checklist.cover].filter(Boolean).length;
  const checklistReady = checklistDone === 4;

  // Live feed-card preview through the REAL OpportunityCard: only form state
  // plus real reference labels (category/wilaya/municipality/skill catalogs)
  // and the real org identity. An empty title renders an empty title — the
  // card never receives invented text.
  const previewItem: OpportunityCardData = useMemo(() => {
    const category = (categoriesQuery.data ?? []).find((c) => skillCategoryIdOf(c) === form.categoryId);
    const categoryName =
      category && skillCategoryIdOf(category) !== ''
        ? { nameFr: skillCategoryLabelOf(category, 'fr'), nameAr: skillCategoryLabelOf(category, 'ar') }
        : null;
    const wilaya = labelOf(wilayasQuery.data, form.wilayaId);
    const municipality = labelOf(municipalitiesQuery.data, form.municipalityId);
    return {
      title: form.title.trim(),
      description: form.description.trim() !== '' ? form.description.trim() : null,
      startDate: validDay(form.startDate) ? form.startDate : null,
      endDate: validDay(form.endDate) ? form.endDate : null,
      applicationDeadline: validDay(form.applicationDeadline) ? form.applicationDeadline : null,
      durationMinutes:
        form.durationMinutes !== '' && Number.isInteger(Number(form.durationMinutes)) && Number(form.durationMinutes) >= 1
          ? Number(form.durationMinutes)
          : null,
      categoryName,
      locationLabels: wilaya || municipality ? { wilaya, municipality } : null,
      positions: previewRows
        .filter((row) => row.title.trim() !== '')
        .map((row) => ({
          _id: row.key,
          title: row.title,
          requiredCount: row.requiredCount,
          filledCount: row.filledCount ?? 0,
          skillNames: row.skillIds.map((id) => ({
            skillId: id,
            ...skillNameOf(skillsQuery.data, id),
          })),
        })),
      organization: {
        nameFr: orgQuery.data?.nameFr ?? null,
        nameAr: orgQuery.data?.nameAr ?? null,
        verificationStatus: orgQuery.data?.verificationStatus ?? orgGateQuery.data?.verificationStatus,
      },
      isFavorited: false,
    };
  }, [
    form,
    categoriesQuery.data,
    wilayasQuery.data,
    municipalitiesQuery.data,
    previewRows,
    skillsQuery.data,
    orgQuery.data,
    orgGateQuery.data,
  ]);

  const publicHref =
    effectiveId && (existing?.slug || effectiveId)
      ? `/${locale}/opportunities/${existing?.slug || effectiveId}`
      : null;

  if (isEdit && existingQuery.isPending) {
    return (
      <Card>
        <div data-testid="opp-editor-loading">
          <Loader label={t('create.loading')} />
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
    setForm((prev) =>
      key === 'wilayaId' ? { ...prev, [key]: value, municipalityId: '' } : { ...prev, [key]: value },
    );
    setFormNotice(null);
  };

  function validate(): boolean {
    const errors: Partial<Record<keyof EditorForm, string>> = {};
    if (form.title.trim() === '') errors.title = t('create.requiredError');
    if (form.description.trim() === '') errors.description = t('create.requiredError');
    if (form.durationMinutes !== '') {
      const minutes = Number.parseInt(form.durationMinutes, 10);
      if (!Number.isInteger(minutes) || minutes < 1) errors.durationMinutes = t('create.invalidDurationError');
    }
    for (const key of ['startDate', 'endDate', 'applicationDeadline'] as const) {
      if (form[key] !== '' && Number.isNaN(Date.parse(form[key]))) errors[key] = t('create.invalidDateError');
    }
    if (form.startDate !== '' && form.endDate !== '' && form.endDate < form.startDate) {
      errors.endDate = t('create.endBeforeStartError');
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function onCoverFile(file: File | undefined) {
    if (!file) return;
    const check = validateCoverFile({ name: file.name, type: file.type, size: file.size });
    if (!check.ok) {
      setCoverError(check.reason === 'type' ? t('create.coverTypeError') : t('create.coverSizeError'));
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
      setFormNotice(null);
    } catch {
      setCoverError(t('create.genericError'));
      setCoverProgress(null);
    }
  }

  function buildPayload() {
    return {
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
      // LocationDto accepts wilayaId/municipalityId/coordinates only — no
      // free-text address (the global pipe rejects unknown keys).
      ...(form.wilayaId !== '' || form.municipalityId !== ''
        ? {
            location: {
              ...(form.wilayaId !== '' ? { wilayaId: form.wilayaId } : {}),
              ...(form.municipalityId !== '' ? { municipalityId: form.municipalityId } : {}),
            },
          }
        : {}),
    };
  }

  // Save draft: create (POST → status draft) on a new screen, update (PATCH)
  // on an existing draft. Inline states only — no toast library.
  async function onSave(event?: FormEvent) {
    event?.preventDefault();
    if (!validate() || coverProgress !== null) return;
    setFormError(null);
    try {
      if (effectiveId) {
        await patchMutation.mutateAsync({ opportunityId: effectiveId, input: buildPayload() });
        setFormNotice(t('create.savedDraft'));
      } else {
        const created = await createMutation.mutateAsync({
          ...buildPayload(),
          ...(localPositions.length > 0 ? { positions: localPositions } : {}),
        });
        const newId = opportunityIdOf(created);
        // NOTE: next-intl useRouter prefixes the active locale itself —
        // passing a locale-prefixed path here would double it.
        if (newId) router.push(`/org/opportunities/${newId}`);
        else setFormError(t('create.genericError'));
      }
    } catch (err) {
      if (isFieldLockedError(err)) setFormError(t('create.fieldLockedError'));
      else setFormError(t('create.genericError'));
    }
  }

  // Publish: new screen chains create-then-publish (the publish endpoint
  // needs an id); edit screen publishes the existing draft. Both surface the
  // real gate errors (unverified org, locked gate, kill-switch) inline.
  async function onPublish() {
    if (!validate() || coverProgress !== null) return;
    if (!checklistReady) {
      setFormError(t('create.publishNeedsWork'));
      return;
    }
    setFormError(null);
    try {
      let id = effectiveId;
      if (!id) {
        const created = await createMutation.mutateAsync({
          ...buildPayload(),
          ...(localPositions.length > 0 ? { positions: localPositions } : {}),
        });
        id = opportunityIdOf(created);
      } else {
        await patchMutation.mutateAsync({ opportunityId: id, input: buildPayload() });
      }
      if (!id) {
        setFormError(t('create.genericError'));
        return;
      }
      await lifecycleMutation.mutateAsync({ opportunityId: id, action: 'publish' });
      setConfirmingPublish(false);
      if (isEdit) {
        setLifecycleNotice(t('create.published'));
        setFormError(null);
      } else {
        router.push(`/org/opportunities/${id}`);
      }
    } catch (err) {
      if (isOrgNotVerifiedError(err)) setFormError(t('create.notVerifiedError'));
      else if (isPublishGateLockedError(err)) setFormError(t('create.gateLockedError'));
      else if (isPublishingDisabledError(err)) setFormError(t('create.publishingDisabledError'));
      else if (isFieldLockedError(err)) setFormError(t('create.fieldLockedError'));
      else setFormError(t('create.genericError'));
      setConfirmingPublish(false);
    }
  }

  const saving = createMutation.isPending || patchMutation.isPending;
  const publishing = lifecycleMutation.isPending || createMutation.isPending || patchMutation.isPending;
  const lockedHint = (field: string) =>
    lockedFields.has(field) ? (
      <p data-testid={`locked-hint-${field}`} className="mt-1 text-xs text-ink-muted">
        {t('create.lockedFieldHint')}
      </p>
    ) : null;

  const availability = lifecycleAvailability(status, orgGateQuery.data?.verificationStatus, gateQuery.data?.locked);

  const scrollToPreview = () => {
    document.getElementById('feed-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const headerActions = (
    <>
      <Button
        type="button"
        variant="secondary"
        data-testid="editor-save-top"
        disabled={saving || coverProgress !== null}
        onClick={() => onSave()}
      >
        {saving ? t('create.saving') : t('create.saveDraft')}
      </Button>
      <Button
        type="button"
        variant="primary"
        data-testid="editor-publish-top"
        disabled={publishing || coverProgress !== null}
        onClick={() => (checklistReady ? setConfirmingPublish(true) : onPublish())}
      >
        <Send size={16} aria-hidden="true" className="shrink-0" />
        <span>{publishing ? t('create.publishing') : t('create.publish')}</span>
      </Button>
    </>
  );

  return (
    <div data-testid="opp-editor" className="flex min-w-0 flex-col gap-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col">
          <Link
            href="/org/opportunities"
            className="inline-flex items-center gap-1.5 text-label-md font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={14} aria-hidden="true" className="shrink-0 rtl:rotate-180" />
            <span>{t('create.back')}</span>
          </Link>
          <h1 className="mt-2 text-headline-lg font-semibold tracking-tight text-ink">
            {isEdit ? t('create.editTitle') : t('create.newTitle')}
          </h1>
          <p className="mt-1 text-body-md text-ink-muted">{t('create.subtitle')}</p>
          {isEdit && existing ? (
            <div className="mt-2">
              <OppStatusPill status={status} />
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">{headerActions}</div>
      </section>

      {confirmingPublish ? (
        <div
          data-testid="publish-confirm"
          className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 shadow-sm"
          role="alertdialog"
          aria-label={t('create.confirmPublishTitle')}
        >
          <p className="text-title-sm font-semibold text-ink">{t('create.confirmPublishTitle')}</p>
          <p className="text-body-sm text-ink-muted">{t('create.confirmPublishDescription')}</p>
          {!availability.canPublish && status === 'draft' ? (
            <p className="text-body-sm text-status-pending">
              {availability.publishLockedReason === 'unverified'
                ? t('create.notVerifiedError')
                : t('create.gateLockedError')}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              data-testid="publish-confirm-confirm"
              disabled={publishing}
              onClick={() => onPublish()}
            >
              {publishing ? t('create.publishing') : t('create.confirmAction')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingPublish(false)}>
              {t('create.cancelAction')}
            </Button>
          </div>
        </div>
      ) : null}

      {lifecycleNotice ? (
        <p data-testid="lifecycle-success" role="status" className="text-sm text-ink">
          {lifecycleNotice}
        </p>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <form onSubmit={onSave} className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="cover-heading" className="rounded-xl border border-border bg-surface p-6 shadow-sm md:p-8">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 id="cover-heading" className="text-title-lg font-semibold text-ink">
                  {t('create.coverTitle')}
                </h2>
                <p className="mt-0.5 text-body-sm text-ink-muted">{t('create.coverSubtitle')}</p>
              </div>
              <span className="text-label-xs font-medium uppercase tracking-wider text-ink-muted">
                {t('create.coverKicker')}
              </span>
            </div>

            {coverUrl ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- session-resolved cover URL, omitted when absent */}
                <img src={coverUrl} alt="" className="h-full w-full object-cover" />
              </div>
            ) : (
              <button
                type="button"
                data-testid="cover-dropzone"
                onClick={() => fileRef.current?.click()}
                className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-muted/40 text-ink-muted transition-colors hover:border-primary hover:text-ink"
              >
                <ImagePlus size={24} aria-hidden="true" className="shrink-0" />
                <span className="text-label-md font-medium">{t('create.coverUpload')}</span>
                <span className="text-label-sm">{t('create.coverHint')}</span>
              </button>
            )}
            <input
              ref={fileRef}
              id="opp-cover"
              data-testid="field-cover"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                onCoverFile(event.target.files?.[0]);
                event.target.value = '';
              }}
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-3">
                {coverUrl ? (
                  <>
                    <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                      <Camera size={14} aria-hidden="true" className="shrink-0" />
                      <span>{t('create.coverChange')}</span>
                    </Button>
                    <button
                      type="button"
                      data-testid="cover-remove"
                      onClick={() => {
                        setCoverMediaId(null);
                        setCoverError(null);
                        setFormNotice(null);
                      }}
                      className="rounded-lg px-3 py-2 text-label-sm font-medium text-status-error transition-colors hover:bg-status-error/10"
                    >
                      {t('create.coverRemove')}
                    </button>
                  </>
                ) : null}
              </div>
              <span className="text-body-sm text-ink-muted">{t('create.coverHint')}</span>
            </div>
            {coverProgress !== null ? (
              <p data-testid="cover-progress" role="status" className="mt-2 text-sm text-ink-muted">
                {t('create.coverUploading')} {coverProgress}%
              </p>
            ) : null}
            {coverMediaId && coverUrl ? (
              <p data-testid="cover-success" role="status" className="mt-2 text-sm text-ink">
                {t('create.coverAttached')}
              </p>
            ) : null}
            {coverError ? <OppSectionError message={coverError} testId="cover-error" /> : null}
          </section>

          <section aria-labelledby="basic-heading" className="flex flex-col gap-6 rounded-xl border border-border bg-surface p-6 shadow-sm md:p-8">
            <div className="border-b border-border pb-4">
              <h2 id="basic-heading" className="text-title-lg font-semibold text-ink">
                {t('create.basicTitle')}
              </h2>
              <p className="mt-0.5 text-body-sm text-ink-muted">{t('create.basicSubtitle')}</p>
            </div>
            <Input
              id="opp-title"
              label={t('create.titleLabel')}
              hint={t('create.titleHint')}
              value={form.title}
              maxLength={201}
              error={fieldErrors.title}
              onChange={(event) => set('title')(event.target.value)}
            />
            <Select
              id="opp-category"
              label={t('create.categoryLabel')}
              value={form.categoryId}
              onChange={(event) => set('categoryId')(event.target.value)}
              options={[
                { value: '', label: t('create.selectPlaceholder') },
                ...(categoriesQuery.data ?? [])
                  .filter((c) => skillCategoryIdOf(c) !== '')
                  .map((c) => ({ value: skillCategoryIdOf(c), label: skillCategoryLabelOf(c, locale) })),
              ]}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="opp-description" className="text-sm font-medium text-ink">
                {t('create.descriptionLabel')}
              </label>
              <textarea
                id="opp-description"
                rows={6}
                value={form.description}
                onChange={(event) => set('description')(event.target.value)}
                aria-invalid={fieldErrors.description ? true : undefined}
                className={`w-full rounded-md border bg-surface px-3.5 py-3 text-body-md leading-relaxed text-ink placeholder:text-ink-muted focus:outline-none ${
                  fieldErrors.description ? 'border-status-error' : 'border-border focus:border-primary'
                }`}
              />
              {fieldErrors.description ? (
                <p className="text-sm text-status-error">{fieldErrors.description}</p>
              ) : (
                <p className="text-label-xs text-ink-muted">{t('create.descriptionHint')}</p>
              )}
            </div>
          </section>

          <section aria-labelledby="when-heading" className="flex flex-col gap-6 rounded-xl border border-border bg-surface p-6 shadow-sm md:p-8">
            <div className="border-b border-border pb-4">
              <h2 id="when-heading" className="text-title-lg font-semibold text-ink">
                {t('create.whenTitle')}
              </h2>
              <p className="mt-0.5 text-body-sm text-ink-muted">{t('create.whenSubtitle')}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                id="opp-wilaya"
                label={t('create.wilayaLabel')}
                value={form.wilayaId}
                onChange={(event) => set('wilayaId')(event.target.value)}
                options={[
                  { value: '', label: t('create.selectPlaceholder') },
                  ...(wilayasQuery.data ?? []).map((w) => ({
                    value: w.code,
                    label: locale === 'ar' ? w.nameAr : w.nameFr,
                  })),
                ]}
              />
              <Select
                id="opp-municipality"
                label={t('create.municipalityLabel')}
                value={form.municipalityId}
                onChange={(event) => set('municipalityId')(event.target.value)}
                options={[
                  { value: '', label: t('create.selectPlaceholder') },
                  ...(municipalitiesQuery.data ?? []).map((m) => ({
                    value: m.code,
                    label: locale === 'ar' ? m.nameAr : m.nameFr,
                  })),
                ]}
              />
            </div>
            <div>
              <span id="opp-mode-label" className="mb-1 block text-sm font-medium text-ink">
                {t('create.modeLabel')}
              </span>
              <div role="radiogroup" aria-labelledby="opp-mode-label" className="flex flex-wrap gap-2">
                {(['onsite', 'remote', 'hybrid'] as const).map((mode) => {
                  const active = form.mode === mode;
                  const label =
                    mode === 'onsite' ? t('create.modeOnsite') : mode === 'remote' ? t('create.modeRemote') : t('create.modeHybrid');
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      data-testid={`mode-${mode}`}
                      disabled={lockedFields.has('mode')}
                      onClick={() => set('mode')(active ? '' : mode)}
                      className={`inline-flex h-10 items-center rounded-lg border px-4 text-label-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        active
                          ? 'border-primary bg-primary/10 text-ink'
                          : 'border-border bg-surface text-ink-muted hover:text-ink'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-label-xs text-ink-muted">{t('create.modeHint')}</p>
              {lockedHint('mode')}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                id="opp-start"
                label={t('create.startLabel')}
                type="date"
                value={form.startDate}
                error={fieldErrors.startDate}
                onChange={(event) => set('startDate')(event.target.value)}
              />
              <div>
                <Input
                  id="opp-end"
                  label={t('create.endLabel')}
                  type="date"
                  value={form.endDate}
                  error={fieldErrors.endDate}
                  disabled={lockedFields.has('endDate')}
                  onChange={(event) => set('endDate')(event.target.value)}
                />
                {lockedHint('endDate')}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Input
                  id="opp-duration"
                  label={t('create.durationLabel')}
                  hint={t('create.durationHint')}
                  type="number"
                  min={1}
                  value={form.durationMinutes}
                  error={fieldErrors.durationMinutes}
                  disabled={lockedFields.has('durationMinutes')}
                  onChange={(event) => set('durationMinutes')(event.target.value)}
                />
                {lockedHint('durationMinutes')}
              </div>
              <Input
                id="opp-deadline"
                label={t('create.deadlineLabel')}
                hint={t('create.deadlineHint')}
                type="date"
                value={form.applicationDeadline}
                error={fieldErrors.applicationDeadline}
                onChange={(event) => set('applicationDeadline')(event.target.value)}
              />
            </div>
          </section>

          <PositionsEditor
            locale={locale}
            opportunityId={effectiveId}
            positions={serverPositions}
            local={localPositions}
            onLocalChange={setLocalPositions}
          />

          <section aria-labelledby="req-heading" className="flex flex-col gap-6 rounded-xl border border-border bg-surface p-6 shadow-sm md:p-8">
            <div className="border-b border-border pb-4">
              <h2 id="req-heading" className="text-title-lg font-semibold text-ink">
                {t('create.reqTitle')}
              </h2>
              <p className="mt-0.5 text-body-sm text-ink-muted">{t('create.reqSubtitle')}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="opp-prerequisites" className="text-sm font-medium text-ink">
                {t('create.prerequisitesLabel')}
              </label>
              <textarea
                id="opp-prerequisites"
                rows={5}
                value={form.prerequisites}
                disabled={lockedFields.has('prerequisites')}
                onChange={(event) => set('prerequisites')(event.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3.5 py-3 font-mono text-[13px] leading-relaxed text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none disabled:opacity-50"
              />
              <p className="text-label-xs text-ink-muted">{t('create.prerequisitesHint')}</p>
              {lockedHint('prerequisites')}
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="primary"
                data-testid="editor-publish-bottom"
                disabled={publishing || coverProgress !== null}
                onClick={() => (checklistReady ? setConfirmingPublish(true) : onPublish())}
              >
                <Send size={16} aria-hidden="true" className="shrink-0" />
                <span>{publishing ? t('create.publishing') : t('create.publish')}</span>
              </Button>
              <Button
                type="submit"
                variant="secondary"
                data-testid="editor-save-bottom"
                disabled={saving || coverProgress !== null}
              >
                {saving ? t('create.saving') : t('create.saveDraft')}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {publicHref ? (
                <a
                  href={publicHref}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="preview-public-link"
                  className="inline-flex items-center gap-1 text-label-sm font-medium text-ink-muted transition-colors hover:text-ink"
                >
                  <span>{t('create.previewPublic')}</span>
                  <ExternalLink size={14} aria-hidden="true" className="shrink-0" />
                </a>
              ) : (
                <button
                  type="button"
                  data-testid="preview-public-scroll"
                  onClick={scrollToPreview}
                  className="text-label-sm font-medium text-ink-muted transition-colors hover:text-ink"
                >
                  {t('create.previewPublic')}
                </button>
              )}
              <Link
                href="/org/opportunities"
                className="text-label-sm font-medium text-ink-muted transition-colors hover:text-ink"
              >
                {t('create.cancel')}
              </Link>
            </div>
          </div>
          {formError ? <OppSectionError message={formError} testId="editor-error" /> : null}
          {formNotice ? (
            <p data-testid="editor-success" role="status" className="text-sm text-ink">
              {formNotice}
            </p>
          ) : null}

          {isEdit && effectiveId ? (
            <LifecycleBar
              opportunityId={effectiveId}
              status={status}
              verificationStatus={orgGateQuery.data?.verificationStatus}
              gate={gateQuery.data}
              only={['close', 'cancel', 'complete']}
              onDone={(message) => {
                setLifecycleNotice(message);
                setFormError(null);
              }}
            />
          ) : null}
        </form>

        <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-24">
          <div
            id="feed-preview"
            data-testid="feed-preview"
            className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-border bg-surface-muted/40 p-4">
              <div className="flex items-center gap-2">
                <Eye size={16} aria-hidden="true" className="shrink-0 text-ink-muted" />
                <span className="text-label-sm font-semibold text-ink">{t('create.previewTitle')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ink-muted" />
                <span className="text-label-xs text-ink-muted">
                  {published ? t('create.previewLive') : t('create.previewDraft')}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-4 p-5">
              {coverUrl ? (
                <div className="aspect-video w-full overflow-hidden rounded-lg bg-surface-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element -- session-resolved cover URL, omitted when absent */}
                  <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                </div>
              ) : null}
              <OpportunityCard
                item={previewItem}
                locale={locale}
                favorited={false}
                next="/org/opportunities/new"
                interactive={false}
              />
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <div className="w-full rounded-lg bg-surface-muted py-2 text-center text-label-sm text-ink-muted">
                  {t('create.previewOpenNote')}
                </div>
                {!published ? (
                  <p className="text-center text-label-xs text-ink-muted">{t('create.previewHiddenNote')}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div
            data-testid="publishing-checklist"
            className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-title-sm font-semibold text-ink">{t('create.checklistTitle')}</span>
              {checklistReady ? (
                <span className="text-label-xs font-semibold text-status-success">{t('create.checklistReady')}</span>
              ) : (
                <span className="text-label-xs text-ink-muted">{t('create.checklistProgress', { done: checklistDone })}</span>
              )}
            </div>
            <ul className="flex flex-col gap-3 text-body-sm">
              <ChecklistRow
                done={checklist.basic}
                label={t('create.checkBasic')}
                testId="check-basic"
              />
              <ChecklistRow
                done={checklist.dates}
                label={t('create.checkLocation')}
                testId="check-location"
              />
              <ChecklistRow
                done={checklist.positions}
                label={
                  checklist.positions
                    ? previewRows.length === 1
                      ? t('create.checkPositionsReadyOne')
                      : t('create.checkPositionsReady', { count: previewRows.length })
                    : t('create.checkPositionsMissing')
                }
                testId="check-positions"
              />
              <ChecklistRow done={checklist.cover} label={t('create.checkCover')} testId="check-cover" />
            </ul>
            <div className="border-t border-border pt-3">
              {publicHref ? (
                <a
                  href={publicHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-label-sm font-medium text-primary hover:underline"
                >
                  <span>{t('create.previewOpenNewTab')}</span>
                  <ExternalLink size={12} aria-hidden="true" className="shrink-0" />
                </a>
              ) : (
                <p className="text-label-sm text-ink-muted">{t('create.previewHiddenNote')}</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-muted/40 p-4 text-ink-muted">
            <div className="flex items-start gap-2.5">
              <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
              <div className="flex flex-col gap-1">
                <span className="block text-label-xs font-semibold uppercase tracking-wider text-ink">
                  {t('create.publishNoteTitle')}
                </span>
                <p className="text-body-sm leading-relaxed">{t('create.publishNote')}</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ChecklistRow({ done, label, testId }: { done: boolean; label: string; testId: string }) {
  return (
    <li data-testid={testId} className="flex items-center gap-2.5 text-ink">
      {done ? (
        <CircleCheck size={16} aria-hidden="true" className="shrink-0 text-status-success" />
      ) : (
        <Circle size={16} aria-hidden="true" className="shrink-0 text-ink-muted" />
      )}
      <span>{label}</span>
    </li>
  );
}

export function NewOpportunityScreen({ locale }: { locale: string }) {
  return (
    <RequireOrgOpps locale={locale} next={`/org/opportunities/new`}>
      <OpportunityEditor locale={locale} />
    </RequireOrgOpps>
  );
}

export function EditOpportunityScreen({ locale, opportunityId }: { locale: string; opportunityId: string }) {
  return (
    <RequireOrgOpps locale={locale} next={`/org/opportunities/${opportunityId}`}>
      <OpportunityEditor locale={locale} opportunityId={opportunityId} />
    </RequireOrgOpps>
  );
}
