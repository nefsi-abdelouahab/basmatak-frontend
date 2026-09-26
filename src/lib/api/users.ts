import { z } from 'zod';
import type { AxiosInstance } from 'axios';
import { emailSchema, phoneSchema } from './auth';

// F2 users module: own account endpoints (base `/api/v1`). Verified read-only
// against backend/src/users + backend/src/auth (auth.service listSessions):
// - GET/PATCH /users/me (UpdateMeDto: contact fields ONLY — email/phone)
// - DELETE /users/me (soft delete, 204)
// - GET /users/me/sessions → [{id, createdAt, expiresAt, lastUsedAt?,
//   device {browser?, os?, device?} | null, userAgent | null, isCurrent}]
// - DELETE /users/me/sessions/:sessionId (204)
// Email/phone validation reuses F1's schemas (import-only, never redefined).

export const UpdateUsersMeSchema = z.object({
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
});

export type UpdateUsersMe = z.infer<typeof UpdateUsersMeSchema>;

export const UsersMeSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    phone: z.string().nullable().optional(),
    emailVerifiedAt: z.string().nullable().optional(),
  })
  .passthrough();

export type UsersMe = z.infer<typeof UsersMeSchema>;

export const SessionDeviceSchema = z
  .object({
    browser: z.string().optional(),
    os: z.string().optional(),
    device: z.string().optional(),
  })
  .passthrough();

export type SessionDevice = z.infer<typeof SessionDeviceSchema>;

export const UserSessionSchema = z
  .object({
    id: z.string(),
    createdAt: z.string(),
    expiresAt: z.string(),
    lastUsedAt: z.string().nullable().optional(),
    device: SessionDeviceSchema.nullable(),
    userAgent: z.string().nullable(),
    isCurrent: z.boolean(),
  })
  .passthrough();

export type UserSession = z.infer<typeof UserSessionSchema>;

// Human-readable device label from metadata; falls back to the raw
// user-agent tail, never empty.
export function deviceLabel(session: Pick<UserSession, 'device' | 'userAgent'>): string {
  const parts = [session.device?.device, session.device?.os, session.device?.browser].filter(
    (p): p is string => typeof p === 'string' && p.length > 0,
  );
  if (parts.length > 0) return parts.join(' · ');
  if (session.userAgent && session.userAgent.length > 0) return session.userAgent.slice(0, 48);
  return 'Unknown device';
}

type HttpClient = Pick<AxiosInstance, 'get' | 'patch' | 'delete'>;

export async function getUsersMe(client: HttpClient): Promise<UsersMe> {
  const { data } = await client.get('/users/me');
  return UsersMeSchema.parse(data);
}

export async function patchUsersMe(
  client: HttpClient,
  input: UpdateUsersMe,
): Promise<UsersMe> {
  const { data } = await client.patch('/users/me', input);
  return UsersMeSchema.parse(data);
}

export async function deleteUsersMe(client: HttpClient): Promise<void> {
  await client.delete('/users/me');
}

export async function listMySessions(client: HttpClient): Promise<UserSession[]> {
  const { data } = await client.get('/users/me/sessions');
  return z.array(UserSessionSchema).parse(data);
}

export async function deleteMySession(client: HttpClient, sessionId: string): Promise<void> {
  await client.delete(`/users/me/sessions/${sessionId}`);
}
