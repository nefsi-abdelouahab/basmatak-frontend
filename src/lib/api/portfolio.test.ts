import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  CreatePortfolioItemSchema,
  PortfolioItemSchema,
  buildReorderPayload,
  createPortfolioItem,
  deletePortfolioItem,
  listMyPortfolio,
  normalizeTags,
  patchPortfolioItem,
  reorderPortfolio,
  uploadPortfolioFile,
  validatePortfolioFile,
} from './portfolio';

function stubClient(handlers: {
  get?: (url: string) => unknown;
  post?: (url: string, body?: unknown) => unknown;
  patch?: (url: string, body?: unknown) => unknown;
  put?: (url: string, body?: unknown) => unknown;
  delete?: (url: string) => unknown;
}) {
  const get = vi.fn(async (url: string) => ({ data: handlers.get?.(url) }));
  const post = vi.fn(async (url: string, body?: unknown) => ({ data: handlers.post?.(url, body) }));
  const patch = vi.fn(async (url: string, body?: unknown) => ({
    data: handlers.patch?.(url, body),
  }));
  const put = vi.fn(async (url: string, body?: unknown) => ({ data: handlers.put?.(url, body) }));
  const del = vi.fn(async (url: string) => ({ data: handlers.delete?.(url) }));
  const client = { get, post, patch, put, delete: del } as unknown as AxiosInstance;
  return { client, get, post, patch, put, del };
}

const item = {
  id: 'p1',
  title: 'Cleanup photos',
  description: null,
  mediaIds: ['m1'],
  visibility: 'public',
  order: 0,
  typeLabel: 'Photography',
  tags: ['beach', 'team'],
  media: [
    { mediaId: 'm1', type: 'file', mimeType: 'image/jpeg', filename: 'a.jpg', url: null },
  ],
};

describe('portfolio guards and builders', () => {
  it('accepts images and PDF up to 5 MB, rejects audio and oversize', () => {
    expect(validatePortfolioFile({ name: 'a.jpg', type: 'image/jpeg', size: 10 }).ok).toBe(true);
    expect(validatePortfolioFile({ name: 'a.pdf', type: 'application/pdf', size: 5 * 1024 * 1024 }).ok).toBe(
      true,
    );
    expect(validatePortfolioFile({ name: 'a.mp3', type: 'audio/mpeg', size: 10 })).toEqual({
      ok: false,
      reason: 'type',
    });
    expect(validatePortfolioFile({ name: 'a.jpg', type: 'image/jpeg', size: 5 * 1024 * 1024 + 1 })).toEqual(
      { ok: false, reason: 'size' },
    );
  });

  it('normalizes tags and builds the full-sequence reorder payload', () => {
    expect(normalizeTags([' beach ', '', 'beach', 'team '])).toEqual(['beach', 'team']);
    expect(buildReorderPayload([{ id: 'p2' }, { id: 'p1' }])).toEqual({ itemIds: ['p2', 'p1'] });
  });

  it('validates create bounds (title required, typeLabel/tags capped)', () => {
    expect(CreatePortfolioItemSchema.safeParse({ title: 'x' }).success).toBe(true);
    expect(CreatePortfolioItemSchema.safeParse({ title: '' }).success).toBe(false);
    expect(
      CreatePortfolioItemSchema.safeParse({ title: 'x', typeLabel: 'y'.repeat(41) }).success,
    ).toBe(false);
    expect(
      CreatePortfolioItemSchema.safeParse({ title: 'x', tags: Array(11).fill('t') }).success,
    ).toBe(false);
    expect(PortfolioItemSchema.safeParse(item).success).toBe(true);
  });
});

describe('portfolio endpoints', () => {
  it('lists, creates, patches, deletes, and reorders', async () => {
    const { client, get } = stubClient({ get: () => [item] });
    expect(await listMyPortfolio(client)).toHaveLength(1);
    expect(get).toHaveBeenCalledWith('/portfolio/me');

    const { client: c2, post } = stubClient({ post: () => item });
    await createPortfolioItem(c2, { title: 'Cleanup photos', typeLabel: 'Photography' });
    expect(post).toHaveBeenCalledWith('/portfolio/me', {
      title: 'Cleanup photos',
      typeLabel: 'Photography',
    });

    const { client: c3, patch } = stubClient({ patch: () => item });
    await patchPortfolioItem(c3, 'p1', { visibility: 'private' });
    expect(patch).toHaveBeenCalledWith('/portfolio/p1', { visibility: 'private' });

    const { client: c4, del } = stubClient({ delete: () => undefined });
    await deletePortfolioItem(c4, 'p1');
    expect(del).toHaveBeenCalledWith('/portfolio/p1');

    const { client: c5, put } = stubClient({ put: () => [item] });
    const reordered = await reorderPortfolio(c5, { itemIds: ['p1'] });
    expect(put).toHaveBeenCalledWith('/portfolio/me/order', { itemIds: ['p1'] });
    expect(reordered).toHaveLength(1);
  });

  it('blocks bad files before POST /media/uploads and runs the 2-step flow', async () => {
    const putBytes = vi.fn(async () => undefined);
    const { client, post } = stubClient({
      post: (url) =>
        url === '/media/uploads' ? { mediaId: 'm9', uploadUrl: 'https://cdn.example/up' } : {},
    });
    await expect(
      uploadPortfolioFile(client, putBytes, { name: 'a.mp3', type: 'audio/mpeg', size: 10 }, {}),
    ).rejects.toThrow('INVALID_FILE_TYPE');
    expect(post).not.toHaveBeenCalled();
    const mediaId = await uploadPortfolioFile(
      client,
      putBytes,
      { name: 'a.pdf', type: 'application/pdf', size: 100 },
      {},
      { visibility: 'public' },
    );
    expect(mediaId).toBe('m9');
    expect(post).toHaveBeenCalledWith('/media/uploads', {
      filename: 'a.pdf',
      mimeType: 'application/pdf',
      size: 100,
      purpose: 'portfolio_item',
      visibility: 'public',
    });
    expect(putBytes).toHaveBeenCalledTimes(1);
  });
});
