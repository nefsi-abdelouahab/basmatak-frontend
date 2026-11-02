import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import {
  BUSINESS_ERROR_KEYS,
  userMessageKeyOf,
} from './userMessage';
import toastEn from '@/messages/toast/en.json';

function axiosFailure(
  status: number | undefined,
  data?: unknown,
  code?: string,
): unknown {
  const failure: Record<string, unknown> = {
    isAxiosError: true,
    message: 'Request failed',
    config: {},
    request: {},
  };
  if (code) failure['code'] = code;
  if (status !== undefined) failure['response'] = { status, data, headers: {} };
  return failure;
}

describe('userMessageKeyOf', () => {
  it('maps transport failures without a response', () => {
    expect(userMessageKeyOf(axiosFailure(undefined))).toBe('error.network');
  });

  it('maps axios timeout codes to timeout', () => {
    expect(userMessageKeyOf(axiosFailure(undefined, undefined, 'ECONNABORTED'))).toBe(
      'error.timeout',
    );
    expect(userMessageKeyOf(axiosFailure(undefined, undefined, 'ETIMEDOUT'))).toBe(
      'error.timeout',
    );
  });

  it.each([
    [400, 'error.badRequest'],
    [401, 'error.sessionExpired'],
    [403, 'error.forbidden'],
    [404, 'error.notFound'],
    [409, 'error.conflict'],
    [413, 'error.payloadTooLarge'],
    [422, 'error.validation'],
    [429, 'error.rateLimited'],
    [500, 'error.server'],
    [502, 'error.server'],
    [503, 'error.server'],
    [418, 'error.generic'],
  ])('maps HTTP %i to %s', (status, expected) => {
    expect(userMessageKeyOf(axiosFailure(status, {}))).toBe(expected);
  });

  it('prefers a known business code over the status mapping', () => {
    expect(
      userMessageKeyOf(
        axiosFailure(409, { code: 'CONTACT_CONFLICT', message: 'Verbose backend text' }),
      ),
    ).toBe('error.contactConflict');
    expect(
      userMessageKeyOf(
        axiosFailure(400, { code: 'PUBLISH_GATE_LOCKED', message: 'Gate locked' }),
      ),
    ).toBe('error.publishGateLocked');
  });

  it('falls back to the status key for unknown business codes', () => {
    expect(userMessageKeyOf(axiosFailure(404, { code: 'SOMETHING_NEW' }))).toBe(
      'error.notFound',
    );
  });

  it('maps plain errors and already-mapped ApiErrors', () => {
    expect(userMessageKeyOf(new Error('boom'))).toBe('error.generic');
    expect(
      userMessageKeyOf(
        new ApiError({ statusCode: 429, code: 'RATE_LIMITED', message: 'Slow down' }),
      ),
    ).toBe('error.rateLimited');
  });

  it('only returns keys from the toast catalog', () => {
    const catalog = new Set(Object.keys(toastEn.error).map((key) => `error.${key}`));
    expect(catalog.has(userMessageKeyOf(axiosFailure(500, {})))).toBe(true);
    for (const key of Object.values(BUSINESS_ERROR_KEYS)) {
      expect(catalog.has(key), key).toBe(true);
    }
  });
});
