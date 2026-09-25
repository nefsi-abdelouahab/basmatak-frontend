import { describe, expect, it, vi } from 'vitest';
import {
  createMemoryStore,
  defaultTokenHooks,
  notifySessionExpired,
  subscribeSessionExpired,
} from './storage';

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
});
