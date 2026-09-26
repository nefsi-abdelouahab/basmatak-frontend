import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/api/errors';
import { isEmailNotVerifiedError, orgKeys, verificationViewOf } from './useOrgOnboarding';

describe('isEmailNotVerifiedError', () => {
  it('detects the 403 EMAIL_NOT_VERIFIED gate code', () => {
    expect(
      isEmailNotVerifiedError(
        new ApiError({ statusCode: 403, code: 'EMAIL_NOT_VERIFIED', message: 'x' }),
      ),
    ).toBe(true);
    expect(
      isEmailNotVerifiedError(
        new ApiError({ statusCode: 403, code: 'FORBIDDEN', message: 'x' }),
      ),
    ).toBe(false);
    expect(isEmailNotVerifiedError(new Error('boom'))).toBe(false);
  });
});

describe('verificationViewOf', () => {
  it('maps pending → verified | rejected → pending plus unknown', () => {
    expect(verificationViewOf('pending')).toBe('pending');
    expect(verificationViewOf('verified')).toBe('verified');
    expect(verificationViewOf('rejected')).toBe('rejected');
    expect(verificationViewOf(undefined)).toBe('none');
    expect(verificationViewOf('suspended')).toBe('none');
  });
});

describe('orgKeys', () => {
  it('namespaces every key under the organization domain', () => {
    const keys = orgKeys();
    for (const key of [
      keys.me,
      keys.completion,
      keys.verification,
      keys.wilayas,
      keys.municipalities('16'),
    ]) {
      expect(key[0]).toBe('organization');
    }
    expect(keys.municipalities('16')).not.toEqual(keys.municipalities('17'));
  });
});
