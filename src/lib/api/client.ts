import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { notifySessionExpired, type TokenHooks, type TokenPair } from '../auth/storage';
import { mapToApiError } from './errors';
import { refreshSession } from './session';

export const REFRESH_PATH = '/auth/refresh';

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

export interface ApiClientOptions {
  baseURL: string;
  hooks: TokenHooks;
  refreshPath?: string;
  /** Injected in tests to avoid network; the app uses the default transport. */
  adapter?: AxiosRequestConfig['adapter'];
  /** Injected in tests; defaults to POST <baseURL>/auth/refresh. */
  refreshTransport?: (baseURL: string, refreshToken: string) => Promise<TokenPair>;
}

// Single axios instance per app: JWT attach, exactly-once 401 refresh-and-retry
// (concurrent 401s share one in-flight refresh), refresh-failure logout.
export function createApiClient(options: ApiClientOptions): AxiosInstance {
  const {
    baseURL,
    hooks,
    refreshPath = REFRESH_PATH,
    adapter,
    refreshTransport = refreshSession,
  } = options;
  const instance = axios.create({ baseURL, adapter });

  instance.interceptors.request.use((config) => {
    const token = hooks.getAccessToken();
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
    return config;
  });

  let inflightRefresh: Promise<TokenPair> | null = null;

  const expire = (error: unknown): never => {
    hooks.clearTokens();
    notifySessionExpired();
    throw mapToApiError(error);
  };

  instance.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (!axios.isAxiosError(error)) throw mapToApiError(error);
      const original = error.config as RetriableConfig | undefined;
      const status = error.response?.status;
      const isRefreshCall =
        typeof original?.url === 'string' && original.url.endsWith(refreshPath);
      if (status !== 401 || !original || original._retried || isRefreshCall) {
        if (status === 401) expire(error);
        throw mapToApiError(error);
      }
      const refreshToken = hooks.getRefreshToken();
      if (refreshToken === null) {
        hooks.clearTokens();
        notifySessionExpired();
        throw mapToApiError(error);
      }
      try {
        if (!inflightRefresh) {
          inflightRefresh = refreshTransport(baseURL, refreshToken).finally(() => {
            inflightRefresh = null;
          });
        }
        const pair = await inflightRefresh;
        hooks.setTokens(pair);
        original._retried = true;
        original.headers.set('Authorization', `Bearer ${pair.accessToken}`);
        return instance.request(original);
      } catch {
        expire(error);
      }
    },
  );

  return instance;
}
