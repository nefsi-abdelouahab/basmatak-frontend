'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query/keys';
import * as portfolioApi from '../lib/api/portfolio';
import type {
  CreatePortfolioItem,
  PortfolioVisibility,
  UpdatePortfolioItem,
} from '../lib/api/portfolio';
import { putPresignedBytes, type UploadProgress } from '../lib/api/media';

// F8 portfolio hook file: own portfolio list (stored order), CRUD with
// typeLabel/tags metadata, atomic reorder, 2-step file attach with progress.
// Components fetch only via these hooks; keys come from the F0 factory (no
// keys.ts edits). Upload composes the shared F2 media primitives
// import-only (purpose `portfolio_item`).

const DOMAIN = 'volunteer-portfolio';

export function useMyPortfolioQuery() {
  return useQuery({
    queryKey: queryKeys.list(DOMAIN),
    queryFn: () => portfolioApi.listMyPortfolio(api),
    staleTime: 30_000,
    retry: false,
  });
}

function useInvalidatePortfolio() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.domain(DOMAIN) });
  };
}

export function useCreatePortfolioItemMutation() {
  const invalidate = useInvalidatePortfolio();
  return useMutation({
    mutationFn: (input: CreatePortfolioItem) => portfolioApi.createPortfolioItem(api, input),
    onSuccess: () => invalidate(),
  });
}

export function usePatchPortfolioItemMutation() {
  const invalidate = useInvalidatePortfolio();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: UpdatePortfolioItem }) =>
      portfolioApi.patchPortfolioItem(api, itemId, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeletePortfolioItemMutation() {
  const invalidate = useInvalidatePortfolio();
  return useMutation({
    mutationFn: (itemId: string) => portfolioApi.deletePortfolioItem(api, itemId),
    onSuccess: () => invalidate(),
  });
}

export function useReorderPortfolioMutation() {
  const invalidate = useInvalidatePortfolio();
  return useMutation({
    mutationFn: (itemIds: string[]) => portfolioApi.reorderPortfolio(api, { itemIds }),
    onSuccess: () => invalidate(),
  });
}

// File attach: 2-step presigned flow over the shared media helper, then the
// caller stores the confirmed mediaId on its create/patch payload. Raw PUT
// bytes use plain axios (presigned URL — never the app client).
export function usePortfolioUploadMutation(opts?: {
  visibility?: PortfolioVisibility;
  onProgress?: (p: UploadProgress) => void;
}) {
  return useMutation({
    mutationFn: async (file: { name: string; type: string; size: number; bytes: unknown }) => {
      const putBytes = (url: string, body: unknown, onProgress?: (p: UploadProgress) => void) =>
        putPresignedBytes(url, body, file.type, file.size, onProgress);
      return portfolioApi.uploadPortfolioFile(api, putBytes, file, file.bytes, {
        visibility: opts?.visibility,
        onProgress: opts?.onProgress,
      });
    },
  });
}
