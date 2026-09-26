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

type HttpClient = Pick<AxiosInstance, 'get' | 'patch'>;

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
