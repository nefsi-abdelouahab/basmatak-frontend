import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/api/errors';
import { queryKeys } from '../lib/query/keys';
import { isConflictError, isConsentRequiredError, submissionKeys } from './useSubmissions';

describe('isConsentRequiredError', () => {
  it('detects the 400 CONSENT_REQUIRED gate code', () => {
    expect(
      isConsentRequiredError(
        new ApiError({ statusCode: 400, code: 'CONSENT_REQUIRED', message: 'x' }),
      ),
    ).toBe(true);
    expect(
      isConsentRequiredError(
        new ApiError({ statusCode: 400, code: 'EVIDENCE_REQUIRED', message: 'x' }),
      ),
    ).toBe(false);
    expect(isConsentRequiredError(new Error('boom'))).toBe(false);
  });
});

describe('isConflictError', () => {
  it('detects the duplicate-create 409', () => {
    expect(
      isConflictError(new ApiError({ statusCode: 409, code: 'CONFLICT', message: 'x' })),
    ).toBe(true);
    expect(
      isConflictError(new ApiError({ statusCode: 404, code: 'NOT_FOUND', message: 'x' })),
    ).toBe(false);
  });
});

describe('submissionKeys', () => {
  it('namespaces every key under the submit-contribution domain', () => {
    const keys = submissionKeys();
    expect(keys.detail('abc')[0]).toBe('submit-contribution');
    expect(keys.mine[0]).toBe('submit-contribution');
    expect(keys.detail('abc')).not.toEqual(keys.detail('def'));
  });

  it('keeps the disabled-detail key disjoint from the mine-list key', () => {
    // Regression guard: sharing one key leaks the list payload into
    // `useSubmissionQuery(undefined).data` (an empty array is truthy and
    // renders a phantom draft instead of the new-draft composer).
    expect(queryKeys.detail('submit-contribution', 'none')).not.toEqual(submissionKeys().mine);
  });
});
