import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/api/errors';
import { favoritesKeys, isAuthError, loginHrefForSave } from './useFavorites';

describe('favoritesKeys', () => {
  it('namespaces saves under the favorites domain', () => {
    const keys = favoritesKeys();
    expect(keys.counts[0]).toBe('volunteer-home-favorites');
    expect(keys.lookup('opportunity', ['1'])).not.toEqual(keys.lookup('opportunity', ['2']));
    expect(keys.lookup('opportunity', ['1'])).not.toEqual(keys.lookup('talent', ['1']));
  });
});

describe('isAuthError', () => {
  it('detects 401s for the guest-to-login redirect', () => {
    expect(
      isAuthError(new ApiError({ statusCode: 401, code: 'UNAUTHORIZED', message: 'x' })),
    ).toBe(true);
    expect(
      isAuthError(new ApiError({ statusCode: 403, code: 'FORBIDDEN', message: 'x' })),
    ).toBe(false);
    expect(isAuthError(new Error('boom'))).toBe(false);
  });
});

describe('loginHrefForSave', () => {
  it('targets login with a next return', () => {
    expect(loginHrefForSave('en', '/en/volunteer/opportunities')).toBe(
      '/en/login?next=%2Fen%2Fvolunteer%2Fopportunities',
    );
    expect(loginHrefForSave('ar', '/ar/volunteer/talents')).toBe(
      '/ar/login?next=%2Far%2Fvolunteer%2Ftalents',
    );
  });
});
