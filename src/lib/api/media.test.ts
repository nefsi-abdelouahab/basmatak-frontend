import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  confirmMediaUpload,
  createMediaUpload,
  uploadMedia,
  validateImageFile,
  type UploadProgress,
} from './media';

function stubClient(post: (url: string, _body?: unknown) => unknown) {
  const postFn = vi.fn(async (url: string, body?: unknown) => ({ data: await post(url, body) }));
  return { client: { post: postFn } as unknown as AxiosInstance, post: postFn };
}

const file = { name: 'avatar.jpg', type: 'image/jpeg', size: 1024 };

describe('media upload guards', () => {
  it('accepts jpeg/png/webp within 5 MB', () => {
    expect(validateImageFile(file)).toEqual({ ok: true });
    expect(validateImageFile({ ...file, type: 'image/png' })).toEqual({ ok: true });
  });

  it('rejects wrong types and oversize files before any request', () => {
    expect(validateImageFile({ ...file, type: 'image/gif' })).toEqual({
      ok: false,
      reason: 'type',
    });
    expect(validateImageFile({ ...file, size: 6 * 1024 * 1024 })).toEqual({
      ok: false,
      reason: 'size',
    });
  });
});

describe('media api functions', () => {
  it('createMediaUpload posts purpose avatar and parses the ticket', async () => {
    const { client, post } = stubClient(async (url) => {
      if (url === '/media/uploads') return { mediaId: 'm1', uploadUrl: 'https://cdn.example/up' };
      return undefined;
    });
    const ticket = await createMediaUpload(client, {
      filename: 'avatar.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      purpose: 'avatar',
    });
    expect(ticket).toMatchObject({ mediaId: 'm1' });
    expect(post).toHaveBeenCalledWith('/media/uploads', {
      filename: 'avatar.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      purpose: 'avatar',
    });
  });

  it('uploadMedia runs create → PUT bytes (progress) → confirm in order', async () => {
    const calls: string[] = [];
    const { client } = stubClient(async (url) => {
      calls.push(url);
      if (url === '/media/uploads') return { mediaId: 'm1', uploadUrl: 'https://cdn.example/up' };
      return undefined;
    });
    const seen: number[] = [];
    const putBytes = vi.fn(
      async (_url: string, _body: unknown, onProgress?: (p: UploadProgress) => void) => {
        calls.push('PUT');
        onProgress?.({ loaded: 512, total: 1024, percent: 50 });
      },
    );
    const mediaId = await uploadMedia(client, putBytes, file, new Uint8Array([1]), {
      purpose: 'avatar',
      onProgress: (p) => seen.push(p.percent),
    });
    expect(mediaId).toBe('m1');
    expect(calls).toEqual(['/media/uploads', 'PUT', '/media/m1/confirm']);
    expect(seen).toEqual([50]);
    expect(putBytes).toHaveBeenCalledWith(
      'https://cdn.example/up',
      expect.anything(),
      expect.any(Function),
    );
  });

  it('uploadMedia never calls create for invalid files', async () => {
    const { client, post } = stubClient(async () => ({}));
    const putBytes = vi.fn();
    await expect(
      uploadMedia(client, putBytes, { ...file, type: 'video/mp4' }, new Uint8Array([1]), {
        purpose: 'avatar',
      }),
    ).rejects.toThrow('INVALID_FILE_TYPE');
    expect(post).not.toHaveBeenCalled();
    expect(putBytes).not.toHaveBeenCalled();
  });

  it('confirmMediaUpload posts the confirm endpoint', async () => {
    const { client, post } = stubClient(async () => undefined);
    await confirmMediaUpload(client, 'm1');
    expect(post).toHaveBeenCalledWith('/media/m1/confirm');
  });
});
