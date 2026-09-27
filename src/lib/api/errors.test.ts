import { describe, expect, it } from 'vitest';
import { ApiError, backendMessageOf, errorStateFor, mapToApiError } from './errors';

function axiosFailure(status: number | undefined, data?: unknown): unknown {
  const failure: Record<string, unknown> = {
    isAxiosError: true,
    message: 'Request failed',
    config: {},
    request: {},
  };
  if (status !== undefined) {
    failure['response'] = { status, data, headers: {} };
  }
  return failure;
}

describe('mapToApiError', () => {
  it('keeps backend envelope values', () => {
    const err = mapToApiError(
      axiosFailure(403, {
        statusCode: 403,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Verify your email.',
      }),
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('EMAIL_NOT_VERIFIED');
    expect(err.message).toBe('Verify your email.');
  });

  it('falls back per status when the body is absent', () => {
    const err = mapToApiError(axiosFailure(404, undefined));
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('maps no-response failures to NETWORK_ERROR', () => {
    const err = mapToApiError(axiosFailure(undefined));
    expect(err.statusCode).toBe(0);
    expect(err.code).toBe('NETWORK_ERROR');
  });

  it('maps plain errors to UNKNOWN_ERROR', () => {
    const err = mapToApiError(new Error('boom'));
    expect(err.code).toBe('UNKNOWN_ERROR');
    expect(err.message).toBe('boom');
  });

  it('passes ApiError through untouched', () => {
    const original = new ApiError({ statusCode: 429, code: 'RATE_LIMITED', message: 'Slow.' });
    expect(mapToApiError(original)).toBe(original);
  });
});

describe('errorStateFor', () => {
  const cases: Array<[ApiError, string]> = [
    [new ApiError({ statusCode: 401, code: 'UNAUTHORIZED', message: 'x' }), 'session-expired'],
    [
      new ApiError({ statusCode: 403, code: 'ACCOUNT_SUSPENDED', message: 'x' }),
      'forbidden',
    ],
    [new ApiError({ statusCode: 404, code: 'NOT_FOUND', message: 'x' }), 'not-found'],
    [new ApiError({ statusCode: 429, code: 'RATE_LIMITED', message: 'x' }), 'rate-limited'],
    [
      new ApiError({ statusCode: 503, code: 'MAINTENANCE_MODE', message: 'x' }),
      'maintenance',
    ],
    [new ApiError({ statusCode: 0, code: 'NETWORK_ERROR', message: 'x' }), 'network-error'],
    [new ApiError({ statusCode: 500, code: 'UNKNOWN_ERROR', message: 'x' }), 'server-error'],
  ];
  for (const [error, expected] of cases) {
    it(`maps ${error.statusCode}/${error.code} to ${expected}`, () => {
      expect(errorStateFor(error)).toBe(expected);
    });
  }
});

describe('backendMessageOf', () => {
  it('returns the verbatim backend message when the envelope carries one', () => {
    expect(backendMessageOf(axiosFailure(400, { message: 'Already decided' }))).toBe(
      'Already decided',
    );
  });

  it('returns null when the envelope has no usable message', () => {
    expect(backendMessageOf(axiosFailure(500, {}))).toBeNull();
    expect(backendMessageOf(axiosFailure(500, { message: '   ' }))).toBeNull();
    expect(backendMessageOf(axiosFailure(undefined))).toBeNull();
    expect(backendMessageOf(new Error('boom'))).toBeNull();
  });

  it('returns null for already-mapped ApiErrors without backend provenance', () => {
    expect(
      backendMessageOf(new ApiError({ statusCode: 500, code: 'X', message: 'x' })),
    ).toBeNull();
  });

  it('preserves backend provenance through mapToApiError', () => {
    const backed = mapToApiError(axiosFailure(400, { message: 'Already decided' }));
    expect(backed.hasBackendMessage).toBe(true);
    expect(backendMessageOf(backed)).toBe('Already decided');
    const silent = mapToApiError(axiosFailure(500, {}));
    expect(silent.hasBackendMessage).toBe(false);
    expect(backendMessageOf(silent)).toBeNull();
  });
});
