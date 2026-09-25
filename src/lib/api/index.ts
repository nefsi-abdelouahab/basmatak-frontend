import { createApiClient } from './client';
import type { AxiosInstance } from 'axios';
import { defaultTokenHooks } from '../auth/storage';

export * from './client';
export * from './download';
export * from './errors';
export * from './session';
export * from './system';

const FALLBACK_BASE_URL = 'http://localhost:3000/api/v1';

// App singleton: every domain module (FB–FF) imports this instance — or a typed
// function built on it — and never constructs its own client.
export const api: AxiosInstance = createApiClient({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? FALLBACK_BASE_URL,
  hooks: defaultTokenHooks,
});
