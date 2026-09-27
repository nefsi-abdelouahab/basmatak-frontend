import axios from 'axios';
import { z } from 'zod';
import type { AxiosInstance } from 'axios';
import { emailSchema, phoneSchema } from './auth';

// F13 org-account module: one typed function per profile/settings backend
// endpoint owned by this session (base `/api/v1`). Verified read-only against
// backend/src/organizations (controller + service + DTO), backend/src/users,
// backend/src/auth (logout-others/change-password), backend/src/notifications
// (notification-prefs DTO), backend/src/media:
// GET/PATCH /organizations/me (expanded fact set: type, registrationNumber,
// location{}, website, foundedYear, contact{}, focusDisciplines[],
// operatingScope, logoMediaId + coverMediaId, nullable annualReportMediaId,
// neutral publicProfile{enabled}), GET /organizations/me/profile-completion
// ({percent, missing, complete}, display-only), DELETE /organizations/me
// (soft-archive org + user, revokes sessions), PATCH /users/me (email/phone),
// POST /auth/change-password, GET/DELETE /users/me/sessions[/:sessionId],
// POST /auth/logout-others, GET/PATCH /notifications/preferences
// ({prefs} wrapper, partial OK), GET /media/:mediaId (owning-org read for
// cover/logo/report preview + report link), POST /media/uploads →
// {mediaId, uploadUrl} → PUT bytes → POST /media/:mediaId/confirm.
//
// NOTE: F3's lib/api/organizations.ts owns parallel me read/patch helpers —
// it is neither touched nor imported here. F13 defines its own functions in
// this module so the change stays file-disjoint (verified by path). Email,
// phone, change-password, and logout-others reuse F1's auth.ts import-only
// (same Deviation-5 pattern F2 uses); sessions/prefs shapes mirror F2's
// archived modules without importing them.

export const ORG_ACCOUNT_PHONE_PATTERN = /^\+?[0-9]{8,15}$/;
export const ORG_ACCOUNT_WEBSITE_PATTERN = /^https?:\/\/.+/;
const MONGO_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export const MAX_ACCOUNT_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ACCOUNT_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ACCOUNT_DOC_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type AccountAllowedMimes = readonly string[];

export function validateAccountFile(
  file: { type: string; size: number },
  allowed: AccountAllowedMimes,
): { ok: true } | { ok: false; reason: 'type' | 'size' } {
  if (!allowed.includes(file.type)) return { ok: false, reason: 'type' };
  if (file.size < 1 || file.size > MAX_ACCOUNT_UPLOAD_BYTES) return { ok: false, reason: 'size' };
  return { ok: true };
}

// Display-only org code. Never a route key, never a link target.
export function orgDisplayCode(registryId: string | undefined | null): string {
  if (!registryId || registryId.trim().length === 0) return '';
  return `ORG-${registryId}`;
}

const mongoId = z.string().regex(MONGO_ID_PATTERN);

export const OrgAccountSchema = z
  .object({
    registryId: z.string().optional(),
    slug: z.string().optional(),
    verificationStatus: z.string().optional(),
    nameAr: z.string().optional(),
    nameFr: z.string().optional(),
    description: z.string().optional(),
    logoMediaId: z.string().optional(),
    coverMediaId: z.string().optional(),
    annualReportMediaId: z.string().nullable().optional(),
    type: z.string().optional(),
    registrationNumber: z.string().optional(),
    location: z
      .object({
        wilayaId: z.string().optional(),
        municipalityId: z.string().optional(),
        address: z.string().optional(),
      })
      .passthrough()
      .optional(),
    website: z.string().optional(),
    foundedYear: z.number().optional(),
    contact: z
      .object({ email: z.string().optional(), phone: z.string().optional() })
      .passthrough()
      .optional(),
    focusDisciplines: z.array(z.string()).optional(),
    operatingScope: z.string().optional(),
    publicProfile: z.object({ enabled: z.boolean() }).passthrough().optional(),
  })
  .passthrough();

export type OrgAccount = z.infer<typeof OrgAccountSchema>;

export const UpdateOrgAccountInputSchema = z.object({
  nameAr: z.string().max(200).optional(),
  nameFr: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  logoMediaId: mongoId.nullable().optional(),
  coverMediaId: mongoId.nullable().optional(),
  annualReportMediaId: mongoId.nullable().optional(),
  type: z.string().optional(),
  registrationNumber: z.string().optional(),
  location: z
    .object({
      wilayaId: z.string().optional(),
      municipalityId: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  website: z.string().regex(ORG_ACCOUNT_WEBSITE_PATTERN).optional(),
  foundedYear: z.number().int().optional(),
  contact: z
    .object({
      email: z.string().email().optional(),
      phone: z.string().regex(ORG_ACCOUNT_PHONE_PATTERN).optional(),
    })
    .optional(),
  focusDisciplines: z.array(mongoId).optional(),
  operatingScope: z.string().optional(),
  publicProfile: z.object({ enabled: z.boolean() }).optional(),
});

export type UpdateOrgAccountInput = z.infer<typeof UpdateOrgAccountInputSchema>;

export const OrgAccountCompletionSchema = z.object({
  percent: z.number(),
  missing: z.array(z.string()),
  complete: z.boolean(),
});

export type OrgAccountCompletion = z.infer<typeof OrgAccountCompletionSchema>;

// Display-only view of the completion payload. No client-side completion
// math: percent + remaining fields come straight from the server.
export function completionView(completion: OrgAccountCompletion): {
  percent: number;
  complete: boolean;
  missing: string[];
} {
  const percent = Math.min(100, Math.max(0, Math.round(completion.percent)));
  return { percent, complete: completion.complete, missing: completion.missing };
}

export const AccountUserSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    phone: z.string().nullable().optional(),
    emailVerifiedAt: z.string().nullable().optional(),
  })
  .passthrough();

export type AccountUser = z.infer<typeof AccountUserSchema>;

export const UpdateAccountUserSchema = z.object({
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
});

export type UpdateAccountUser = z.infer<typeof UpdateAccountUserSchema>;

export const AccountSessionDeviceSchema = z
  .object({
    browser: z.string().optional(),
    os: z.string().optional(),
    device: z.string().optional(),
  })
  .passthrough();

export type AccountSessionDevice = z.infer<typeof AccountSessionDeviceSchema>;

export const AccountSessionSchema = z
  .object({
    id: z.string(),
    createdAt: z.string(),
    expiresAt: z.string(),
    lastUsedAt: z.string().nullable().optional(),
    device: AccountSessionDeviceSchema.nullable(),
    userAgent: z.string().nullable(),
    isCurrent: z.boolean(),
  })
  .passthrough();

export type AccountSession = z.infer<typeof AccountSessionSchema>;

// Human-readable device label from metadata; falls back to the raw
// user-agent tail, never empty.
export function sessionDeviceLabel(
  session: Pick<AccountSession, 'device' | 'userAgent'>,
): string {
  const parts = [session.device?.device, session.device?.os, session.device?.browser].filter(
    (p): p is string => typeof p === 'string' && p.length > 0,
  );
  if (parts.length > 0) return parts.join(' · ');
  if (session.userAgent && session.userAgent.length > 0) return session.userAgent.slice(0, 48);
  return 'Unknown device';
}

export const ACCOUNT_PREF_KEYS = [
  'applicationUpdates',
  'reviews',
  'verification',
  'system',
  'digest',
  'recordIssued',
] as const;

export type AccountPrefKey = (typeof ACCOUNT_PREF_KEYS)[number];

export const AccountPrefsSchema = z
  .object({
    applicationUpdates: z.boolean().optional(),
    reviews: z.boolean().optional(),
    verification: z.boolean().optional(),
    system: z.boolean().optional(),
    digest: z.boolean().optional(),
    recordIssued: z.boolean().optional(),
  })
  .passthrough();

export type AccountPrefs = z.infer<typeof AccountPrefsSchema>;

const AccountPrefsResponseSchema = z
  .object({ prefs: AccountPrefsSchema })
  .passthrough();

export const AccountMediaSchema = z
  .object({
    url: z.string().optional(),
    signedUrl: z.string().optional(),
  })
  .passthrough();

export type AccountMedia = z.infer<typeof AccountMediaSchema>;

// Resolve a viewable URL from an owning-org media read. Null means
// real-or-absent: callers render the neutral empty state (no placeholder).
export function accountMediaUrlOf(media: AccountMedia | undefined): string | null {
  if (!media) return null;
  return media.signedUrl ?? media.url ?? null;
}

export async function getAccountMedia(
  client: Pick<AxiosInstance, 'get'>,
  mediaId: string,
): Promise<AccountMedia> {
  const { data } = await client.get(`/media/${encodeURIComponent(mediaId)}`);
  return AccountMediaSchema.parse(data);
}

export const AccountUploadTicketSchema = z.object({
  mediaId: z.string(),
  uploadUrl: z.string().url(),
});

export type AccountUploadTicket = z.infer<typeof AccountUploadTicketSchema>;

export interface AccountUploadProgress {
  loaded: number;
  total?: number;
  percent: number;
}

type OrgHttpClient = Pick<AxiosInstance, 'get' | 'patch' | 'delete'>;
type MediaHttpClient = Pick<AxiosInstance, 'post'>;

export async function getOrgAccount(client: OrgHttpClient): Promise<OrgAccount> {
  const { data } = await client.get('/organizations/me');
  return OrgAccountSchema.parse(data);
}

export async function patchOrgAccount(
  client: OrgHttpClient,
  input: UpdateOrgAccountInput,
): Promise<OrgAccount> {
  const { data } = await client.patch('/organizations/me', input);
  return OrgAccountSchema.parse(data);
}

export async function getOrgAccountCompletion(
  client: OrgHttpClient,
): Promise<OrgAccountCompletion> {
  const { data } = await client.get('/organizations/me/profile-completion');
  return OrgAccountCompletionSchema.parse(data);
}

export async function deleteOrgAccount(
  client: OrgHttpClient,
): Promise<{ deleted: boolean; organizationId: string }> {
  const { data } = await client.delete('/organizations/me');
  return z.object({ deleted: z.boolean(), organizationId: z.string() }).parse(data);
}

export async function getAccountUser(client: OrgHttpClient): Promise<AccountUser> {
  const { data } = await client.get('/users/me');
  return AccountUserSchema.parse(data);
}

export async function patchAccountUser(
  client: OrgHttpClient,
  input: UpdateAccountUser,
): Promise<AccountUser> {
  const { data } = await client.patch('/users/me', input);
  return AccountUserSchema.parse(data);
}

export async function listAccountSessions(
  client: OrgHttpClient,
): Promise<AccountSession[]> {
  const { data } = await client.get('/users/me/sessions');
  return z.array(AccountSessionSchema).parse(data);
}

export async function revokeAccountSession(
  client: OrgHttpClient,
  sessionId: string,
): Promise<void> {
  await client.delete(`/users/me/sessions/${sessionId}`);
}

export async function getAccountPrefs(client: OrgHttpClient): Promise<AccountPrefs> {
  const { data } = await client.get('/notifications/preferences');
  return AccountPrefsResponseSchema.parse(data).prefs;
}

export async function patchAccountPrefs(
  client: OrgHttpClient,
  prefs: AccountPrefs,
): Promise<AccountPrefs> {
  const { data } = await client.patch('/notifications/preferences', { prefs });
  return AccountPrefsResponseSchema.parse(data).prefs;
}

export async function createAccountMediaUpload(
  client: MediaHttpClient,
  input: { filename: string; mimeType: string; size: number; purpose: string },
): Promise<AccountUploadTicket> {
  const { data } = await client.post('/media/uploads', input);
  return AccountUploadTicketSchema.parse(data);
}

export async function confirmAccountMediaUpload(
  client: MediaHttpClient,
  mediaId: string,
): Promise<void> {
  await client.post(`/media/${mediaId}/confirm`);
}

// Raw-bytes PUT goes straight at the presigned URL (never through the app
// axios instance — no auth headers, no /api/v1 base). `putBytes` is injected
// so unit tests never touch the network.
export async function putAccountBytes(
  putBytes: (
    url: string,
    body: unknown,
    onProgress?: (p: AccountUploadProgress) => void,
  ) => Promise<void>,
  uploadUrl: string,
  body: unknown,
  onProgress?: (p: AccountUploadProgress) => void,
): Promise<void> {
  await putBytes(uploadUrl, body, onProgress);
}

// Default byte-PUT over plain axios: presigned hosts must not receive the
// app client's auth headers or base URL.
export async function putPresignedAccountBytes(
  uploadUrl: string,
  body: unknown,
  contentType: string,
  fileSize: number,
  onProgress?: (p: AccountUploadProgress) => void,
): Promise<void> {
  await axios.put(uploadUrl, body, {
    headers: { 'Content-Type': contentType },
    onUploadProgress: (event) => {
      const total = event.total ?? fileSize;
      const percent = total > 0 ? Math.round(((event.loaded ?? 0) / total) * 100) : 0;
      onProgress?.({ loaded: event.loaded ?? 0, total, percent });
    },
  });
}

// Full 2-step flow: create → PUT bytes (progress) → confirm → mediaId. File
// type/size are validated before any network call.
export async function uploadAccountMedia(
  client: MediaHttpClient,
  putBytes: (
    url: string,
    body: unknown,
    onProgress?: (p: AccountUploadProgress) => void,
  ) => Promise<void>,
  file: { name: string; type: string; size: number },
  body: unknown,
  opts: {
    purpose: string;
    allowed: AccountAllowedMimes;
    onProgress?: (p: AccountUploadProgress) => void;
  },
): Promise<string> {
  const valid = validateAccountFile(file, opts.allowed);
  if (!valid.ok) throw new Error(`INVALID_FILE_${valid.reason.toUpperCase()}`);
  const ticket = await createAccountMediaUpload(client, {
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    purpose: opts.purpose,
  });
  await putAccountBytes(putBytes, ticket.uploadUrl, body, opts.onProgress);
  await confirmAccountMediaUpload(client, ticket.mediaId);
  return ticket.mediaId;
}
