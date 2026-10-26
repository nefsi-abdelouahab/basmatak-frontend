import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryStore,
  defaultTokenHooks,
  notifySessionExpired,
  subscribeAuthCleared,
  subscribeSessionExpired,
} from './storage';

const authCleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of authCleanups.splice(0)) cleanup();
  defaultTokenHooks.clearTokens();
});

describe('token storage', () => {
  it('round-trips a token pair in the memory store', () => {
    const store = createMemoryStore();
    expect(store.get()).toBeNull();
    store.set({ accessToken: 'a', refreshToken: 'r' });
    expect(store.get()).toEqual({ accessToken: 'a', refreshToken: 'r' });
    store.clear();
    expect(store.get()).toBeNull();
  });

  it('exposes the pair through the default hooks', () => {
    defaultTokenHooks.setTokens({ accessToken: 'a', refreshToken: 'r' });
    expect(defaultTokenHooks.getAccessToken()).toBe('a');
    expect(defaultTokenHooks.getRefreshToken()).toBe('r');
    defaultTokenHooks.clearTokens();
    expect(defaultTokenHooks.getAccessToken()).toBeNull();
  });

  it('notifies subscribers and supports unsubscribe', () => {
    const first = vi.fn();
    const second = vi.fn(() => {
      throw new Error('listener failure');
    });
    const third = vi.fn();
    const offFirst = subscribeSessionExpired(first);
    const offSecond = subscribeSessionExpired(second);
    const offThird = subscribeSessionExpired(third);
    notifySessionExpired();
    // A throwing listener must not break the remaining subscribers.
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(third).toHaveBeenCalledTimes(1);
    offFirst();
    offSecond();
    offThird();
    notifySessionExpired();
    expect(first).toHaveBeenCalledTimes(1);
    expect(third).toHaveBeenCalledTimes(1);
  });

  it('notifies auth-cleared subscribers after clearing the token store', () => {
    let tokenSeenByListener: string | null | undefined;
    const listener = vi.fn(() => {
      tokenSeenByListener = defaultTokenHooks.getAccessToken();
    });
    authCleanups.push(subscribeAuthCleared(listener));

    defaultTokenHooks.setTokens({ accessToken: 'a', refreshToken: 'r' });
    defaultTokenHooks.clearTokens();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(tokenSeenByListener).toBeNull();
    expect(defaultTokenHooks.getAccessToken()).toBeNull();
  });

  it('stops auth-cleared notifications after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAuthCleared(listener);
    unsubscribe();

    defaultTokenHooks.clearTokens();

    expect(listener).not.toHaveBeenCalled();
  });

  it('isolates a throwing auth-cleared listener', () => {
    const throwing = vi.fn(() => {
      throw new Error('listener failure');
    });
    const healthy = vi.fn();
    authCleanups.push(subscribeAuthCleared(throwing));
    authCleanups.push(subscribeAuthCleared(healthy));

    expect(() => defaultTokenHooks.clearTokens()).not.toThrow();
    expect(throwing).toHaveBeenCalledTimes(1);
    expect(healthy).toHaveBeenCalledTimes(1);
  });

  it('does not notify auth-cleared subscribers on setTokens', () => {
    const listener = vi.fn();
    authCleanups.push(subscribeAuthCleared(listener));

    defaultTokenHooks.setTokens({ accessToken: 'a', refreshToken: 'r' });

    expect(listener).not.toHaveBeenCalled();
    expect(defaultTokenHooks.getAccessToken()).toBe('a');
  });
});
