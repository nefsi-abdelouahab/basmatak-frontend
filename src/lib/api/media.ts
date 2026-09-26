import { z } from 'zod';
import type { AxiosInstance } from 'axios';
import axios from 'axios';

// F2 media module: the single shared 2-step presigned upload helper
// (F0 shipped download-only). Verified read-only against
// backend/src/media (controller + PostUploadMediaDto):
// POST /media/uploads {filename, mimeType, size, purpose, visibility?}
// → {mediaId, uploadUrl}; PUT raw bytes to uploadUrl; then
// POST /media/:mediaId/confirm. Images jpeg/png/webp ≤5 MB
// (server re-verifies on confirm); purpose `avatar` here.

export const MEDIA_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type MediaImageMime = (typeof MEDIA_IMAGE_MIMES)[number];

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

export const CreateUploadSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.enum(MEDIA_IMAGE_MIMES),
  size: z.number().int().min(1).max(MAX_MEDIA_BYTES),
  purpose: z.string().min(1),
  visibility: z.string().optional(),
});

export type CreateUpload = z.infer<typeof CreateUploadSchema>;

export const UploadTicketSchema = z
  .object({
    mediaId: z.string(),
    uploadUrl: z.string().url(),
  })
  .passthrough();

export type UploadTicket = z.infer<typeof UploadTicketSchema>;

export interface UploadProgress {
  loaded: number;
  total?: number;
  percent: number;
}

export function validateImageFile(file: {
  name: string;
  type: string;
  size: number;
}): { ok: true } | { ok: false; reason: 'type' | 'size' } {
  if (!(MEDIA_IMAGE_MIMES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: 'type' };
  }
  if (file.size < 1 || file.size > MAX_MEDIA_BYTES) {
    return { ok: false, reason: 'size' };
  }
  return { ok: true };
}

type ApiHttpClient = Pick<AxiosInstance, 'post'>;

export async function createMediaUpload(
  client: ApiHttpClient,
  input: CreateUpload,
): Promise<UploadTicket> {
  const { data } = await client.post('/media/uploads', input);
  return UploadTicketSchema.parse(data);
}

export async function confirmMediaUpload(
  client: ApiHttpClient,
  mediaId: string,
): Promise<void> {
  await client.post(`/media/${mediaId}/confirm`);
}

// Raw-bytes PUT goes straight at the presigned URL (never through the app
// axios instance — no auth headers, no /api/v1 base). `putBytes` is injected
// so unit tests never touch the network.
export async function putUploadBytes(
  putBytes: (url: string, body: unknown, onProgress?: (p: UploadProgress) => void) => Promise<void>,
  uploadUrl: string,
  body: unknown,
  onProgress?: (p: UploadProgress) => void,
): Promise<void> {
  await putBytes(uploadUrl, body, onProgress);
}

// Default byte-PUT over plain axios: presigned hosts must not receive the
// app client's auth headers or base URL.
export async function putPresignedBytes(
  uploadUrl: string,
  body: unknown,
  contentType: string,
  fileSize: number,
  onProgress?: (p: UploadProgress) => void,
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

// Full 2-step flow: create → PUT bytes (progress) → confirm → mediaId.
export async function uploadMedia(
  client: ApiHttpClient,
  putBytes: (url: string, body: unknown, onProgress?: (p: UploadProgress) => void) => Promise<void>,
  file: { name: string; type: string; size: number },
  body: unknown,
  opts: { purpose: string; visibility?: string; onProgress?: (p: UploadProgress) => void },
): Promise<string> {
  const valid = validateImageFile(file);
  if (!valid.ok) throw new Error(`INVALID_FILE_${valid.reason.toUpperCase()}`);
  const ticket = await createMediaUpload(client, {
    filename: file.name,
    mimeType: file.type as MediaImageMime,
    size: file.size,
    purpose: opts.purpose,
    visibility: opts.visibility,
  });
  await putUploadBytes(putBytes, ticket.uploadUrl, body, opts.onProgress);
  await confirmMediaUpload(client, ticket.mediaId);
  return ticket.mediaId;
}
