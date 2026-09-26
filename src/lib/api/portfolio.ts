import { z } from 'zod';
import type { AxiosInstance } from 'axios';
import {
  UploadTicketSchema,
  confirmMediaUpload,
  putUploadBytes,
  MAX_MEDIA_BYTES,
  type UploadProgress,
} from './media';

// F8 portfolio module: one typed function per own-portfolio backend endpoint
// (base `/api/v1`). Verified read-only against backend/src/portfolio
// (controller + service `hydrateMedia` + DTOs) plus the live Swagger request
// DTOs (`CreatePortfolioItemDto`, `UpdatePortfolioItemDto`,
// `ReorderPortfolioDto`):
// - GET /portfolio/me → PortfolioItemView[] (stored `order` ascending)
// - POST /portfolio/me {title*, description?, mediaIds?, visibility?,
//   typeLabel?, tags?} → single view
// - PATCH /portfolio/:itemId (same fields, all optional) → single view
// - DELETE /portfolio/:itemId → 204
// - PUT /portfolio/me/order {itemIds: full sequence} → full list (atomic)
// - POST /media/uploads {purpose: portfolio_item} + PUT bytes +
//   POST /media/:mediaId/confirm (file attach)
// Item view: {id, title, description|null, mediaIds[], visibility, order,
// typeLabel|null, tags[], media: [{mediaId, type, mimeType|null,
// filename|null, url|null (url only for link-type media)}]}. No single-item
// GET exists — reads/edits bind to list items. No Featured flag. Link-type
// media render as plain anchors (never a player); link creation lives outside
// this session (no POST /media/links UI here).

export const PORTFOLIO_VISIBILITIES = ['public', 'private'] as const;

export type PortfolioVisibility = (typeof PORTFOLIO_VISIBILITIES)[number];

export const PORTFOLIO_FILE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type PortfolioFileMime = (typeof PORTFOLIO_FILE_MIMES)[number];

export const PortfolioMediaSchema = z
  .object({
    mediaId: z.string(),
    type: z.string(),
    mimeType: z.string().nullable().optional(),
    filename: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
  })
  .passthrough();

export type PortfolioMedia = z.infer<typeof PortfolioMediaSchema>;

export const PortfolioItemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    mediaIds: z.array(z.string()),
    visibility: z.enum(PORTFOLIO_VISIBILITIES),
    order: z.number(),
    typeLabel: z.string().nullable().optional(),
    tags: z.array(z.string()),
    media: z.array(PortfolioMediaSchema),
  })
  .passthrough();

export type PortfolioItem = z.infer<typeof PortfolioItemSchema>;

export const CreatePortfolioItemSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  mediaIds: z.array(z.string().min(1)).max(50).optional(),
  visibility: z.enum(PORTFOLIO_VISIBILITIES).optional(),
  typeLabel: z.string().max(40).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

export type CreatePortfolioItem = z.infer<typeof CreatePortfolioItemSchema>;

export const UpdatePortfolioItemSchema = CreatePortfolioItemSchema.partial();

export type UpdatePortfolioItem = z.infer<typeof UpdatePortfolioItemSchema>;

export const ReorderPortfolioSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1),
});

export type ReorderPortfolio = z.infer<typeof ReorderPortfolioSchema>;

// Client-side file guard (unit-tested): images + PDF at 5 MB max. Audio and
// everything else is rejected before any POST /media/uploads call.
export function validatePortfolioFile(file: {
  name: string;
  type: string;
  size: number;
}): { ok: true } | { ok: false; reason: 'type' | 'size' } {
  if (!(PORTFOLIO_FILE_MIMES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: 'type' };
  }
  if (file.size < 1 || file.size > MAX_MEDIA_BYTES) {
    return { ok: false, reason: 'size' };
  }
  return { ok: true };
}

// Canonical tag list (mirrors backend normalizeTags): trimmed, empties
// dropped, deduped.
export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag !== ''))];
}

// Reorder payload builder (unit-tested): the backend expects the FULL id
// sequence in the desired display order.
export function buildReorderPayload(items: { id: string }[]): ReorderPortfolio {
  return { itemIds: items.map((item) => item.id) };
}

type HttpClient = Pick<AxiosInstance, 'get' | 'post' | 'patch' | 'put' | 'delete'>;

export async function listMyPortfolio(client: HttpClient): Promise<PortfolioItem[]> {
  const { data } = await client.get('/portfolio/me');
  return z.array(PortfolioItemSchema).parse(data);
}

export async function createPortfolioItem(
  client: HttpClient,
  input: CreatePortfolioItem,
): Promise<PortfolioItem> {
  const { data } = await client.post('/portfolio/me', input);
  return PortfolioItemSchema.parse(data);
}

export async function patchPortfolioItem(
  client: HttpClient,
  itemId: string,
  input: UpdatePortfolioItem,
): Promise<PortfolioItem> {
  const { data } = await client.patch(`/portfolio/${itemId}`, input);
  return PortfolioItemSchema.parse(data);
}

export async function deletePortfolioItem(client: HttpClient, itemId: string): Promise<void> {
  await client.delete(`/portfolio/${itemId}`);
}

export async function reorderPortfolio(
  client: HttpClient,
  input: ReorderPortfolio,
): Promise<PortfolioItem[]> {
  const { data } = await client.put('/portfolio/me/order', input);
  return z.array(PortfolioItemSchema).parse(data);
}

// File attach for purpose `portfolio_item`. The shared `uploadMedia`
// composer is avatar-scoped (image-only guard), so this composes the same
// shared primitives directly: ticket → PUT bytes (progress) → confirm.
// `putBytes` is injected so unit tests never touch the network.
export async function uploadPortfolioFile(
  client: HttpClient,
  putBytes: (url: string, body: unknown, onProgress?: (p: UploadProgress) => void) => Promise<void>,
  file: { name: string; type: string; size: number },
  body: unknown,
  opts: { visibility?: PortfolioVisibility; onProgress?: (p: UploadProgress) => void },
): Promise<string> {
  const valid = validatePortfolioFile(file);
  if (!valid.ok) throw new Error(`INVALID_FILE_${valid.reason.toUpperCase()}`);
  const { data } = await client.post('/media/uploads', {
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    purpose: 'portfolio_item',
    ...(opts.visibility ? { visibility: opts.visibility } : {}),
  });
  const ticket = UploadTicketSchema.parse(data);
  await putUploadBytes(putBytes, ticket.uploadUrl, body, opts.onProgress);
  await confirmMediaUpload(client, ticket.mediaId);
  return ticket.mediaId;
}
