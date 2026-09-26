import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  NOTIFICATION_PREF_KEYS,
  getNotificationPreferences,
  patchNotificationPreferences,
} from './notifications';

function stubClient(handlers: {
  get?: (url: string) => unknown;
  patch?: (url: string, body?: unknown) => unknown;
}) {
  const get = vi.fn(async (url: string) => ({ data: handlers.get?.(url) }));
  const patch = vi.fn(async (url: string, body?: unknown) => ({ data: handlers.patch?.(url, body) }));
  const client = { get, patch } as unknown as AxiosInstance;
  return { client, patch };
}

const allOn = Object.fromEntries(NOTIFICATION_PREF_KEYS.map((k) => [k, true]));

describe('notification preferences api functions', () => {
  it('getNotificationPreferences unwraps { prefs }', async () => {
    const { client } = stubClient({
      get: (url) => (url === '/notifications/preferences' ? { prefs: allOn } : undefined),
    });
    const prefs = await getNotificationPreferences(client);
    expect(prefs).toMatchObject({ applicationUpdates: true, recordIssued: true });
  });

  it('patchNotificationPreferences wraps partial prefs in { prefs }', async () => {
    const { client, patch } = stubClient({
      patch: (url, body) =>
        url === '/notifications/preferences'
          ? { prefs: { ...allOn, ...(body as { prefs: object }).prefs } }
          : undefined,
    });
    const prefs = await patchNotificationPreferences(client, { digest: false });
    expect(patch).toHaveBeenCalledWith('/notifications/preferences', {
      prefs: { digest: false },
    });
    expect(prefs.digest).toBe(false);
    expect(prefs.system).toBe(true);
  });
});
