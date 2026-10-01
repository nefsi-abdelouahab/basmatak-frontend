import { z } from 'zod';
import type { AxiosInstance } from 'axios';

// F2 notifications module: preference endpoints (base `/api/v1`). Verified
// read-only against backend/src/notifications (notification-prefs DTO):
// - GET /notifications/preferences → {prefs: {...}} (all default ON)
// - PATCH /notifications/preferences takes `{ prefs: {...} }` (partial OK)
// Keys: applicationUpdates, reviews, verification, system, digest,
// recordIssued.

export const NOTIFICATION_PREF_KEYS = [
  'applicationUpdates',
  'reviews',
  'verification',
  'system',
  'digest',
  'recordIssued',
] as const;

export type NotificationPrefKey = (typeof NOTIFICATION_PREF_KEYS)[number];

export const NotificationPrefsSchema = z
  .object({
    applicationUpdates: z.boolean().optional(),
    reviews: z.boolean().optional(),
    verification: z.boolean().optional(),
    system: z.boolean().optional(),
    digest: z.boolean().optional(),
    recordIssued: z.boolean().optional(),
  })
  .passthrough();

export type NotificationPrefs = z.infer<typeof NotificationPrefsSchema>;

const PreferencesResponseSchema = z
  .object({
    prefs: NotificationPrefsSchema,
  })
  .passthrough();

export const NotificationItemSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    type: z.string().optional(),
    isRead: z.boolean().optional(),
    readAt: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    payload: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .passthrough();

export type NotificationItem = z.infer<typeof NotificationItemSchema>;

const NotificationPageSchema = z
  .object({
    items: z.array(NotificationItemSchema),
    nextCursor: z.string().nullable().optional(),
    limit: z.number().optional(),
    total: z.number(),
    page: z.number().optional(),
    pages: z.number().optional(),
  })
  .passthrough();

export type NotificationPage = z.infer<typeof NotificationPageSchema>;

const UnreadCountSchema = z.object({ count: z.number() }).passthrough();

const ReadAllSchema = z.object({ updated: z.number() }).passthrough();

export function notificationIdOf(item: NotificationItem): string {
  return item.id ?? item._id ?? '';
}

type HttpClient = Pick<AxiosInstance, 'get' | 'patch' | 'post'>;

export async function getNotificationPreferences(
  client: HttpClient,
): Promise<NotificationPrefs> {
  const { data } = await client.get('/notifications/preferences');
  return PreferencesResponseSchema.parse(data).prefs;
}

export async function patchNotificationPreferences(
  client: HttpClient,
  prefs: NotificationPrefs,
): Promise<NotificationPrefs> {
  const { data } = await client.patch('/notifications/preferences', { prefs });
  return PreferencesResponseSchema.parse(data).prefs;
}

// Bell wiring (verified read-only against backend/src/notifications):
// - GET /notifications/unread-count → `{ count }`
// - GET /notifications (`limit`/`cursor`) → CursorPage (newest first)
// - PATCH /notifications/:notificationId/read → updated row
// - POST /notifications/read-all → `{ updated }`
// Rows carry `{ type, isRead, readAt?, createdAt }` — no title/body fields
// exist, so surfaces render the real `type` + date, never invented copy.
export async function listNotifications(
  client: HttpClient,
  params?: { limit?: number; cursor?: string },
): Promise<NotificationPage> {
  const { data } = await client.get('/notifications', { params });
  return NotificationPageSchema.parse(data);
}

export async function getUnreadCount(client: HttpClient): Promise<number> {
  const { data } = await client.get('/notifications/unread-count');
  return UnreadCountSchema.parse(data).count;
}

export async function markNotificationRead(
  client: HttpClient,
  notificationId: string,
): Promise<NotificationItem> {
  const { data } = await client.patch(
    `/notifications/${encodeURIComponent(notificationId)}/read`,
  );
  return NotificationItemSchema.parse(data);
}

export async function markAllNotificationsRead(client: HttpClient): Promise<number> {
  const { data } = await client.post('/notifications/read-all');
  return ReadAllSchema.parse(data).updated;
}
