import type {
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryStore, subscribeSessionExpired } from '../auth/storage';
import type { TokenHooks, TokenPair } from '../auth/storage';
import { createApiClient } from './client';
import { ApiError } from './errors';

const BASE_URL = 'http://localhost:3000/api/v1';

function ok(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}

function fail(config: InternalAxiosRequestConfig, status: number, data: unknown): unknown {
  return {
    isAxiosError: true,
    message: `Request failed with status code ${status}`,
    config,
    request: {},
    response: { status, data, headers: {}, config },
  };
}

function setup(initial: TokenPair | null = { accessToken: 'old-a', refreshToken: 'old-r' }) {
  const store = createMemoryStore(initial);
  const hooks: TokenHooks = {
    getAccessToken: () => store.get()?.accessToken ?? null,
    getRefreshToken: () => store.get()?.refreshToken ?? null,
    setTokens: (pair) => store.set(pair),
    clearTokens: () => store.clear(),
  };
  const expired: string[] = [];
  const unsubscribe = subscribeSessionExpired(() => {
    expired.push('expired');
  });
  return { store, hooks, expired, unsubscribe };
}

describe('api client interceptors', () => {
  it('attaches the JWT to outgoing requests', async () => {
    const { hooks, unsubscribe } = setup();
    try {
      const seen: Array<string | undefined> = [];
      const client = createApiClient({
        baseURL: BASE_URL,
        hooks,
        adapter: async (config) => {
          seen.push(config.headers.get('Authorization') as string | undefined);
          return ok(config, { ok: true });
        },
      });
      await client.get('/protected');
      expect(seen).toEqual(['Bearer old-a']);
    } finally {
      unsubscribe();
    }
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const { store, hooks, expired, unsubscribe } = setup();
    try {
      const refresh = vi.fn(async () => ({ accessToken: 'new-a', refreshToken: 'new-r' }));
      const seen: string[] = [];
      let calls = 0;
      const client = createApiClient({
        baseURL: BASE_URL,
        hooks,
        refreshTransport: refresh,
        adapter: async (config) => {
          calls += 1;
          seen.push(config.headers.get('Authorization') as string);
          if (calls === 1) throw fail(config, 401, { statusCode: 401, code: 'UNAUTHORIZED' });
          return ok(config, { ok: true });
        },
      });
      const { data } = await client.get('/protected');
      expect(data).toEqual({ ok: true });
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(refresh).toHaveBeenCalledWith(BASE_URL, 'old-r');
      expect(store.get()).toEqual({ accessToken: 'new-a', refreshToken: 'new-r' });
      expect(seen).toEqual(['Bearer old-a', 'Bearer new-a']);
      expect(expired).toEqual([]);
    } finally {
      unsubscribe();
    }
  });

  it('shares one in-flight refresh across concurrent 401s', async () => {
    const { hooks, unsubscribe } = setup();
    try {
      let release!: (pair: TokenPair) => void;
      const gate = new Promise<TokenPair>((resolve) => {
        release = resolve;
      });
      const refresh = vi.fn(() => gate);
      let calls = 0;
      const client = createApiClient({
        baseURL: BASE_URL,
        hooks,
        refreshTransport: refresh,
        adapter: async (config) => {
          calls += 1;
          if (calls <= 2) throw fail(config, 401, { statusCode: 401, code: 'UNAUTHORIZED' });
          return ok(config, { ok: true });
        },
      });
      const first = client.get('/a');
      const second = client.get('/b');
      await new Promise((resolve) => setTimeout(resolve, 10));
      release({ accessToken: 'new-a', refreshToken: 'new-r' });
      const [r1, r2] = await Promise.all([first, second]);
      expect(r1.data).toEqual({ ok: true });
      expect(r2.data).toEqual({ ok: true });
      expect(refresh).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it('logs out and notifies when refresh fails', async () => {
    const { store, hooks, expired, unsubscribe } = setup();
    try {
      const refresh = vi.fn(async (): Promise<TokenPair> => {
        throw new Error('refresh denied');
      });
      const client = createApiClient({
        baseURL: BASE_URL,
        hooks,
        refreshTransport: refresh,
        adapter: async (config) => {
          throw fail(config, 401, {
            statusCode: 401,
            code: 'REFRESH_TOKEN_REUSE_DETECTED',
          });
        },
      });
      const error = await client.get('/protected').catch((err: unknown) => err);
      expect(error).toBeInstanceOf(ApiError);
      expect(store.get()).toBeNull();
      expect(expired).toEqual(['expired']);
    } finally {
      unsubscribe();
    }
  });

  it('expires immediately when no refresh token is stored', async () => {
    const hooks: TokenHooks = {
      getAccessToken: () => 'orphan-a',
      getRefreshToken: () => null,
      setTokens: () => undefined,
      clearTokens: () => undefined,
    };
    const expired: string[] = [];
    const unsubscribe = subscribeSessionExpired(() => {
      expired.push('expired');
    });
    try {
      const refresh = vi.fn(async () => ({ accessToken: 'x', refreshToken: 'y' }));
      const client = createApiClient({
        baseURL: BASE_URL,
        hooks,
        refreshTransport: refresh,
        adapter: async (config) => {
          throw fail(config, 401, { statusCode: 401, code: 'UNAUTHORIZED' });
        },
      });
      await expect(client.get('/protected')).rejects.toBeInstanceOf(ApiError);
      expect(refresh).not.toHaveBeenCalled();
      expect(expired).toEqual(['expired']);
    } finally {
      unsubscribe();
    }
  });

  it('does not retry the refresh endpoint itself', async () => {
    const { hooks, unsubscribe } = setup();
    try {
      const refresh = vi.fn(async () => ({ accessToken: 'x', refreshToken: 'y' }));
      const client = createApiClient({
        baseURL: BASE_URL,
        hooks,
        refreshTransport: refresh,
        adapter: async (config) => {
          throw fail(config, 401, { statusCode: 401, code: 'UNAUTHORIZED' });
        },
      });
      await expect(client.get('/auth/refresh')).rejects.toBeInstanceOf(ApiError);
      expect(refresh).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it('passes non-401 failures through mapped', async () => {
    const { hooks, unsubscribe } = setup();
    try {
      const client = createApiClient({
        baseURL: BASE_URL,
        hooks,
        adapter: async (config) => {
          throw fail(config, 404, { statusCode: 404, code: 'NOT_FOUND', message: 'Gone.' });
        },
      });
      const error = await client.get('/missing').catch((err: unknown) => err);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe('NOT_FOUND');
      expect((error as ApiError).message).toBe('Gone.');
    } finally {
      unsubscribe();
    }
  });
});
