import { describe, expect, it, vi } from 'vitest';
import type { BlobDownloader } from './download';
import { downloadBlob, parseContentDisposition } from './download';

describe('parseContentDisposition', () => {
  it('returns null without a header', () => {
    expect(parseContentDisposition(undefined)).toBeNull();
  });

  it('reads a quoted filename', () => {
    expect(parseContentDisposition('attachment; filename="report.csv"')).toBe('report.csv');
  });

  it('reads an RFC 5987 encoded filename', () => {
    expect(parseContentDisposition("attachment; filename*=UTF-8''report%20x.csv")).toBe(
      'report x.csv',
    );
  });
});

describe('downloadBlob', () => {
  function downloader(): BlobDownloader & { calls: string[] } {
    const calls: string[] = [];
    return {
      calls,
      createObjectURL: () => 'blob:fake',
      revokeObjectURL: (url) => {
        calls.push(`revoke:${url}`);
      },
      clickAnchor: (url, filename) => {
        calls.push(`click:${url}:${filename}`);
      },
    };
  }

  it('saves with the server filename and revokes the object URL', async () => {
    const dl = downloader();
    const filename = await downloadBlob(
      async () => ({
        data: new Blob(['a,b']),
        headers: { 'content-disposition': 'attachment; filename="export.csv"' },
      }),
      '/organizations/me/experiences?format=csv',
      undefined,
      dl,
    );
    expect(filename).toBe('export.csv');
    expect(dl.calls).toEqual(['click:blob:fake:export.csv', 'revoke:blob:fake']);
  });

  it('falls back to a generic filename without a header', async () => {
    const dl = downloader();
    const filename = await downloadBlob(
      async () => ({ data: new Blob(['x']), headers: {} }),
      '/experiences/abc/attestation',
      undefined,
      dl,
    );
    expect(filename).toBe('download');
    expect(dl.calls).toEqual(['click:blob:fake:download', 'revoke:blob:fake']);
  });

  it('forwards query params to the request', async () => {
    const request = vi.fn(async () => ({ data: new Blob(['x']), headers: {} }));
    await downloadBlob(request, '/x', { format: 'csv' }, downloader());
    expect(request).toHaveBeenCalledWith('/x', { responseType: 'blob', params: { format: 'csv' } });
  });
});
