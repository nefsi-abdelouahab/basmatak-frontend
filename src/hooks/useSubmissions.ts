'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { mapToApiError } from '../lib/api/errors';
import { queryKeys } from '../lib/query/keys';
import * as submissionsApi from '../lib/api/submissions';
import type {
  CreateSubmissionInput,
  Submission,
  SubmitSubmissionInput,
  UpdateSubmissionInput,
} from '../lib/api/submissions';
import {
  isAllowedEvidenceLink,
  SUBMISSION_PURPOSE,
  validateEvidenceFile,
} from '../lib/api/submissions';
import { putPresignedBytes, uploadMedia, type UploadProgress } from '../lib/api/media';

// F7 hook file (the session's single hook file per CONVENTIONS.md).
// Endpoints live in lib/api/submissions.ts; file bytes flow through F2's
// lib/api/media.ts 2-step helper (import-only, deviation 1). Components fetch
// only via these hooks; keys come from the F0 factory (no keys.ts edits).

const DOMAIN = 'submit-contribution';

export function submissionKeys() {
  return {
    detail: (submissionId: string) => queryKeys.detail(DOMAIN, submissionId),
    mine: queryKeys.list(DOMAIN, { scope: 'mine' }),
  };
}

export function isConsentRequiredError(err: unknown): boolean {
  return mapToApiError(err).code === 'CONSENT_REQUIRED';
}

export function isConflictError(err: unknown): boolean {
  const mapped = mapToApiError(err);
  return mapped.statusCode === 409 || mapped.code === 'CONFLICT';
}

export function useSubmissionQuery(submissionId: string | undefined) {
  return useQuery({
    // NOTE: the disabled key must NOT collide with `submissionKeys().mine`
    // (a shared key would leak the list payload into `detail.data`).
    queryKey: submissionId ? submissionKeys().detail(submissionId) : queryKeys.detail(DOMAIN, 'none'),
    queryFn: () => submissionsApi.getSubmission(api, submissionId as string),
    enabled: typeof submissionId === 'string' && submissionId.length > 0,
    staleTime: 30_000,
    retry: false,
  });
}

export function useMySubmissionsQuery() {
  return useQuery({
    queryKey: submissionKeys().mine,
    queryFn: () => submissionsApi.listMySubmissions(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function useCreateSubmissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.submissionStarted', silent: true },
    mutationFn: ({
      participationId,
      input,
    }: {
      participationId: string;
      input?: CreateSubmissionInput;
    }) => submissionsApi.createSubmission(api, participationId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

export function usePatchSubmissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.draftSaved', silent: true },
    mutationFn: ({
      submissionId,
      input,
    }: {
      submissionId: string;
      input: UpdateSubmissionInput;
    }) => submissionsApi.patchSubmission(api, submissionId, input),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: submissionKeys().detail(vars.submissionId) });
      queryClient.invalidateQueries({ queryKey: submissionKeys().mine });
    },
  });
}

export function useSubmitSubmissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.contributionSubmitted', silent: true },
    mutationFn: ({
      submissionId,
      input,
    }: {
      submissionId: string;
      input?: SubmitSubmissionInput;
    }) => submissionsApi.submitSubmission(api, submissionId, input),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: submissionKeys().detail(vars.submissionId) });
      queryClient.invalidateQueries({ queryKey: submissionKeys().mine });
    },
  });
}

export function useCreateMediaLinkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.linkAdded', silent: true },
    mutationFn: async ({ url }: { url: string }) => {
      const check = isAllowedEvidenceLink(url);
      if (!check.ok) throw new Error(`INVALID_LINK_${check.reason.toUpperCase()}`);
      return submissionsApi.createMediaLink(api, { url: check.url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

export function useDeleteMediaMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successKey: 'success.fileRemoved', silent: true },
    mutationFn: (mediaId: string) => submissionsApi.deleteMedia(api, mediaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
    },
  });
}

export interface EvidenceFile {
  name: string;
  type: string;
  size: number;
  bytes: unknown;
}

// File-evidence uploader: validates (images/PDF ≤5 MB) then runs the shared
// F2 2-step flow (purpose `submission_evidence`, private by default) with
// per-file progress. Returns the confirmed mediaId; the caller patches the
// draft `evidence` array itself.
export function useUploadEvidence() {
  return async (
    file: EvidenceFile,
    opts?: { onProgress?: (p: UploadProgress) => void },
  ): Promise<string> => {
    const check = validateEvidenceFile(file);
    if (!check.ok) throw new Error(`INVALID_FILE_${check.reason.toUpperCase()}`);
    const putBytes = (url: string, body: unknown, onProgress?: (p: UploadProgress) => void) =>
      putPresignedBytes(url, body, file.type, file.size, onProgress);
    return uploadMedia(api, putBytes, file, file.bytes, {
      purpose: SUBMISSION_PURPOSE,
      onProgress: opts?.onProgress,
    });
  };
}

// Keep the public type surface explicit for component authors.
export type { Submission, UploadProgress };
