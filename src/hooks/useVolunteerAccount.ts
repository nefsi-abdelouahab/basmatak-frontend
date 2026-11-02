'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query/keys';
import * as volunteersApi from '../lib/api/volunteers';
import type {
  AddVolunteerSkill,
  Availability,
  UpdatePublicSettings,
  UpdateVolunteerProfile,
  UpdateVolunteerSkill,
} from '../lib/api/volunteers';
import { putPresignedBytes, uploadMedia, type UploadProgress } from '../lib/api/media';

// F2 profile hook file: own identity, avatar upload, skills, availability,
// opt-out public toggles, dashboard completion read. Components fetch only
// via these hooks; keys come from the F0 factory (no keys.ts edits).

const DOMAIN = 'volunteer-profile';

export function useVolunteerMeQuery() {
  return useQuery({
    queryKey: queryKeys.detail(DOMAIN, 'me'),
    queryFn: () => volunteersApi.getVolunteerMe(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function usePatchVolunteerMeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.profileUpdated' },
    mutationFn: (input: UpdateVolunteerProfile) => volunteersApi.patchVolunteerMe(api, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

export function usePatchPublicSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.privacyUpdated', silent: true },
    mutationFn: (input: UpdatePublicSettings) => volunteersApi.patchPublicSettings(api, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

export function useVolunteerDashboardQuery() {
  return useQuery({
    queryKey: queryKeys.detail(DOMAIN, 'dashboard'),
    queryFn: () => volunteersApi.getVolunteerDashboard(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function useVolunteerProfileCompletionQuery() {
  return useQuery({
    queryKey: queryKeys.detail(DOMAIN, 'profile-completion'),
    queryFn: () => volunteersApi.getVolunteerProfileCompletion(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function useVolunteerMediaQuery(mediaId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.detail(DOMAIN, `media-${mediaId ?? 'none'}`),
    queryFn: () => volunteersApi.getVolunteerMedia(api, mediaId as string),
    enabled: typeof mediaId === 'string' && mediaId.length > 0,
    staleTime: 300_000,
    retry: false,
  });
}

export function useMySkillsQuery() {
  return useQuery({
    queryKey: queryKeys.list(`${DOMAIN}-skills`),
    queryFn: () => volunteersApi.listMySkills(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function useAddMySkillMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.skillAdded' },
    mutationFn: (input: AddVolunteerSkill) => volunteersApi.addMySkill(api, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
      queryClient.invalidateQueries({ queryKey: queryKeys.list(`${DOMAIN}-skills`) });
    },
  });
}

export function useUpdateMySkillMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.skillUpdated' },
    mutationFn: ({ skillId, input }: { skillId: string; input: UpdateVolunteerSkill }) =>
      volunteersApi.updateMySkill(api, skillId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
      queryClient.invalidateQueries({ queryKey: queryKeys.list(`${DOMAIN}-skills`) });
    },
  });
}

export function useDeleteMySkillMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.skillRemoved' },
    mutationFn: (skillId: string) => volunteersApi.deleteMySkill(api, skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
      queryClient.invalidateQueries({ queryKey: queryKeys.list(`${DOMAIN}-skills`) });
    },
  });
}

export function useSkillsLookupQuery(categoryId?: string) {
  return useQuery({
    queryKey: queryKeys.list('skills', categoryId ? { categoryId } : undefined),
    queryFn: () => volunteersApi.listSkills(api, categoryId ? { categoryId } : undefined),
    staleTime: 300_000,
    retry: false,
  });
}

export function useSkillCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.list('skill-categories'),
    queryFn: () => volunteersApi.listSkillCategories(api),
    staleTime: 300_000,
    retry: false,
  });
}

export function useProfileWilayasQuery() {
  return useQuery({
    queryKey: queryKeys.list(DOMAIN, { scope: 'wilayas' }),
    queryFn: () => volunteersApi.listWilayas(api),
    staleTime: 300_000,
    retry: false,
  });
}

export function useProfileMunicipalitiesQuery(wilayaId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.list(DOMAIN, { scope: 'municipalities', wilayaId: wilayaId ?? 'none' }),
    queryFn: () => volunteersApi.listMunicipalities(api, wilayaId as string),
    enabled: Boolean(wilayaId),
    staleTime: 300_000,
    retry: false,
  });
}

export function useMyAvailabilityQuery() {
  return useQuery({
    queryKey: queryKeys.detail(DOMAIN, 'availability'),
    queryFn: () => volunteersApi.getMyAvailability(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function usePutMyAvailabilityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.availabilityUpdated', silent: true },
    mutationFn: (input: Availability) => volunteersApi.putMyAvailability(api, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

// Avatar upload: 2-step presigned flow over the shared media helper, then
// PATCH /volunteers/me with the confirmed mediaId. Raw PUT bytes use plain
// axios (presigned URL — never the app client).
export function useAvatarUploadMutation(opts?: {
  onProgress?: (p: UploadProgress) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.avatarUpdated' },
    mutationFn: async (file: { name: string; type: string; size: number; bytes: unknown }) => {
      const putBytes = (url: string, body: unknown, onProgress?: (p: UploadProgress) => void) =>
        putPresignedBytes(url, body, file.type, file.size, onProgress);
      const mediaId = await uploadMedia(api, putBytes, file, file.bytes, {
        purpose: 'avatar',
        onProgress: opts?.onProgress,
      });
      return volunteersApi.patchVolunteerMe(api, { avatar: mediaId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

export function useBannerUploadMutation(opts?: {
  onProgress?: (p: UploadProgress) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.bannerUpdated' },
    mutationFn: async (file: { name: string; type: string; size: number; bytes: unknown }) => {
      const putBytes = (url: string, body: unknown, onProgress?: (p: UploadProgress) => void) =>
        putPresignedBytes(url, body, file.type, file.size, onProgress);
      const mediaId = await uploadMedia(api, putBytes, file, file.bytes, {
        purpose: 'volunteer_banner',
        onProgress: opts?.onProgress,
      });
      return volunteersApi.patchVolunteerMe(api, { banner: mediaId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}
