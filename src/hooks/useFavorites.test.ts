import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/api/errors';
import { favoritesKeys, isAuthError, loginHrefForSave } from './useFavorites';
import { getLoginHref } from './useSession';

describe('favoritesKeys', () => {
  it('namespaces saves under the favorites domain', () => {
    const keys = favoritesKeys();
    expect(keys.counts[0]).toBe('volunteer-home-favorites');
    expect(keys.lookup('opportunity', ['1'])).not.toEqual(keys.lookup('opportunity', ['2']));
    expect(keys.lookup('opportunity', ['1'])).not.toEqual(keys.lookup('talent', ['1']));
    expect(keys.lookup('organization', ['org'])).not.toEqual(
      keys.lookup('talent', ['org']),
    );
    expect(keys.list({ targetType: 'opportunity' })).not.toEqual(
      keys.list({ targetType: 'organization' }),
    );
    expect(keys.list({ targetType: 'opportunity', cursor: 'a' })).not.toEqual(
      keys.list({ targetType: 'opportunity', cursor: 'b' }),
    );
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
  it('returns a locale-less login path with a next return', () => {
    expect(loginHrefForSave('/volunteer/opportunities')).toBe(
      '/login?next=%2Fvolunteer%2Fopportunities',
    );
    expect(loginHrefForSave('/volunteer/talents')).toBe('/login?next=%2Fvolunteer%2Ftalents');
  });

  it('never embeds a locale segment, so the locale-aware router cannot double it', () => {
    const href = loginHrefForSave('/talents?sort=newest&portfolio=true');
    expect(href.startsWith('/login')).toBe(true);
    expect(href).not.toMatch(/\/[a-z]{2}\//);
    // The `next` query survives the round trip with both filters intact.
    const next = new URL(href, 'http://127.0.0.1').searchParams.get('next');
    expect(next).toBe('/talents?sort=newest&portfolio=true');
    const parsed = new URL(next ?? '', 'http://127.0.0.1');
    expect(parsed.pathname).toBe('/talents');
    expect(parsed.searchParams.get('sort')).toBe('newest');
    expect(parsed.searchParams.get('portfolio')).toBe('true');
  });

  it('omits the next parameter when there is no return path', () => {
    expect(getLoginHref()).toBe('/login');
  });
});
