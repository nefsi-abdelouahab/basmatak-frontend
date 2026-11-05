import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  VerificationProofSchema,
  fetchPublicProof,
  normalizeVerificationCode,
} from './verify';

const proof = {
  registryId: 'EXP-000123',
  title: 'Park cleanup',
  description: 'Shoreline shift',
  skills: ['s1'],
  duration: 180,
  organization: { slug: 'el-amel', nameFr: 'Association El-Amel', nameAr: null },
  verifiedAt: '2026-09-05T12:00:00.000Z',
  verificationCode: 'ABCDEFGH',
  review: { rating: 5, notes: 'Reliable' },
  volunteer: { handle: 'aliben', firstName: 'Ali' },
  evidence: [
    { mediaId: 'm1', type: 'link', url: 'https://example.org/proof' },
  ],
  futureField: 'ignored but kept',
};

function stubClient(data: unknown) {
  const get = vi.fn(async () => ({ data }));
  return { client: { get } as unknown as AxiosInstance, get };
}

describe('normalizeVerificationCode', () => {
  it('trims, uppercases, and strips whitespace', () => {
    expect(normalizeVerificationCode('  abcdefgh ')).toBe('ABCDEFGH');
    expect(normalizeVerificationCode('ab cd ef gh')).toBe('ABCDEFGH');
  });

  it('accepts a pasted verification URL with locale, query, or hash', () => {
    expect(normalizeVerificationCode('https://basmatak.test/en/verify/abcdefgh')).toBe(
      'ABCDEFGH',
    );
    expect(normalizeVerificationCode('/ar/verify/ABCDEFGH?from=email')).toBe('ABCDEFGH');
    expect(normalizeVerificationCode('https://basmatak.test/verify/ABCDEFGH/#top')).toBe(
      'ABCDEFGH',
    );
  });

  it('returns an empty string for blank input', () => {
    expect(normalizeVerificationCode('   ')).toBe('');
  });
});

describe('VerificationProofSchema', () => {
  it('parses the full proof and keeps additive fields', () => {
    const parsed = VerificationProofSchema.parse(proof);
    expect(parsed.verificationCode).toBe('ABCDEFGH');
    expect(parsed.organization?.slug).toBe('el-amel');
    expect(parsed.volunteer?.handle).toBe('aliben');
    expect(parsed.review?.rating).toBe(5);
    expect((parsed as Record<string, unknown>).futureField).toBe('ignored but kept');
  });

  it('accepts a minimal payload with only the echoed code', () => {
    const parsed = VerificationProofSchema.parse({ verificationCode: 'ABCDEFGH' });
    expect(parsed.skills).toEqual([]);
    expect(parsed.evidence).toEqual([]);
    expect(parsed.title).toBeUndefined();
  });

  it('requires the echoed verification code', () => {
    expect(() => VerificationProofSchema.parse({ title: 'No code' })).toThrow();
  });
});

describe('fetchPublicProof', () => {
  it('requests the normalized code under /verify', async () => {
    const { client, get } = stubClient(proof);
    const parsed = await fetchPublicProof(client, ' https://basmatak.test/en/verify/abcdefgh ');
    expect(get).toHaveBeenCalledWith('/verify/ABCDEFGH');
    expect(parsed.verificationCode).toBe('ABCDEFGH');
  });
});
