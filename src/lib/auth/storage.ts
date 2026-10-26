// Token storage behind an interface: memory-first, localStorage when available
// (SSR-safe — no window access at module scope). A storage-backend swap later
// (e.g. httpOnly cookies) lands here without touching call sites.

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenStore {
  get(): TokenPair | null;
  set(pair: TokenPair): void;
  clear(): void;
}

export interface TokenHooks {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  setTokens(pair: TokenPair): void;
  clearTokens(): void;
}

const STORAGE_KEY = 'basmatak.auth.tokens';

export function createMemoryStore(initial: TokenPair | null = null): TokenStore {
  let current = initial;
  return {
    get: () => current,
    set: (pair) => {
      current = pair;
    },
    clear: () => {
      current = null;
    },
  };
}

function createBrowserStore(): TokenStore | null {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null;
  const storage = window.localStorage;
  return {
    get: () => {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<TokenPair>;
        if (typeof parsed.accessToken === 'string' && typeof parsed.refreshToken === 'string') {
          return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
        }
        return null;
      } catch {
        return null;
      }
    },
    set: (pair) => {
      storage.setItem(STORAGE_KEY, JSON.stringify(pair));
    },
    clear: () => {
      storage.removeItem(STORAGE_KEY);
    },
  };
}

export const defaultTokenStore: TokenStore = createBrowserStore() ?? createMemoryStore();

// Auth-cleared pub/sub: logout and refresh-failure both call clearTokens().
// Chat history must be cleared in both cases without coupling the chat hook to
// useAuth (and without editing another session's hook).
export type AuthClearedListener = () => void;

const authClearedListeners = new Set<AuthClearedListener>();

export function subscribeAuthCleared(listener: AuthClearedListener): () => void {
  authClearedListeners.add(listener);
  return () => {
    authClearedListeners.delete(listener);
  };
}

export function notifyAuthCleared(): void {
  for (const listener of authClearedListeners) {
    try {
      listener();
    } catch {
      // A failing listener must not break other subscribers or token clearing.
    }
  }
}

export const defaultTokenHooks: TokenHooks = {
  getAccessToken: () => defaultTokenStore.get()?.accessToken ?? null,
  getRefreshToken: () => defaultTokenStore.get()?.refreshToken ?? null,
  setTokens: (pair) => defaultTokenStore.set(pair),
  clearTokens: () => {
    defaultTokenStore.clear();
    notifyAuthCleared();
  },
};

// Session-expired pub/sub: the API client notifies; the shell redirects to sign-in.
export type SessionExpiredListener = () => void;

const listeners = new Set<SessionExpiredListener>();

export function subscribeSessionExpired(listener: SessionExpiredListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifySessionExpired(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A failing listener must not break other subscribers or the API client.
    }
  }
}
