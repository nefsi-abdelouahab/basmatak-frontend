import { describe, expect, it, vi } from 'vitest';
import {
  COVER_MIMES,
  DOSSIER_MIMES,
  ORG_PHONE_PATTERN,
  ORG_WEBSITE_PATTERN,
  OrganizationSchema,
  ProfileCompletionSchema,
  UpdateOrganizationInputSchema,
  VerificationStatusSchema,
  confirmMediaUpload,
  createMediaUpload,
  deleteOwnOrganization,
  getOrganizationVerificationStatus,
  getOwnOrganization,
  getProfileCompletion,
  listMunicipalities,
  listWilayas,
  submitOrganizationVerification,
  updateOwnOrganization,
  uploadOrgMedia,
  validateUploadFile,
} from './organizations';

function stubClient(responses: Record<string, unknown>) {
  const respond = (key: string) => ({ data: responses[key] }) as never;
  return {
    get: vi.fn(async (url: string) => respond(`GET ${url}`)),
    post: vi.fn(async (url: string) => respond(`POST ${url}`)),
    patch: vi.fn(async (url: string) => respond(`PATCH ${url}`)),
    delete: vi.fn(async (url: string) => respond(`DELETE ${url}`)),
  };
}

describe('validateUploadFile', () => {
  it('accepts pdf for dossier but rejects it for cover', () => {
    const pdf = { type: 'application/pdf', size: 1024 };
    expect(validateUploadFile(pdf, DOSSIER_MIMES)).toEqual({ ok: true });
    expect(validateUploadFile(pdf, COVER_MIMES)).toEqual({ ok: false, reason: 'type' });
  });

  it('rejects oversized files before any upload', () => {
    expect(
      validateUploadFile({ type: 'image/png', size: 6 * 1024 * 1024 }, DOSSIER_MIMES),
    ).toEqual({ ok: false, reason: 'size' });
  });

  it('rejects unlisted types', () => {
    expect(validateUploadFile({ type: 'video/mp4', size: 100 }, DOSSIER_MIMES)).toEqual({
      ok: false,
      reason: 'type',
    });
  });
});

describe('phone and website patterns', () => {
  it('matches the backend phone rule (no spaces, 8-15 digits)', () => {
    expect(ORG_PHONE_PATTERN.test('+213555123456')).toBe(true);
    expect(ORG_PHONE_PATTERN.test('0555123456')).toBe(true);
    expect(ORG_PHONE_PATTERN.test('05 55 12 34 56')).toBe(false);
    expect(ORG_PHONE_PATTERN.test('1234567')).toBe(false);
  });

  it('requires http(s) websites', () => {
    expect(ORG_WEBSITE_PATTERN.test('https://example.org')).toBe(true);
    expect(ORG_WEBSITE_PATTERN.test('http://example.org')).toBe(true);
    expect(ORG_WEBSITE_PATTERN.test('example.org')).toBe(false);
    expect(ORG_WEBSITE_PATTERN.test('ftp://example.org')).toBe(false);
  });
});

describe('UpdateOrganizationInputSchema', () => {
  it('rejects bad phone/website/mongo ids client-side', () => {
    expect(
      UpdateOrganizationInputSchema.safeParse({ contact: { phone: 'bad' } }).success,
    ).toBe(false);
    expect(UpdateOrganizationInputSchema.safeParse({ website: 'notaurl' }).success).toBe(
      false,
    );
    expect(
      UpdateOrganizationInputSchema.safeParse({ coverMediaId: 'nope' }).success,
    ).toBe(false);
    expect(
      UpdateOrganizationInputSchema.safeParse({
        contact: { phone: '+213555123456' },
        website: 'https://example.org',
      }).success,
    ).toBe(true);
  });
});

describe('endpoint wiring', () => {
  it('reads own org + completion + verification status', async () => {
    const client = stubClient({
      'GET /organizations/me': { registryId: 'ORG-000123', verificationStatus: 'pending' },
      'GET /organizations/me/profile-completion': {
        percent: 64,
        missing: ['coverMediaId'],
        complete: false,
      },
      'GET /organizations/me/verification': {
        verificationStatus: 'pending',
        latest: { status: 'pending', documents: ['a'] },
      },
    });
    await expect(getOwnOrganization(client)).resolves.toMatchObject({
      registryId: 'ORG-000123',
    });
    await expect(getProfileCompletion(client)).resolves.toEqual(
      ProfileCompletionSchema.parse({
        percent: 64,
        missing: ['coverMediaId'],
        complete: false,
      }),
    );
    await expect(getOrganizationVerificationStatus(client)).resolves.toMatchObject({
      verificationStatus: 'pending',
    });
  });

  it('PATCHes facts and submits verification documents', async () => {
    const client = stubClient({
      'PATCH /organizations/me': { registryId: 'ORG-000123' },
      'POST /organizations/me/verification': { status: 'pending' },
      'DELETE /organizations/me': { deleted: true, organizationId: 'o1' },
      'GET /locations/wilayas': [{ code: '16', nameFr: 'Alger', nameAr: 'الجزائر' }],
      'GET /locations/wilayas/16/municipalities': [
        { code: '1601', nameFr: 'Alger Centre', nameAr: 'الجزائر الوسطى' },
      ],
      'POST /media/uploads': { mediaId: 'm1', uploadUrl: 'https://up.test/f' },
      'POST /media/m1/confirm': {},
    });
    await expect(
      updateOwnOrganization(client, { type: 'Association' }),
    ).resolves.toMatchObject({ registryId: 'ORG-000123' });
    expect(client.patch).toHaveBeenCalledWith('/organizations/me', {
      type: 'Association',
    });
    await expect(
      submitOrganizationVerification(client, { documents: ['m1'] }),
    ).resolves.toEqual({ status: 'pending' });
    await expect(deleteOwnOrganization(client)).resolves.toEqual({
      deleted: true,
      organizationId: 'o1',
    });
    await expect(listWilayas(client)).resolves.toHaveLength(1);
    await expect(listMunicipalities(client, '16')).resolves.toHaveLength(1);
    await expect(createMediaUpload(client, {
      filename: 'id.pdf',
      mimeType: 'application/pdf',
      size: 10,
      purpose: 'verification_document',
    })).resolves.toMatchObject({ mediaId: 'm1' });
    await confirmMediaUpload(client, 'm1');
    expect(client.post).toHaveBeenCalledWith('/media/m1/confirm');
  });

  it('uploadOrgMedia validates before any network call', async () => {
    const client = stubClient({});
    const blob = new Blob(['x'], { type: 'video/mp4' });
    await expect(
      uploadOrgMedia(client, { name: 'v.mp4', type: 'video/mp4', size: 10, blob }, {
        purpose: 'verification_document',
        allowed: DOSSIER_MIMES,
      }),
    ).rejects.toThrow('INVALID_FILE_TYPE');
    expect(client.post).not.toHaveBeenCalled();
  });
});

describe('schema leniency', () => {
  it('parses org payloads with extra backend fields', () => {
    expect(() =>
      OrganizationSchema.parse({ registryId: 'ORG-1', extraFuture: 1 }),
    ).not.toThrow();
    expect(() =>
      VerificationStatusSchema.parse({ verificationStatus: 'rejected', latest: null }),
    ).not.toThrow();
  });
});
