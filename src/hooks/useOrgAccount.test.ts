import { describe, expect, it } from 'vitest';
import { orgAccountKeys } from './useOrgAccount';

describe('orgAccountKeys', () => {
  it('namespaces every key under the org-account domain', () => {
    const keys = orgAccountKeys();
    for (const key of [keys.me, keys.completion, keys.user, keys.sessions, keys.prefs]) {
      expect(key[0]).toBe('org-account');
    }
    expect(keys.me).not.toEqual(keys.completion);
    expect(keys.media('m1')[0]).toBe('org-account');
    expect(keys.media('m1')).not.toEqual(keys.media('m2'));
  });

  it('never collides with sibling or archived hook domains', () => {
    const keys = orgAccountKeys();
    for (const key of [keys.me, keys.completion, keys.user, keys.sessions, keys.prefs]) {
      expect(key[0]).not.toBe('organization');
      expect(key[0]).not.toBe('account-settings');
      expect(key[0]).not.toBe('org-workspace');
    }
  });
});
