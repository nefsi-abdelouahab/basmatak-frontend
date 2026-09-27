'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { mapToApiError } from '../lib/api/errors';
import { queryKeys } from '../lib/query/keys';
import * as orgOppsApi from '../lib/api/orgOpps';
import type {
  CreateOpportunityInput,
  CreatePositionInput,
  LifecycleAction,
  OwnOpportunityFilters,
  UpdateOpportunityInput,
  UpdatePositionInput,
  UploadProgress,
} from '../lib/api/orgOpps';

// F10 hook file (the session's single hook file per CONVENTIONS.md).
// Endpoints live in lib/api/orgOpps.ts (scoped readers, D1 pattern — no
// sibling-session imports); components consume this module. Keys come from
// the F0 factory (no keys.ts edits).

const DOMAIN = 'org-opportunities';

export function orgOppKeys() {
  return {
    list: (filters: OwnOpportunityFilters) => queryKeys.list(DOMAIN, { ...filters }),
    detail: (id: string) => queryKeys.detail(DOMAIN, id),
    categories: queryKeys.list(DOMAIN, { scope: 'skill-categories' }),
    wilayas: queryKeys.list(DOMAIN, { scope: 'wilayas' }),
    municipalities: (wilayaId: string) =>
      queryKeys.list(DOMAIN, { scope: 'municipalities', wilayaId }),
    publishGate: queryKeys.detail(DOMAIN, 'publish-gate'),
    orgGate: queryKeys.detail(DOMAIN, 'org-gate'),
  };
}

export function isOrgNotVerifiedError(err: unknown): boolean {
  return mapToApiError(err).code === 'ORG_NOT_VERIFIED';
}

export function isPublishGateLockedError(err: unknown): boolean {
  return mapToApiError(err).code === 'PUBLISH_GATE_LOCKED';
}

export function isPublishingDisabledError(err: unknown): boolean {
  return mapToApiError(err).code === 'PUBLISHING_DISABLED';
}

export function isFieldLockedError(err: unknown): boolean {
  return mapToApiError(err).code === 'OPPORTUNITY_FIELD_LOCKED';
}

function invalidateOppScope(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
}

export function useOwnOpportunitiesQuery(filters: OwnOpportunityFilters) {
  return useQuery({
    queryKey: orgOppKeys().list(filters),
    queryFn: () => orgOppsApi.listOwnOpportunities(api, filters),
    staleTime: 30_000,
    retry: false,
  });
}

export function useOwnOpportunityQuery(id: string | undefined) {
  return useQuery({
    queryKey: id ? orgOppKeys().detail(id) : queryKeys.detail(DOMAIN, 'none'),
    queryFn: () => orgOppsApi.getOwnOpportunity(api, id as string),
    enabled: typeof id === 'string' && id.length > 0,
    staleTime: 30_000,
    retry: false,
  });
}

export function useCreateOpportunityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOpportunityInput) => orgOppsApi.createOpportunity(api, input),
    onSuccess: () => {
      invalidateOppScope(queryClient);
    },
  });
}

export function usePatchOpportunityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ opportunityId, input }: { opportunityId: string; input: UpdateOpportunityInput }) =>
      orgOppsApi.patchOpportunity(api, opportunityId, input),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: orgOppKeys().detail(vars.opportunityId) });
      invalidateOppScope(queryClient);
    },
  });
}

export function useDeleteDraftOpportunityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (opportunityId: string) => orgOppsApi.deleteDraftOpportunity(api, opportunityId),
    onSuccess: () => {
      invalidateOppScope(queryClient);
    },
  });
}

export function useLifecycleActionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ opportunityId, action }: { opportunityId: string; action: LifecycleAction }) =>
      orgOppsApi.runLifecycleAction(api, opportunityId, action),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: orgOppKeys().detail(vars.opportunityId) });
      invalidateOppScope(queryClient);
    },
  });
}

export function useCreatePositionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ opportunityId, input }: { opportunityId: string; input: CreatePositionInput }) =>
      orgOppsApi.createPosition(api, opportunityId, input),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: orgOppKeys().detail(vars.opportunityId) });
    },
  });
}

export function usePatchPositionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      opportunityId,
      positionId,
      input,
    }: {
      opportunityId: string;
      positionId: string;
      input: UpdatePositionInput;
    }) => orgOppsApi.patchPosition(api, opportunityId, positionId, input),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: orgOppKeys().detail(vars.opportunityId) });
    },
  });
}

export function useDeletePositionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ opportunityId, positionId }: { opportunityId: string; positionId: string }) =>
      orgOppsApi.deletePosition(api, opportunityId, positionId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: orgOppKeys().detail(vars.opportunityId) });
    },
  });
}

export function useDuplicateOpportunityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => orgOppsApi.duplicateOpportunity(api, id),
    onSuccess: () => {
      invalidateOppScope(queryClient);
    },
  });
}

export function useOppSkillCategoriesQuery() {
  return useQuery({
    queryKey: orgOppKeys().categories,
    queryFn: () => orgOppsApi.listSkillCategories(api),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useOppWilayasQuery() {
  return useQuery({
    queryKey: orgOppKeys().wilayas,
    queryFn: () => orgOppsApi.listWilayas(api),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useOppMunicipalitiesQuery(wilayaId: string | undefined) {
  return useQuery({
    queryKey: wilayaId ? orgOppKeys().municipalities(wilayaId) : orgOppKeys().wilayas,
    queryFn: () => orgOppsApi.listMunicipalities(api, wilayaId as string),
    enabled: typeof wilayaId === 'string' && wilayaId.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function usePublishGateQuery() {
  return useQuery({
    queryKey: orgOppKeys().publishGate,
    queryFn: () => orgOppsApi.getPublishGate(api),
    staleTime: 30_000,
    retry: false,
  });
}

export function useOwnOrgGateQuery() {
  return useQuery({
    queryKey: orgOppKeys().orgGate,
    queryFn: () => orgOppsApi.getOwnOrgGate(api),
    staleTime: 60_000,
    retry: false,
  });
}

export interface OppCoverFile {
  name: string;
  type: string;
  size: number;
  blob: Blob;
}

export function useUploadOpportunityCover() {
  return async (
    file: OppCoverFile,
    opts?: { onProgress?: (p: UploadProgress) => void },
  ): Promise<string> =>
    orgOppsApi.uploadOpportunityCover(api, file, { onProgress: opts?.onProgress });
}
