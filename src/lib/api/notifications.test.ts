import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  NOTIFICATION_PREF_KEYS,
  NOTIFICATION_TITLE_KEYS,
  getNotificationPreferences,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationIdOf,
  notificationTitleKey,
  patchNotificationPreferences,
} from './notifications';
import commonAr from '../../messages/common/ar.json';
import commonEn from '../../messages/common/en.json';

function stubClient(handlers: {
  get?: (url: string, config?: unknown) => unknown;
  patch?: (url: string, body?: unknown) => unknown;
  post?: (url: string, body?: unknown) => unknown;
}) {
  const get = vi.fn(async (url: string, config?: unknown) => ({ data: handlers.get?.(url, config) }));
  const patch = vi.fn(async (url: string, body?: unknown) => ({ data: handlers.patch?.(url, body) }));
  const post = vi.fn(async (url: string, body?: unknown) => ({ data: handlers.post?.(url, body) }));
  const client = { get, patch, post } as unknown as AxiosInstance;
  return { client, get, patch, post };
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

const row = {
  _id: '64f0000000000000000000n1',
  type: 'application.accepted',
  isRead: false,
  createdAt: '2026-09-10T00:00:00.000Z',
};

describe('notification bell api functions', () => {
  it('notificationIdOf prefers id over _id', () => {
    expect(notificationIdOf({ ...row, id: 'abc' })).toBe('abc');
    expect(notificationIdOf(row)).toBe('64f0000000000000000000n1');
    expect(notificationIdOf({})).toBe('');
  });

  it('listNotifications parses the cursor page', async () => {
    const { client, get } = stubClient({
      get: (url) =>
        url === '/notifications'
          ? { items: [row], nextCursor: null, limit: 10, total: 1 }
          : undefined,
    });
    const page = await listNotifications(client, { limit: 10 });
    expect(get).toHaveBeenCalledWith('/notifications', { params: { limit: 10 } });
    expect(page.total).toBe(1);
    expect(page.items[0]?.type).toBe('application.accepted');
  });

  it('getUnreadCount unwraps { count }', async () => {
    const { client } = stubClient({
      get: (url) => (url === '/notifications/unread-count' ? { count: 2 } : undefined),
    });
    await expect(getUnreadCount(client)).resolves.toBe(2);
  });

  it('markNotificationRead patches the row route', async () => {
    const { client, patch } = stubClient({
      patch: (url) =>
        url === '/notifications/64f0000000000000000000n1/read'
          ? { ...row, isRead: true }
          : undefined,
    });
    const updated = await markNotificationRead(client, '64f0000000000000000000n1');
    expect(patch).toHaveBeenCalledWith('/notifications/64f0000000000000000000n1/read');
    expect(updated.isRead).toBe(true);
  });

  it('markAllNotificationsRead unwraps { updated }', async () => {
    const { client, post } = stubClient({
      post: (url) => (url === '/notifications/read-all' ? { updated: 3 } : undefined),
    });
    await expect(markAllNotificationsRead(client)).resolves.toBe(3);
    expect(post).toHaveBeenCalledWith('/notifications/read-all');
  });
});

describe('notification titles', () => {
  const backendTypes = [
    'application.created',
    'application.accepted',
    'application.rejected',
    'application.withdrawn',
    'submission.submitted',
    'submission.verified',
    'submission.rejected',
    'participation.withdrawn',
    'participation.removed',
    'opportunity.cancelled',
    'opportunity.started',
    'org.verification.updated',
    'publish-gate.locked',
    'admin.notice',
  ];

  it('maps every backend domain event to human-readable en/ar copy', () => {
    expect(Object.keys(NOTIFICATION_TITLE_KEYS).sort()).toEqual(backendTypes.sort());
    for (const type of backendTypes) {
      const key = notificationTitleKey(type);
      expect(key).toBe(NOTIFICATION_TITLE_KEYS[type as keyof typeof NOTIFICATION_TITLE_KEYS]);
      expect(commonEn.nav.notificationTitles[key].trim().length).toBeGreaterThan(0);
      expect(commonAr.nav.notificationTitles[key].trim().length).toBeGreaterThan(0);
      // Titles are catalog copy, never the raw event name.
      expect(commonEn.nav.notificationTitles[key]).not.toBe(type);
      expect(commonAr.nav.notificationTitles[key]).not.toBe(type);
    }
  });

  it('uses neutral generic copy for missing or unknown types', () => {
    expect(notificationTitleKey(undefined)).toBe('generic');
    expect(notificationTitleKey(null)).toBe('generic');
    expect(notificationTitleKey('')).toBe('generic');
    expect(notificationTitleKey('not.a.real.event')).toBe('generic');
    expect(commonEn.nav.notificationTitles.generic).toBe('New notification');
    expect(commonAr.nav.notificationTitles.generic).toBe('إشعار جديد');
  });

  it('never derives a title from payload contents', () => {
    const row = {
      type: 'unknown.type',
      payload: { title: 'Raw payload title', message: 'Raw payload body' },
    };
    const key = notificationTitleKey(row.type);
    expect(key).toBe('generic');
    expect(commonEn.nav.notificationTitles[key]).not.toContain('Raw payload');
  });
});
