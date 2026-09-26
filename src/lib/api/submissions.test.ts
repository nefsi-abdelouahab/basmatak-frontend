import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  createMediaLink,
  createSubmission,
  deleteMedia,
  getSubmission,
  isAllowedEvidenceLink,
  isConsentRequiredError,
  listMySubmissions,
  needsImageryConsent,
  patchSubmission,
  submitReadiness,
  submitSubmission,
  validateEvidenceFile,
} from './submissions';

function stubClient(handlers: {
  get?: (url: string) => unknown;
  post?: (url: string, body?: unknown) => unknown;
  patch?: (url: string, body?: unknown) => unknown;
  delete?: (url: string) => unknown;
}) {
  const get = vi.fn(async (url: string) => ({ data: handlers.get?.(url) }));
  const post = vi.fn(async (url: string, body?: unknown) => ({ data: handlers.post?.(url, body) }));
  const patch = vi.fn(async (url: string, body?: unknown) => ({
    data: handlers.patch?.(url, body),
  }));
  const del = vi.fn(async (url: string) => ({ data: handlers.delete?.(url) }));
  const client = { get, post, patch, delete: del } as unknown as AxiosInstance;
  return { client, get, post, patch, del };
}

describe('validateEvidenceFile', () => {
  it('accepts jpeg/png/webp/pdf within 5 MB', () => {
    expect(validateEvidenceFile({ name: 'a.jpg', type: 'image/jpeg', size: 1024 })).toEqual({
      ok: true,
    });
    expect(validateEvidenceFile({ name: 'a.pdf', type: 'application/pdf', size: 5 * 1024 * 1024 })).toEqual({
      ok: true,
    });
  });

  it('rejects audio, video files, and zip before any request', () => {
    for (const type of ['audio/mpeg', 'video/mp4', 'application/zip', 'image/gif']) {
      expect(validateEvidenceFile({ name: 'x', type, size: 100 })).toEqual({
        ok: false,
        reason: 'type',
      });
    }
  });

  it('rejects oversize files before any request', () => {
    expect(
      validateEvidenceFile({ name: 'a.jpg', type: 'image/jpeg', size: 6 * 1024 * 1024 }),
    ).toEqual({ ok: false, reason: 'size' });
  });
});

describe('isAllowedEvidenceLink', () => {
  it('accepts youtube and drive hosts (incl. subdomains)', () => {
    expect(isAllowedEvidenceLink('https://www.youtube.com/watch?v=abc').ok).toBe(true);
    expect(isAllowedEvidenceLink('https://youtube.com/watch?v=abc').ok).toBe(true);
    expect(isAllowedEvidenceLink('https://youtu.be/abc').ok).toBe(true);
    expect(isAllowedEvidenceLink('https://drive.google.com/file/d/1/view').ok).toBe(true);
  });

  it('rejects other hosts, non-https, youtu.be subdomains, and garbage', () => {
    expect(isAllowedEvidenceLink('https://vimeo.com/123')).toMatchObject({
      ok: false,
      reason: 'host',
    });
    expect(isAllowedEvidenceLink('https://evil-youtube.com/x')).toMatchObject({
      ok: false,
      reason: 'host',
    });
    expect(isAllowedEvidenceLink('https://sub.youtu.be/abc')).toMatchObject({
      ok: false,
      reason: 'host',
    });
    expect(isAllowedEvidenceLink('http://youtube.com/watch?v=abc')).toMatchObject({
      ok: false,
      reason: 'url',
    });
    expect(isAllowedEvidenceLink('not a url')).toMatchObject({ ok: false, reason: 'url' });
  });
});

describe('submission api functions', () => {
  const draft = {
    id: '64f00000000000000000000a',
    participationId: '64f000000000000000000001',
    status: 'draft',
    evidence: [],
  };

  it('createSubmission posts the participation-scoped endpoint', async () => {
    const { client, post } = stubClient({ post: () => draft });
    const out = await createSubmission(client, '64f000000000000000000001', { title: 'T' });
    expect(out).toMatchObject({ status: 'draft' });
    expect(post).toHaveBeenCalledWith('/participations/64f000000000000000000001/submissions', {
      title: 'T',
    });
  });

  it('patchSubmission patches title/description/evidence/consent', async () => {
    const { client, patch } = stubClient({ patch: () => ({ ...draft, status: 'draft' }) });
    await patchSubmission(client, '64f00000000000000000000a', {
      description: 'did work',
      evidence: ['64f0000000000000000000b1'],
      consentConfirmed: true,
    });
    expect(patch).toHaveBeenCalledWith('/submissions/64f00000000000000000000a', {
      description: 'did work',
      evidence: ['64f0000000000000000000b1'],
      consentConfirmed: true,
    });
  });

  it('submitSubmission posts the submit endpoint with consent', async () => {
    const { client, post } = stubClient({ post: () => ({ ...draft, status: 'submitted' }) });
    const out = await submitSubmission(client, '64f00000000000000000000a', {
      consentConfirmed: true,
    });
    expect(out).toMatchObject({ status: 'submitted' });
    expect(post).toHaveBeenCalledWith('/submissions/64f00000000000000000000a/submit', {
      consentConfirmed: true,
    });
  });

  it('getSubmission reads the detail endpoint', async () => {
    const { client, get } = stubClient({ get: () => draft });
    await getSubmission(client, '64f00000000000000000000a');
    expect(get).toHaveBeenCalledWith('/submissions/64f00000000000000000000a');
  });

  it('listMySubmissions unwraps CursorPage items', async () => {
    const { client } = stubClient({
      get: () => ({ items: [draft], nextCursor: null, limit: 20, total: 1, page: 1, pages: 1 }),
    });
    const out = await listMySubmissions(client);
    expect(out).toHaveLength(1);
  });

  it('createMediaLink posts purpose submission_evidence', async () => {
    const { client, post } = stubClient({
      post: () => ({ mediaId: '64f0000000000000000000c1', url: 'https://youtu.be/abc' }),
    });
    await createMediaLink(client, { url: 'https://youtu.be/abc' });
    expect(post).toHaveBeenCalledWith('/media/links', {
      url: 'https://youtu.be/abc',
      purpose: 'submission_evidence',
    });
  });

  it('deleteMedia deletes the media row', async () => {
    const { client, del } = stubClient({ delete: () => undefined });
    await deleteMedia(client, '64f0000000000000000000c1');
    expect(del).toHaveBeenCalledWith('/media/64f0000000000000000000c1');
  });
});

describe('submitReadiness', () => {
  it('requires description and at least one evidence item', () => {
    expect(submitReadiness({ description: '  ', evidence: ['a'] })).toMatchObject({
      ok: false,
      reason: 'description',
    });
    expect(submitReadiness({ description: 'work', evidence: [] })).toMatchObject({
      ok: false,
      reason: 'evidence',
    });
    expect(submitReadiness({ description: 'work', evidence: ['a'] })).toEqual({ ok: true });
  });
});

describe('needsImageryConsent', () => {
  it('requires consent for images, links, and unknown kinds — not for pdf-only', () => {
    expect(needsImageryConsent([{ kind: 'image' }])).toBe(true);
    expect(needsImageryConsent([{ kind: 'link' }])).toBe(true);
    expect(needsImageryConsent([{ kind: 'unknown' }])).toBe(true);
    expect(needsImageryConsent([{ kind: 'pdf' }])).toBe(false);
    expect(needsImageryConsent([{ kind: 'pdf' }, { kind: 'image' }])).toBe(true);
    expect(needsImageryConsent([])).toBe(false);
  });
});

describe('isConsentRequiredError', () => {
  it('detects the 400 CONSENT_REQUIRED business code', () => {
    expect(isConsentRequiredError({ code: 'CONSENT_REQUIRED' })).toBe(true);
    expect(isConsentRequiredError({ code: 'EVIDENCE_REQUIRED' })).toBe(false);
    expect(isConsentRequiredError(new Error('boom'))).toBe(false);
  });
});
