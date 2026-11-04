'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query/keys';
import { fetchPublicProof, normalizeVerificationCode } from '../lib/api/verify';

// Public certificate verification hook. One code -> one cached proof; a 404 is
// a final answer (the code was replaced or never existed), so retries stay off.
// Keys use the F0 factory under the `verify` domain (no keys.ts edit).

const DOMAIN = 'verify';

export function verifyKeys() {
  return {
    proof: (code: string) =>
      queryKeys.detail(DOMAIN, normalizeVerificationCode(code)),
  };
}

export function useVerifyQuery(code: string) {
  const normalized = normalizeVerificationCode(code);
  return useQuery({
    queryKey: verifyKeys().proof(normalized),
    queryFn: () => fetchPublicProof(api, normalized),
    staleTime: 60_000,
    retry: false,
    enabled: normalized !== '',
  });
}
