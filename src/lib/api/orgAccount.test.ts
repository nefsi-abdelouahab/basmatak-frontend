import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import {
  ACCOUNT_DOC_MIMES,
  ACCOUNT_IMAGE_MIMES,
  MAX_ACCOUNT_UPLOAD_BYTES,
  ORG_ACCOUNT_PHONE_PATTERN,
  ORG_ACCOUNT_WEBSITE_PATTERN,
  OrgAccountSchema,
  UpdateOrgAccountInputSchema,
  accountMediaUrlOf,
  accountSaveFieldError,
  completionView,
  deleteOrgAccount,
  getAccountMedia,
  getAccountPrefs,
  diffAccountForm,
  getAccountUser,
  getOrgAccount,
  getOrgAccountCompletion,
  listAccountSessions,
  orgDisplayCode,
  patchAccountPrefs,
  patchAccountUser,
  patchOrgAccount,
  revokeAccountSession,
  sessionDeviceLabel,
  uploadAccountMedia,
  validateAccountFile,
} from './orgAccount';

function stubClient(responses: Record<string, unknown>) {
  const respond = (key: string) => ({ data: responses[key] }) as never;
  return {
    get: vi.fn(async (url: string) => respond(`GET ${url}`)),
    post: vi.fn(async (url: string) => respond(`POST ${url}`)),
    patch: vi.fn(async (url: string) => respond(`PATCH ${url}`)),
    delete: vi.fn(async (url: string) => respond(`DELETE ${url}`)),
  };
}

describe('validateAccountFile', () => {
  it('accepts pdf for documents but rejects it for images', () => {
    const pdf = { type: 'application/pdf', size: 1024 };
    expect(validateAccountFile(pdf, ACCOUNT_DOC_MIMES)).toEqual({ ok: true });
    expect(validateAccountFile(pdf, ACCOUNT_IMAGE_MIMES)).toEqual({ ok: false, reason: 'type' });
  });

  it('rejects oversized files before any upload', () => {
    expect(
      validateAccountFile(
        { type: 'image/png', size: MAX_ACCOUNT_UPLOAD_BYTES + 1 },
        ACCOUNT_IMAGE_MIMES,
      ),
    ).toEqual({ ok: false, reason: 'size' });
  });

  it('rejects unlisted types', () => {
    expect(validateAccountFile({ type: 'video/mp4', size: 100 }, ACCOUNT_DOC_MIMES)).toEqual({
      ok: false,
      reason: 'type',
    });
  });
});

describe('phone and website patterns', () => {
  it('matches the backend phone rule (no spaces, 8-15 digits)', () => {
    expect(ORG_ACCOUNT_PHONE_PATTERN.test('+213555123456')).toBe(true);
    expect(ORG_ACCOUNT_PHONE_PATTERN.test('0555123456')).toBe(true);
    expect(ORG_ACCOUNT_PHONE_PATTERN.test('05 55 12 34 56')).toBe(false);
    expect(ORG_ACCOUNT_PHONE_PATTERN.test('1234567')).toBe(false);
  });

  it('requires http(s) websites', () => {
    expect(ORG_ACCOUNT_WEBSITE_PATTERN.test('https://example.org')).toBe(true);
    expect(ORG_ACCOUNT_WEBSITE_PATTERN.test('not-a-url')).toBe(false);
  });
});

describe('orgDisplayCode', () => {
  it('prefixes the registry id and stays empty-safe', () => {
    expect(orgDisplayCode('000123')).toBe('ORG-000123');
    expect(orgDisplayCode(undefined)).toBe('');
    expect(orgDisplayCode('   ')).toBe('');
  });
});

describe('completionView', () => {
  it('passes percent through with clamping and no client math', () => {
    expect(completionView({ percent: 62, missing: ['website'], complete: false })).toEqual({
      percent: 62,
      complete: false,
      missing: ['website'],
    });
    expect(completionView({ percent: 140, missing: [], complete: true }).percent).toBe(100);
  });
});

describe('sessionDeviceLabel', () => {
  it('joins device parts and falls back to user-agent, never empty', () => {
    expect(
      sessionDeviceLabel({
        device: { browser: 'Chrome', os: 'Windows', device: 'Desktop' },
        userAgent: 'Mozilla/5.0',
      }),
    ).toBe('Desktop · Windows · Chrome');
    expect(sessionDeviceLabel({ device: null, userAgent: 'CustomAgent/1.0' })).toBe(
      'CustomAgent/1.0',
    );
    expect(sessionDeviceLabel({ device: null, userAgent: null })).toBe('Unknown device');
  });
});

describe('UpdateOrgAccountInputSchema', () => {
  it('rejects bad phone/website/mongo ids client-side', () => {
    expect(
      UpdateOrgAccountInputSchema.safeParse({ contact: { phone: 'bad' } }).success,
    ).toBe(false);
    expect(UpdateOrgAccountInputSchema.safeParse({ website: 'notaurl' }).success).toBe(false);
    expect(UpdateOrgAccountInputSchema.safeParse({ coverMediaId: 'nope' }).success).toBe(false);
  });

  it('accepts the full fact set plus nullable media and visibility toggle', () => {
    const parsed = UpdateOrgAccountInputSchema.safeParse({
      type: 'Association',
      registrationNumber: 'W-16-0001',
      website: 'https://example.org',
      foundedYear: 2018,
      coverMediaId: '64f000000000000000000001',
      annualReportMediaId: null,
      contact: { phone: '+213555123456' },
      focusDisciplines: ['64f000000000000000000002'],
      publicProfile: { enabled: false },
    });
    expect(parsed.success).toBe(true);
  });

  it('carries no statute or legal-accreditation keys', () => {
    const parsed = UpdateOrgAccountInputSchema.safeParse({
      type: 'Association',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty('statute');
      expect(parsed.data).not.toHaveProperty('legalAccreditation');
    }
  });
});

describe('org account reads', () => {
  const org = {
    registryId: '000123',
    slug: 'el-amel',
    verificationStatus: 'verified',
    nameFr: 'Association El-Amel',
    publicProfile: { enabled: true },
  };

  it('parses the factsheet read', async () => {
    const client = stubClient({ 'GET /organizations/me': org });
    await expect(getOrgAccount(client)).resolves.toMatchObject({
      registryId: '000123',
      slug: 'el-amel',
    });
    expect(OrgAccountSchema.safeParse(org).success).toBe(true);
  });

  it('accepts explicit null media ids (backend unset shape)', () => {
    expect(
      OrgAccountSchema.safeParse({ logoMediaId: null, coverMediaId: null, annualReportMediaId: null }).success,
    ).toBe(true);
  });

  it('patches facts and parses the response', async () => {
    const client = stubClient({ 'PATCH /organizations/me': { ...org, website: 'https://x.org' } });
    const updated = await patchOrgAccount(client, { website: 'https://x.org' });
    expect(updated.website).toBe('https://x.org');
    expect(client.patch).toHaveBeenCalledWith('/organizations/me', { website: 'https://x.org' });
  });

  it('reads completion display-only', async () => {
    const client = stubClient({
      'GET /organizations/me/profile-completion': { percent: 62, missing: ['website'], complete: false },
    });
    await expect(getOrgAccountCompletion(client)).resolves.toEqual({
      percent: 62,
      missing: ['website'],
      complete: false,
    });
  });

  it('deletes via DELETE /organizations/me', async () => {
    const client = stubClient({
      'DELETE /organizations/me': { deleted: true, organizationId: 'o1' },
    });
    await expect(deleteOrgAccount(client)).resolves.toEqual({
      deleted: true,
      organizationId: 'o1',
    });
  });
});

describe('account settings reads', () => {
  it('reads and patches the account user', async () => {
    const user = { id: 'u1', email: 'o@example.com', phone: null };
    const client = stubClient({
      'GET /users/me': user,
      'PATCH /users/me': { ...user, phone: '+213555123456' },
    });
    await expect(getAccountUser(client)).resolves.toMatchObject({ email: 'o@example.com' });
    const updated = await patchAccountUser(client, { phone: '+213555123456' });
    expect(updated.phone).toBe('+213555123456');
  });

  it('lists sessions and revokes one', async () => {
    const sessions = [
      {
        id: 's1',
        createdAt: '2026-09-01T00:00:00.000Z',
        expiresAt: '2026-10-01T00:00:00.000Z',
        device: null,
        userAgent: 'UA',
        isCurrent: true,
      },
    ];
    const client = stubClient({
      'GET /users/me/sessions': sessions,
      'DELETE /users/me/sessions/s1': undefined,
    });
    await expect(listAccountSessions(client)).resolves.toHaveLength(1);
    await revokeAccountSession(client, 's1');
    expect(client.delete).toHaveBeenCalledWith('/users/me/sessions/s1');
  });

  it('reads and patches prefs through the {prefs} wrapper', async () => {
    const prefs = { digest: true };
    const client = stubClient({
      'GET /notifications/preferences': { prefs },
      'PATCH /notifications/preferences': { prefs: { ...prefs, digest: false } },
    });
    await expect(getAccountPrefs(client)).resolves.toEqual(prefs);
    const updated = await patchAccountPrefs(client, { digest: false });
    expect(updated).toMatchObject({ digest: false });
    expect(client.patch).toHaveBeenCalledWith('/notifications/preferences', {
      prefs: { digest: false },
    });
  });
});

describe('accountMediaUrlOf', () => {
  it('prefers signedUrl, falls back to url, null when absent', () => {
    expect(accountMediaUrlOf({ signedUrl: 's', url: 'u' })).toBe('s');
    expect(accountMediaUrlOf({ url: 'u' })).toBe('u');
    expect(accountMediaUrlOf({})).toBeNull();
    expect(accountMediaUrlOf(undefined)).toBeNull();
  });

  it('reads owning-org media by id', async () => {
    const client = stubClient({ 'GET /media/m1': { url: 'https://cdn.example/m1' } });
    await expect(getAccountMedia(client, 'm1')).resolves.toMatchObject({
      url: 'https://cdn.example/m1',
    });
  });
});

describe('uploadAccountMedia', () => {
  const file = { name: 'cover.jpg', type: 'image/jpeg', size: 100 };

  it('runs create → PUT → confirm and returns the media id', async () => {
    const client = stubClient({
      'POST /media/uploads': { mediaId: 'm1', uploadUrl: 'https://cdn.example/up' },
      'POST /media/m1/confirm': {},
    });
    const putBytes = vi.fn(async () => {});
    const mediaId = await uploadAccountMedia(client, putBytes, file, new Blob(), {
      purpose: 'organization_cover',
      allowed: ACCOUNT_IMAGE_MIMES,
    });
    expect(mediaId).toBe('m1');
    expect(client.post).toHaveBeenCalledWith('/media/uploads', {
      filename: 'cover.jpg',
      mimeType: 'image/jpeg',
      size: 100,
      purpose: 'organization_cover',
    });
    expect(putBytes).toHaveBeenCalledTimes(1);
    expect(client.post).toHaveBeenCalledWith('/media/m1/confirm');
  });

  it('rejects invalid files before any network call', async () => {
    const client = stubClient({});
    const putBytes = vi.fn(async () => {});
    await expect(
      uploadAccountMedia(client, putBytes, { ...file, type: 'video/mp4' }, new Blob(), {
        purpose: 'organization_cover',
        allowed: ACCOUNT_IMAGE_MIMES,
      }),
    ).rejects.toThrow('INVALID_FILE_TYPE');
    expect(client.post).not.toHaveBeenCalled();
    expect(putBytes).not.toHaveBeenCalled();
  });
});

describe('diffAccountForm', () => {
  const stored = {
    nameAr: 'جمعية الأمل',
    nameFr: 'Association El-Amel',
    website: 'https://el-amel.example.org',
    email: 'org@example.com',
    phone: '+213555123456',
  };
  const values = {
    nameAr: 'جمعية الأمل',
    nameFr: 'Association El-Amel',
    website: 'https://el-amel.example.org',
    email: 'org@example.com',
    phone: '+213555123456',
  };

  it('returns an empty, clean diff when nothing changed', () => {
    expect(diffAccountForm(stored, values)).toEqual({
      orgInput: {},
      userInput: {},
      invalid: [],
      dirty: false,
    });
  });

  it('phone-only edit with human formatting normalizes and sends just the phone', () => {
    // Regression: spaced/dashed input used to fail validation with no
    // request sent; it now normalizes to the backend-accepted form.
    const diff = diffAccountForm(stored, { ...values, phone: '+213 555 98 76 54' });
    expect(diff.invalid).toEqual([]);
    expect(diff.orgInput).toEqual({});
    expect(diff.userInput).toEqual({ phone: '+213555987654' });
    expect(diff.dirty).toBe(true);
  });

  it('re-typed but identical phone digits are not dirty', () => {
    const diff = diffAccountForm(stored, { ...values, phone: '+213 555 12 34 56' });
    expect(diff.invalid).toEqual([]);
    expect(diff.userInput).toEqual({});
    expect(diff.dirty).toBe(false);
  });

  it('flags letters in phone without sending anything for that field', () => {
    const diff = diffAccountForm(stored, { ...values, phone: '+213abc1234' });
    expect(diff.invalid).toEqual(['phone']);
    expect(diff.userInput).toEqual({});
    expect(diff.dirty).toBe(false);
  });

  it('never includes untouched fields, so one field cannot fail on another', () => {
    const diff = diffAccountForm(stored, { ...values, nameFr: 'Association El-Amel 2' });
    expect(diff.invalid).toEqual([]);
    expect(diff.orgInput).toEqual({ nameFr: 'Association El-Amel 2' });
    expect(diff.userInput).toEqual({});
  });
});

describe('accountSaveFieldError', () => {
  const conflict = (message = 'The email or phone is already used by another account') =>
    new ApiError({ statusCode: 409, code: 'CONTACT_CONFLICT', message });

  it('attributes a taken-number 409 to the phone field on a phone-only save', () => {
    // Exact reported failure: PATCH /users/me {phone} rejected 409 used to
    // render only the generic error; it now maps to the phone field.
    expect(accountSaveFieldError(conflict(), { email: false, phone: true })).toBe('phone');
  });

  it('attributes a taken-email 409 to the email field on an email-only save', () => {
    expect(accountSaveFieldError(conflict(), { email: true, phone: false })).toBe('email');
  });

  it('stays generic when both contact fields were sent with a 409', () => {
    expect(accountSaveFieldError(conflict(), { email: true, phone: true })).toBeNull();
  });

  it('maps backend validation details to their field', () => {
    const phoneError = new ApiError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: [{ field: 'phone', errors: ['phone must be a valid phone number'] }],
    });
    expect(accountSaveFieldError(phoneError, { email: false, phone: true })).toBe('phone');
    const unknownField = new ApiError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: [{ field: 'mystery', errors: ['bad'] }],
    });
    expect(accountSaveFieldError(unknownField, { email: false, phone: true })).toBeNull();
  });

  it('keeps the generic fallback for server, session, and network failures', () => {
    const server = new ApiError({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'boom' });
    expect(accountSaveFieldError(server, { email: false, phone: true })).toBeNull();
    const expired = new ApiError({ statusCode: 401, code: 'UNAUTHORIZED', message: 'expired' });
    expect(accountSaveFieldError(expired, { email: false, phone: true })).toBeNull();
    expect(accountSaveFieldError(new Error('down'), { email: false, phone: true })).toBeNull();
    expect(accountSaveFieldError(null, { email: false, phone: true })).toBeNull();
  });
});
