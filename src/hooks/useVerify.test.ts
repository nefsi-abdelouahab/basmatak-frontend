import { describe, expect, it } from 'vitest';
import { verifyKeys } from './useVerify';

describe('verifyKeys', () => {
  it('namespaces proofs under the verify domain', () => {
    expect(verifyKeys().proof('ABCDEFGH')).toEqual([
      'verify',
      'detail',
      'ABCDEFGH',
    ]);
  });

  it('normalizes the code before it becomes a key', () => {
    expect(verifyKeys().proof(' /en/verify/abcdefgh ')).toEqual(
      verifyKeys().proof('ABCDEFGH'),
    );
  });

  it('keeps different codes in different cache slots', () => {
    expect(verifyKeys().proof('ABCDEFGH')).not.toEqual(
      verifyKeys().proof('ABCDEFGI'),
    );
  });
});
