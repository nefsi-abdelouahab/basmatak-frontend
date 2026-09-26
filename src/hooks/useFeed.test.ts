import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/api/errors';
import {
  feedKeys,
  hoursLabel,
  isOrgVerified,
  opportunityRef,
  orgDisplayName,
} from './useFeed';

describe('feedKeys', () => {
  it('namespaces feed reads under volunteer-home domains', () => {
    const keys = feedKeys();
    expect(keys.dashboard[0]).toBe('volunteer-home');
    expect(keys.opportunities({ q: 'a' })[0]).toBe('volunteer-home-opportunities');
    expect(keys.recommended[0]).toBe('volunteer-home-recommended');
    expect(keys.talents({ q: 'b' })[0]).toBe('volunteer-home-talents');
    expect(keys.opportunities({ q: 'a' })).not.toEqual(keys.opportunities({ q: 'b' }));
    expect(keys.municipalities('16')).not.toEqual(keys.municipalities('17'));
  });
});

describe('orgDisplayName', () => {
  const embed = { nameFr: 'Org FR', nameAr: 'منظمة', verificationStatus: 'verified' };
  it('resolves per locale with fallback', () => {
    expect(orgDisplayName(embed, 'ar')).toBe('منظمة');
    expect(orgDisplayName(embed, 'en')).toBe('Org FR');
    expect(orgDisplayName({ nameFr: 'Only FR' }, 'ar')).toBe('Only FR');
    expect(orgDisplayName(null, 'en')).toBe('');
  });
});

describe('isOrgVerified', () => {
  it('badges verification status only', () => {
    expect(isOrgVerified({ verificationStatus: 'verified' })).toBe(true);
    expect(isOrgVerified({ verificationStatus: 'pending' })).toBe(false);
    expect(isOrgVerified(null)).toBe(false);
  });
});

describe('opportunityRef', () => {
  it('prefixes registry ids display-only', () => {
    expect(opportunityRef('7')).toBe('OPP-7');
    expect(opportunityRef(null)).toBeNull();
    expect(opportunityRef(undefined)).toBeNull();
  });
});

describe('hoursLabel', () => {
  it('derives hours from durationMinutes only', () => {
    expect(hoursLabel(180)).toBe('3h');
    expect(hoursLabel(90)).toBe('1.5h');
    expect(hoursLabel(null)).toBeNull();
    expect(hoursLabel(undefined)).toBeNull();
    expect(hoursLabel(NaN)).toBeNull();
  });

  it('detects nothing about auth codes here', () => {
    expect(
      new ApiError({ statusCode: 401, code: 'UNAUTHORIZED', message: 'x' }).statusCode,
    ).toBe(401);
  });
});
