'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { mapToApiError } from '../lib/api/errors';
import { queryKeys } from '../lib/query/keys';
import * as orgApi from '../lib/api/organizations';
import type {
  AllowedMimes,
  SubmitVerificationInput,
  UpdateOrganizationInput,
  UploadProgress,
} from '../lib/api/organizations';

// F3 hook file (the session's single hook file per CONVENTIONS.md).
// Endpoints live in lib/api/organizations.ts; components consume this module.

const DOMAIN = 'organization';

export function orgKeys() {
  return {
    me: queryKeys.detail(DOMAIN, 'me'),
    completion: queryKeys.detail(DOMAIN, 'completion'),
    verification: queryKeys.detail(DOMAIN, 'verification'),
    wilayas: queryKeys.list(DOMAIN, { scope: 'wilayas' }),
    municipalities: (wilayaId: string) =>
      queryKeys.list(DOMAIN, { scope: 'municipalities', wilayaId }),
  };
}

export function isEmailNotVerifiedError(err: unknown): boolean {
  return mapToApiError(err).code === 'EMAIL_NOT_VERIFIED';
}

export type VerificationView = 'pending' | 'verified' | 'rejected' | 'none';

export function verificationViewOf(status: string | undefined): VerificationView {
  if (status === 'verified') return 'verified';
  if (status === 'rejected') return 'rejected';
  if (status === 'pending') return 'pending';
  return 'none';
}

export function useOwnOrganizationQuery() {
  return useQuery({
    queryKey: orgKeys().me,
    queryFn: () => orgApi.getOwnOrganization(api),
    staleTime: 60_000,
    retry: false,
  });
}

export function useProfileCompletionQuery() {
  return useQuery({
    queryKey: orgKeys().completion,
    queryFn: () => orgApi.getProfileCompletion(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function useUpdateOrganizationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.orgProfileUpdated', silent: true },
    mutationFn: (input: UpdateOrganizationInput) => orgApi.updateOwnOrganization(api, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

export function useDeleteOrganizationMutation() {
  return useMutation({
    meta: { successKey: 'success.orgDeleted', silent: true },
    mutationFn: () => orgApi.deleteOwnOrganization(api),
  });
}

export function useVerificationStatusQuery() {
  return useQuery({
    queryKey: orgKeys().verification,
    queryFn: () => orgApi.getOrganizationVerificationStatus(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function useSubmitVerificationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.verificationSubmitted', silent: true },
    mutationFn: (input: SubmitVerificationInput) =>
      orgApi.submitOrganizationVerification(api, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys().verification });
      queryClient.invalidateQueries({ queryKey: orgKeys().me });
    },
  });
}

export function useWilayasQuery() {
  return useQuery({
    queryKey: orgKeys().wilayas,
    queryFn: () => orgApi.listWilayas(api),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useMunicipalitiesQuery(wilayaId: string | undefined) {
  return useQuery({
    queryKey: wilayaId ? orgKeys().municipalities(wilayaId) : orgKeys().wilayas,
    queryFn: () => orgApi.listMunicipalities(api, wilayaId as string),
    enabled: typeof wilayaId === 'string' && wilayaId.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export interface DossierFile {
  name: string;
  type: string;
  size: number;
  blob: Blob;
}

export function useUploadOrgMedia() {
  return async (
    file: DossierFile,
    opts: { purpose: string; allowed: AllowedMimes; onProgress?: (p: UploadProgress) => void },
  ): Promise<string> =>
    orgApi.uploadOrgMedia(api, file, {
      purpose: opts.purpose,
      allowed: opts.allowed,
      onProgress: opts.onProgress,
    });
}
