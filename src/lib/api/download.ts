// Single shared authed-download path for every streamed export (attestation
// PDFs, format=csv archives): axios responseType blob + Content-Disposition
// filename, triggered as a save — never navigation, never a stored file URL.

export interface BlobResponse {
  data: Blob;
  headers: Record<string, string | string[] | undefined>;
}

export type BlobRequest = (
  url: string,
  config: { responseType: 'blob'; params?: unknown },
) => Promise<BlobResponse>;

export interface BlobDownloader {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  clickAnchor(url: string, filename: string): void;
}

export const domBlobDownloader: BlobDownloader = {
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
  clickAnchor: (url, filename) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  },
};

export function parseContentDisposition(header: string | undefined): string | null {
  if (!header) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, ''));
    } catch {
      return encoded[1].trim().replace(/^"|"$/g, '');
    }
  }
  const quoted = /filename="?([^";]+)"?/i.exec(header);
  return quoted?.[1]?.trim() ?? null;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function downloadBlob(
  request: BlobRequest,
  url: string,
  params?: unknown,
  downloader: BlobDownloader = domBlobDownloader,
): Promise<string> {
  const response = await request(url, { responseType: 'blob', params });
  const filename =
    parseContentDisposition(headerValue(response.headers['content-disposition'])) ??
    'download';
  const objectURL = downloader.createObjectURL(response.data);
  try {
    downloader.clickAnchor(objectURL, filename);
  } finally {
    downloader.revokeObjectURL(objectURL);
  }
  return filename;
}
