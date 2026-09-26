'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { validateImageFile } from '@/lib/api/media';
import { useAvatarUploadMutation, useVolunteerMeQuery } from '@/hooks/useVolunteerAccount';
import { ProgressBar, SectionError } from '../components';

export function AvatarUploader() {
  const t = useTranslations('volunteerAccount');
  const meQuery = useVolunteerMeQuery();
  const inputRef = useRef<HTMLInputElement>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const upload = useAvatarUploadMutation({
    onProgress: (p) => setPercent(p.percent),
  });

  function onPick() {
    setFileError(null);
    inputRef.current?.click();
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0];
    event.target.value = '';
    if (!f) return;
    const check = validateImageFile({ name: f.name, type: f.type, size: f.size });
    if (!check.ok) {
      setFileError(check.reason === 'type' ? t('profile.avatarTypeError') : t('profile.avatarSizeError'));
      return;
    }
    setPercent(0);
    try {
      await upload.mutateAsync({ name: f.name, type: f.type, size: f.size, bytes: f });
    } catch {
      // surfaced below via upload.isError
    } finally {
      setPercent(null);
    }
  }

  return (
    <Card title={t('profile.avatarTitle')}>
      <div data-testid="profile-avatar" className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{t('profile.avatarHint')}</p>
        {meQuery.data?.avatar ? (
          <p className="text-sm text-ink-muted">{meQuery.data.avatar}</p>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          aria-label={t('profile.avatarChange')}
          onChange={onFile}
        />
        {upload.isPending ? (
          <div className="flex flex-col gap-2">
            <Loader label={t('profile.avatarUploading')} />
            {percent !== null ? (
              <ProgressBar percent={percent} label={t('profile.avatarUploading')} />
            ) : null}
            {percent !== null ? (
              <p data-testid="avatar-progress" className="text-sm text-ink-muted">
                {t('profile.avatarProgress', { percent })}
              </p>
            ) : null}
          </div>
        ) : (
          <div>
            <Button type="button" variant="secondary" onClick={onPick}>
              {t('profile.avatarChange')}
            </Button>
          </div>
        )}
        {fileError ? <SectionError testId="avatar-error" message={fileError} /> : null}
        {upload.isError && !fileError ? (
          <SectionError testId="avatar-error" message={t('shared.genericError')} />
        ) : null}
      </div>
    </Card>
  );
}
