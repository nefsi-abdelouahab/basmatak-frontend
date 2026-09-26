'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Pill } from '@/components/ui/Pill';
import {
  useCreatePortfolioItemMutation,
  useDeletePortfolioItemMutation,
  useMyPortfolioQuery,
  usePatchPortfolioItemMutation,
  usePortfolioUploadMutation,
  useReorderPortfolioMutation,
} from '@/hooks/usePortfolio';
import {
  buildReorderPayload,
  normalizeTags,
  validatePortfolioFile,
  type PortfolioItem,
  type PortfolioVisibility,
} from '@/lib/api/portfolio';
import type { UploadProgress } from '@/lib/api/media';
import { ProgressBar, RequireVolunteer, SectionError, Toggle } from '../components';

interface PortfolioFormState {
  mode: 'create' | 'edit';
  itemId: string | null;
  title: string;
  description: string;
  typeLabel: string;
  tagsText: string;
  visible: boolean;
  mediaIds: string[];
}

const emptyForm: PortfolioFormState = {
  mode: 'create',
  itemId: null,
  title: '',
  description: '',
  typeLabel: '',
  tagsText: '',
  visible: true,
  mediaIds: [],
};

function MediaList({ item }: { item: PortfolioItem }) {
  const t = useTranslations('volunteerCredentials');
  if (item.media.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {item.media.map((entry) => (
        <li key={entry.mediaId} className="text-sm">
          {entry.type === 'link' && entry.url ? (
            <a href={entry.url} target="_blank" rel="noreferrer" className="font-medium text-primary">
              {entry.filename ?? entry.url}
            </a>
          ) : (
            <span className="text-ink-muted">
              {entry.filename ?? entry.mediaId}
              {entry.mimeType ? ` (${entry.mimeType})` : ''}
            </span>
          )}
        </li>
      ))}
      <span className="sr-only">{t('portfolio.fileLabel')}</span>
    </ul>
  );
}

// F8-owned portfolio route: CRUD with typeLabel/tags, file attach (images +
// PDF only, 2-step flow with progress), up/down reorder + atomic save, delete
// confirm. No audio player, no Featured flag, no single-item fetch. Guest
// visits redirect to Login (decision 10).
export function PortfolioPage({ locale }: { locale: string }) {
  const t = useTranslations('volunteerCredentials');
  const listQuery = useMyPortfolioQuery();
  const createMutation = useCreatePortfolioItemMutation();
  const patchMutation = usePatchPortfolioItemMutation();
  const deleteMutation = useDeletePortfolioItemMutation();
  const reorderMutation = useReorderPortfolioMutation();

  const [orderedIds, setOrderedIds] = useState<string[] | null>(null);
  const [form, setForm] = useState<PortfolioFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortfolioItem | null>(null);
  const [orderNotice, setOrderNotice] = useState<'saved' | 'error' | null>(null);

  const uploadMutation = usePortfolioUploadMutation({
    onProgress: (p) => setProgress(p),
  });

  const serverItems = listQuery.data ?? [];
  const items =
    orderedIds === null
      ? serverItems
      : orderedIds
          .map((id) => serverItems.find((item) => item.id === id))
          .filter((item): item is PortfolioItem => item !== undefined);
  const orderDirty =
    orderedIds !== null &&
    (orderedIds.length !== serverItems.length ||
      orderedIds.some((id, index) => serverItems[index]?.id !== id));

  useEffect(() => {
    setOrderedIds(null);
    setOrderNotice(null);
  }, [listQuery.dataUpdatedAt]);

  const openCreate = () => {
    setForm({ ...emptyForm });
    setFormError(null);
    setFileError(null);
    setProgress(null);
  };

  const openEdit = (item: PortfolioItem) => {
    setForm({
      mode: 'edit',
      itemId: item.id,
      title: item.title,
      description: item.description ?? '',
      typeLabel: item.typeLabel ?? '',
      tagsText: (item.tags ?? []).join(', '),
      visible: item.visibility === 'public',
      mediaIds: [...item.mediaIds],
    });
    setFormError(null);
    setFileError(null);
    setProgress(null);
  };

  const onPickFile = async (file: File) => {
    setFileError(null);
    const valid = validatePortfolioFile({ name: file.name, type: file.type, size: file.size });
    if (!valid.ok) {
      setFileError(
        valid.reason === 'type' ? t('portfolio.fileTypeError') : t('portfolio.fileSizeError'),
      );
      return;
    }
    setProgress({ loaded: 0, total: file.size, percent: 0 });
    try {
      const mediaId = await uploadMutation.mutateAsync({
        name: file.name,
        type: file.type,
        size: file.size,
        bytes: file,
      });
      setForm((prev) => (prev ? { ...prev, mediaIds: [...prev.mediaIds, mediaId] } : prev));
    } catch {
      setFileError(t('shared.genericError'));
    } finally {
      setProgress(null);
    }
  };

  const onSubmitForm = () => {
    if (!form || form.title.trim() === '') {
      setFormError(t('shared.genericError'));
      return;
    }
    setFormError(null);
    const visibility: PortfolioVisibility = form.visible ? 'public' : 'private';
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() === '' ? undefined : form.description.trim(),
      mediaIds: form.mediaIds,
      visibility,
      typeLabel: form.typeLabel.trim() === '' ? undefined : form.typeLabel.trim(),
      tags: normalizeTags(form.tagsText.split(',')),
    };
    if (form.mode === 'create') {
      createMutation.mutate(payload, {
        onSuccess: () => setForm(null),
        onError: () => setFormError(t('portfolio.saveError')),
      });
    } else if (form.itemId) {
      patchMutation.mutate(
        { itemId: form.itemId, input: payload },
        {
          onSuccess: () => setForm(null),
          onError: () => setFormError(t('portfolio.saveError')),
        },
      );
    }
  };

  const move = (id: string, direction: -1 | 1) => {
    const base = orderedIds ?? serverItems.map((item) => item.id);
    const index = base.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= base.length) return;
    const next = [...base];
    const [moved] = next.splice(index, 1);
    if (moved !== undefined) next.splice(target, 0, moved);
    setOrderedIds(next);
    setOrderNotice(null);
  };

  const onSaveOrder = () => {
    const payload = buildReorderPayload(
      (orderedIds ?? []).map((id) => ({ id })),
    );
    reorderMutation.mutate(payload.itemIds, {
      onSuccess: () => {
        setOrderedIds(null);
        setOrderNotice('saved');
      },
      onError: () => setOrderNotice('error'),
    });
  };

  const onConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  return (
    <RequireVolunteer locale={locale} next={`/${locale}/volunteer/portfolio`}>
      <div data-testid="volunteer-portfolio" className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink">{t('portfolio.title')}</h1>
            <p className="text-sm text-ink-muted">{t('portfolio.subtitle')}</p>
          </div>
          <Button type="button" size="sm" data-testid="portfolio-new" onClick={openCreate}>
            {t('portfolio.newItem')}
          </Button>
        </div>
        {listQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
        {listQuery.isError ? (
          <SectionError testId="portfolio-list-error" message={t('shared.loadError')} />
        ) : null}
        {listQuery.data ? (
          <div className="flex flex-wrap items-center gap-3">
            <p data-testid="portfolio-count" className="text-sm text-ink-muted">
              {t('portfolio.count', { total: serverItems.length })}
            </p>
            {orderDirty ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                data-testid="portfolio-save-order"
                onClick={onSaveOrder}
                disabled={reorderMutation.isPending}
              >
                {t('portfolio.saveOrder')}
              </Button>
            ) : null}
            {orderNotice === 'saved' ? (
              <p data-testid="portfolio-order-saved" className="text-sm text-status-success">
                {t('portfolio.orderSaved')}
              </p>
            ) : null}
            {orderNotice === 'error' ? (
              <p role="alert" className="text-sm text-status-error">
                {t('portfolio.orderSaveError')}
              </p>
            ) : null}
          </div>
        ) : null}
        {listQuery.data && serverItems.length === 0 && form === null ? (
          <Empty title={t('portfolio.empty')} />
        ) : null}
        {items.map((item, index) => (
          <Card key={item.id}>
            <article data-testid="portfolio-card" data-id={item.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-ink">{item.title}</h3>
                <div className="flex flex-wrap items-center gap-2">
                  {item.typeLabel ? <Pill tone="neutral">{item.typeLabel}</Pill> : null}
                  {(item.tags ?? []).map((tag) => (
                    <Pill key={tag} tone="neutral">
                      {tag}
                    </Pill>
                  ))}
                </div>
              </div>
              {item.description ? <p className="text-sm text-ink-muted">{item.description}</p> : null}
              <MediaList item={item} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => openEdit(item)}>
                  {t('portfolio.editItem')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid={`portfolio-delete-${item.id}`}
                  onClick={() => setDeleteTarget(item)}
                >
                  {t('portfolio.deleteCta')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid={`portfolio-move-up-${item.id}`}
                  onClick={() => move(item.id, -1)}
                  disabled={index === 0}
                >
                  {t('portfolio.moveUp')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid={`portfolio-move-down-${item.id}`}
                  onClick={() => move(item.id, 1)}
                  disabled={index === items.length - 1}
                >
                  {t('portfolio.moveDown')}
                </Button>
              </div>
            </article>
          </Card>
        ))}
        {form ? (
          <Card title={form.mode === 'create' ? t('portfolio.newItem') : t('portfolio.editItem')}>
            <div data-testid="portfolio-form" className="flex flex-col gap-3">
              <Input
                id="portfolio-title"
                label={t('portfolio.titleLabel')}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
              <Input
                id="portfolio-description"
                label={t('portfolio.descriptionLabel')}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
              <Input
                id="portfolio-typelabel"
                label={t('portfolio.typeLabelLabel')}
                hint={t('portfolio.typeLabelHint')}
                value={form.typeLabel}
                onChange={(event) => setForm({ ...form, typeLabel: event.target.value })}
              />
              <Input
                id="portfolio-tags"
                label={t('portfolio.tagsLabel')}
                hint={t('portfolio.tagsHint')}
                value={form.tagsText}
                onChange={(event) => setForm({ ...form, tagsText: event.target.value })}
              />
              <span className="flex items-center gap-2 text-sm text-ink">
                <Toggle
                  checked={form.visible}
                  onChange={(next) => setForm({ ...form, visible: next })}
                  label={t('portfolio.visibilityLabel')}
                  testId="portfolio-visibility"
                />
                {t('portfolio.visibilityLabel')}
              </span>
              <div>
                <label htmlFor="portfolio-file" className="mb-1 block text-sm font-medium text-ink">
                  {t('portfolio.fileLabel')}
                </label>
                <p className="mb-1 text-sm text-ink-muted">{t('portfolio.fileHint')}</p>
                <input
                  id="portfolio-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void onPickFile(file);
                    event.target.value = '';
                  }}
                />
                {progress ? (
                  <div className="mt-2">
                    <ProgressBar
                      percent={progress.percent}
                      label={t('portfolio.uploading', { percent: progress.percent })}
                    />
                  </div>
                ) : null}
                {fileError ? (
                  <p data-testid="portfolio-file-error" role="alert" className="mt-1 text-sm text-status-error">
                    {fileError}
                  </p>
                ) : null}
                {form.mediaIds.length > 0 ? (
                  <p data-testid="portfolio-attached" className="mt-1 text-sm text-ink-muted">
                    {form.mediaIds.join(', ')}
                  </p>
                ) : null}
              </div>
              {formError ? (
                <p role="alert" className="text-sm text-status-error">
                  {formError}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  data-testid="portfolio-submit"
                  onClick={onSubmitForm}
                  disabled={createMutation.isPending || patchMutation.isPending}
                >
                  {form.mode === 'create' ? t('portfolio.createCta') : t('portfolio.updateCta')}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setForm(null)}>
                  {t('shared.cancel')}
                </Button>
              </div>
            </div>
          </Card>
        ) : null}
        {deleteTarget ? (
          <Card title={t('portfolio.deleteTitle')}>
            <div data-testid="portfolio-delete-confirm" className="flex flex-col gap-3">
              <p className="text-sm text-ink-muted">{t('portfolio.deleteBody')}</p>
              {deleteMutation.isError ? (
                <p role="alert" className="text-sm text-status-error">
                  {t('portfolio.deleteError')}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="danger"
                  data-testid="portfolio-delete-confirm-btn"
                  onClick={onConfirmDelete}
                  disabled={deleteMutation.isPending}
                >
                  {t('shared.confirm')}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)}>
                  {t('shared.cancel')}
                </Button>
              </div>
            </div>
          </Card>
        ) : null}
      </div>
    </RequireVolunteer>
  );
}
