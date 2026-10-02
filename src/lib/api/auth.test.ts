import { describe, expect, it, vi } from 'vitest';
import {
  AuthTokensSchema,
  changePassword,
  emailSchema,
  forgotPassword,
  login,
  logoutAll,
  logoutOthers,
  normalizePhoneNumber,
  passwordSchema,
  phoneSchema,
  registerOrganization,
  registerVolunteer,
  resendVerification,
  resetPassword,
  verifyEmail,
} from './auth';
import type { SessionUser } from './session';

const user = {
  id: '64f000000000000000000001',
  email: 'vol@example.com',
  emailVerifiedAt: null,
  role: 'volunteer',
  status: 'active',
} satisfies SessionUser;

const tokens = {
  accessToken: 'a',
  refreshToken: 'r',
  user,
};

function stubClient(post: (url: string, body?: unknown) => unknown) {
  return {
    get: vi.fn(),
    post: vi.fn(async (url: string, body?: unknown) => ({ data: await post(url, body) })),
  };
}

describe('auth validators', () => {
  it('accepts well-formed email/password/phone', () => {
    expect(emailSchema.safeParse('vol@example.com').success).toBe(true);
    expect(passwordSchema.safeParse('s3cret-pass').success).toBe(true);
    expect(phoneSchema.safeParse('+213555123456').success).toBe(true);
    expect(phoneSchema.safeParse('0555123456').success).toBe(true);
  });

  it('rejects bad email, short/long passwords, spaced phones', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('x'.repeat(73)).success).toBe(false);
    expect(phoneSchema.safeParse('555 123 456').success).toBe(false);
    expect(phoneSchema.safeParse('123').success).toBe(false);
  });

  it('normalizePhoneNumber strips formatting so human input validates', () => {
    expect(normalizePhoneNumber('+213 555 12 34 56')).toBe('+213555123456');
    expect(normalizePhoneNumber('+213 (0) 49 90 12 34')).toBe('+213049901234');
    expect(normalizePhoneNumber('0555-12-34-56')).toBe('0555123456');
    expect(phoneSchema.safeParse(normalizePhoneNumber('+213 555 12 34 56')).success).toBe(true);
    expect(phoneSchema.safeParse(normalizePhoneNumber('+213 (0) 49 90 12 34')).success).toBe(
      true,
    );
    expect(phoneSchema.safeParse(normalizePhoneNumber('+213 abc 1234')).success).toBe(false);
  });
});

describe('auth api functions', () => {
  it('registerVolunteer posts the volunteer endpoint and parses tokens', async () => {
    const client = stubClient(async (url, body) => {
      expect(url).toBe('/auth/register/volunteer');
      expect(body).toEqual({ email: 'v@example.com', password: 's3cret-pass' });
      return tokens;
    });
    await expect(
      registerVolunteer(client, { email: 'v@example.com', password: 's3cret-pass' }),
    ).resolves.toEqual(tokens);
  });

  it('registerOrganization posts the organization endpoint', async () => {
    const client = stubClient(async (url) => {
      expect(url).toBe('/auth/register/organization');
      return tokens;
    });
    await expect(
      registerOrganization(client, { email: 'o@example.com', password: 's3cret-pass' }),
    ).resolves.toEqual(tokens);
  });

  it('login posts credentials and parses tokens', async () => {
    const client = stubClient(async (url, body) => {
      expect(url).toBe('/auth/login');
      expect(body).toEqual({ email: 'v@example.com', password: 's3cret-pass' });
      return tokens;
    });
    await expect(
      login(client, { email: 'v@example.com', password: 's3cret-pass' }),
    ).resolves.toEqual(tokens);
  });

  it('rejects malformed token payloads', async () => {
    const client = stubClient(async () => ({ nope: true }));
    await expect(
      login(client, { email: 'v@example.com', password: 's3cret-pass' }),
    ).rejects.toThrow();
    expect(AuthTokensSchema.safeParse({ nope: true }).success).toBe(false);
  });

  it('204 endpoints resolve void without parsing a body', async () => {
    const seen: string[] = [];
    const client = stubClient(async (url) => {
      seen.push(url);
      return '';
    });
    await logoutAll(client);
    await logoutOthers(client);
    await verifyEmail(client, { token: 't' });
    await resendVerification(client);
    await forgotPassword(client, { email: 'v@example.com' });
    await resetPassword(client, { token: 't', newPassword: 'new-s3cret' });
    await changePassword(client, { currentPassword: 'old', newPassword: 'new-s3cret' });
    expect(seen).toEqual([
      '/auth/logout-all',
      '/auth/logout-others',
      '/auth/verify-email',
      '/auth/resend-verification',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/change-password',
    ]);
  });
});
