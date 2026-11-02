'use client';

import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { notify, type NotifySuccessKey } from '@/lib/notify';

// Per-mutation toast wiring lives on the mutation itself:
// - meta.successKey: catalog key shown after success (string or a function of
//   the mutation variables/result for lifecycle, status and toggle actions).
// - meta.silent: suppress the automatic error toast when the screen already
//   renders the failure inline. Success toasts still fire.
export interface MutationToastMeta {
  successKey?:
    | NotifySuccessKey
    | ((
        variables: unknown,
        data: unknown,
      ) => NotifySuccessKey | null | undefined);
  silent?: boolean;
}

function successKeyFor(
  meta: MutationToastMeta | undefined,
  variables: unknown,
  data: unknown,
): NotifySuccessKey | null {
  if (!meta?.successKey) return null;
  if (typeof meta.successKey === 'function') {
    return meta.successKey(variables, data) ?? null;
  }
  return meta.successKey;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const mutationCache = new MutationCache({
      onSuccess: (data, variables, _context, mutation) => {
        const key = successKeyFor(
          mutation.meta as MutationToastMeta | undefined,
          variables,
          data,
        );
        if (key) notify.success(key);
      },
      onError: (error, _variables, _context, mutation) => {
        const meta = mutation.meta as MutationToastMeta | undefined;
        if (meta?.silent) return;
        notify.fromError(error);
      },
    });

    return new QueryClient({
      mutationCache,
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          retry: 1,
          refetchOnWindowFocus: false,
        },
      },
    });
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
