'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ImageUploader, SectionCard } from '@/components/profile';
import { validateImageFile } from '@/lib/api/media';
import { notify } from '@/lib/notify';
import { volunteerMediaUrlOf } from '@/lib/api/volunteers';
import {
  useAvatarUploadMutation,
  useBannerUploadMutation,
  useVolunteerMeQuery,
  useVolunteerMediaQuery,
} from '@/hooks/useVolunteerAccount';

type UploadSlot = 'avatar' | 'banner';

export function ProfileMedia() {
  const t = useTranslations('volunteerAccount');
  const meQuery = useVolunteerMeQuery();
  const avatarQuery = useVolunteerMediaQuery(meQuery.data?.avatar);
  const bannerQuery = useVolunteerMediaQuery(meQuery.data?.banner);
  const [progress, setProgress] = useState<Partial<Record<UploadSlot, number>>>({});
  const [errors, setErrors] = useState<Partial<Record<UploadSlot, string>>>({});

  const avatarUpload = useAvatarUploadMutation({
    onProgress: (value) => setProgress((prev) => ({ ...prev, avatar: value.percent })),
  });
  const bannerUpload = useBannerUploadMutation({
    onProgress: (value) => setProgress((prev) => ({ ...prev, banner: value.percent })),
  });

  if (meQuery.isPending) {
    return (
      <SectionCard id="profile-media" title={t('profile.mediaTitle')}>
        <p className="text-sm text-ink-muted">{t('shared.loading')}</p>
      </SectionCard>
    );
  }

  async function onFile(slot: UploadSlot, file: File | null) {
    if (!file) return;
    const check = validateImageFile({ name: file.name, type: file.type, size: file.size });
    if (!check.ok) {
      setErrors((prev) => ({
        ...prev,
        [slot]: check.reason === 'type' ? t('profile.imageTypeError') : t('profile.imageSizeError'),
      }));
      notify.error(check.reason === 'type' ? 'error.fileTypeNotAllowed' : 'error.fileTooLarge');
      return;
    }
    setErrors((prev) => ({ ...prev, [slot]: undefined }));
    setProgress((prev) => ({ ...prev, [slot]: 0 }));
    try {
      const upload = slot === 'avatar' ? avatarUpload : bannerUpload;
      await upload.mutateAsync({
        name: file.name,
        type: file.type,
        size: file.size,
        bytes: file,
      });
    } catch {
      // Global mutation meta surfaces the failure toast.
    } finally {
      setProgress((prev) => ({ ...prev, [slot]: undefined }));
    }
  }

  return (
    <SectionCard
      id="profile-media"
      title={t('profile.mediaTitle')}
      description={t('profile.mediaHint')}
      testId="profile-media"
    >
      <div className="flex flex-col gap-6">
        <ImageUploader
          id="profile-avatar-input"
          label={t('profile.avatarTitle')}
          hint={t('profile.avatarHint')}
          valueUrl={volunteerMediaUrlOf(avatarQuery.data)}
          onSelect={(file) => onFile('avatar', file)}
          onFileError={() => undefined}
          aspect="avatar"
          buttonLabel={t('profile.avatarChange')}
          emptyLabel={t('profile.avatarEmpty')}
          error={errors.avatar}
          uploading={progress.avatar !== undefined || avatarUpload.isPending}
          progress={progress.avatar ?? null}
          testId="profile-avatar"
        />
        <ImageUploader
          id="profile-banner-input"
          label={t('profile.bannerTitle')}
          hint={t('profile.bannerHint')}
          valueUrl={volunteerMediaUrlOf(bannerQuery.data)}
          onSelect={(file) => onFile('banner', file)}
          onFileError={() => undefined}
          aspect="banner"
          buttonLabel={t('profile.bannerChange')}
          emptyLabel={t('profile.bannerEmpty')}
          error={errors.banner}
          uploading={progress.banner !== undefined || bannerUpload.isPending}
          progress={progress.banner ?? null}
          testId="profile-banner"
        />
      </div>
    </SectionCard>
  );
}
