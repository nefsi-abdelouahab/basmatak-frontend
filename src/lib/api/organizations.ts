import axios from 'axios';
import { z } from 'zod';
import type { AxiosInstance } from 'axios';

// F3 organizations module: one typed function per organization/location/media
// backend endpoint owned by this session (base `/api/v1`). Verified read-only
// against backend/src/organizations (controller + service + DTO) and
// backend/src/locations + backend/src/media:
// GET/PATCH /organizations/me, GET /organizations/me/profile-completion
// ({percent, missing, complete} over 11 keys), POST/GET
// /organizations/me/verification, DELETE /organizations/me,
// GET /locations/wilayas, GET /locations/wilayas/:wilayaId/municipalities,
// POST /media/uploads {filename, mimeType, size, purpose, visibility?} →
// {mediaId, uploadUrl}, POST /media/:mediaId/confirm.
//
// NOTE: F2's in-flight lib/api/media.ts is parallel-session work limited to
// images (avatar) — it is neither touched nor imported here. The small upload
// helpers below are scoped to this module (verification_document/pdf +
// organization_cover) so F3 stays file-disjoint; a later pass may unify them.

export const ORG_PHONE_PATTERN = /^\+?[0-9]{8,15}$/;
export const ORG_WEBSITE_PATTERN = /^https?:\/\/.+/;
const MONGO_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const DOSSIER_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const COVER_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AllowedMimes = readonly string[];

export function validateUploadFile(
  file: { type: string; size: number },
  allowed: AllowedMimes,
): { ok: true } | { ok: false; reason: 'type' | 'size' } {
  if (!allowed.includes(file.type)) return { ok: false, reason: 'type' };
  if (file.size < 1 || file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: 'size' };
  return { ok: true };
}

export const OrganizationSchema = z
  .object({
    registryId: z.string().optional(),
    verificationStatus: z.string().optional(),
    nameAr: z.string().optional(),
    nameFr: z.string().optional(),
    description: z.string().optional(),
    logoMediaId: z.string().optional(),
    coverMediaId: z.string().optional(),
    type: z.string().optional(),
    registrationNumber: z.string().optional(),
    location: z
      .object({
        wilayaId: z.string().optional(),
        municipalityId: z.string().optional(),
        address: z.string().optional(),
      })
      .passthrough()
      .optional(),
    website: z.string().optional(),
    foundedYear: z.number().optional(),
    contact: z
      .object({ email: z.string().optional(), phone: z.string().optional() })
      .passthrough()
      .optional(),
    focusDisciplines: z.array(z.string()).optional(),
    operatingScope: z.string().optional(),
  })
  .passthrough();

export type Organization = z.infer<typeof OrganizationSchema>;

const mongoId = z.string().regex(MONGO_ID_PATTERN);

export const UpdateOrganizationInputSchema = z.object({
  nameAr: z.string().max(200).optional(),
  nameFr: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  logoMediaId: mongoId.optional(),
  coverMediaId: mongoId.optional(),
  type: z.string().optional(),
  registrationNumber: z.string().optional(),
  location: z
    .object({
      wilayaId: z.string().optional(),
      municipalityId: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  website: z.string().regex(ORG_WEBSITE_PATTERN).optional(),
  foundedYear: z.number().int().optional(),
  contact: z
    .object({
      email: z.string().email().optional(),
      phone: z.string().regex(ORG_PHONE_PATTERN).optional(),
    })
    .optional(),
  focusDisciplines: z.array(mongoId).optional(),
  operatingScope: z.string().optional(),
});

export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationInputSchema>;

export const ProfileCompletionSchema = z.object({
  percent: z.number(),
  missing: z.array(z.string()),
  complete: z.boolean(),
});

export type ProfileCompletion = z.infer<typeof ProfileCompletionSchema>;

export const VerificationStatusSchema = z.object({
  verificationStatus: z.string(),
  latest: z
    .object({
      status: z.string().optional(),
      documents: z.array(z.string()).optional(),
      rejectionReason: z.string().nullable().optional(),
    })
    .passthrough()
    .nullable()
    .optional(),
});

export type OrganizationVerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const SubmitVerificationInputSchema = z.object({
  documents: z.array(z.string().min(1)).min(1),
});

export type SubmitVerificationInput = z.infer<typeof SubmitVerificationInputSchema>;

export const LocationRowSchema = z
  .object({
    code: z.string(),
    nameFr: z.string(),
    nameAr: z.string(),
  })
  .passthrough();

export type LocationRow = z.infer<typeof LocationRowSchema>;

export const UploadTicketSchema = z.object({
  mediaId: z.string(),
  uploadUrl: z.string().url(),
});

export type UploadTicket = z.infer<typeof UploadTicketSchema>;

export interface UploadProgress {
  loaded: number;
  total?: number;
  percent: number;
}

type HttpClient = Pick<AxiosInstance, 'get' | 'post' | 'patch' | 'delete'>;

export async function getOwnOrganization(client: HttpClient): Promise<Organization> {
  const { data } = await client.get('/organizations/me');
  return OrganizationSchema.parse(data);
}

export async function updateOwnOrganization(
  client: HttpClient,
  input: UpdateOrganizationInput,
): Promise<Organization> {
  const { data } = await client.patch('/organizations/me', input);
  return OrganizationSchema.parse(data);
}

export async function getProfileCompletion(
  client: HttpClient,
): Promise<ProfileCompletion> {
  const { data } = await client.get('/organizations/me/profile-completion');
  return ProfileCompletionSchema.parse(data);
}

export async function deleteOwnOrganization(
  client: HttpClient,
): Promise<{ deleted: boolean; organizationId: string }> {
  const { data } = await client.delete('/organizations/me');
  return z.object({ deleted: z.boolean(), organizationId: z.string() }).parse(data);
}

export async function submitOrganizationVerification(
  client: HttpClient,
  input: SubmitVerificationInput,
): Promise<unknown> {
  const { data } = await client.post('/organizations/me/verification', input);
  return data;
}

export async function getOrganizationVerificationStatus(
  client: HttpClient,
): Promise<OrganizationVerificationStatus> {
  const { data } = await client.get('/organizations/me/verification');
  return VerificationStatusSchema.parse(data);
}

export async function listWilayas(client: HttpClient): Promise<LocationRow[]> {
  const { data } = await client.get('/locations/wilayas');
  return z.array(LocationRowSchema).parse(data);
}

export async function listMunicipalities(
  client: HttpClient,
  wilayaId: string,
): Promise<LocationRow[]> {
  const { data } = await client.get(`/locations/wilayas/${wilayaId}/municipalities`);
  return z.array(LocationRowSchema).parse(data);
}

export async function createMediaUpload(
  client: Pick<AxiosInstance, 'post'>,
  input: { filename: string; mimeType: string; size: number; purpose: string },
): Promise<UploadTicket> {
  const { data } = await client.post('/media/uploads', input);
  return UploadTicketSchema.parse(data);
}

export async function confirmMediaUpload(
  client: Pick<AxiosInstance, 'post'>,
  mediaId: string,
): Promise<void> {
  await client.post(`/media/${mediaId}/confirm`);
}

// Raw-bytes PUT goes straight at the presigned URL (never through the app
// axios instance — no auth headers, no /api/v1 base).
export async function putUploadBytesAxios(
  uploadUrl: string,
  file: Blob,
  onProgress?: (p: UploadProgress) => void,
): Promise<void> {
  await axios.put(uploadUrl, file, {
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    onUploadProgress: (event) => {
      if (!onProgress) return;
      const total = event.total ?? undefined;
      const loaded = event.loaded;
      onProgress({
        loaded,
        total,
        percent: total ? Math.round((loaded / total) * 100) : 0,
      });
    },
  });
}

// Full 2-step flow scoped to this module: create → PUT bytes (progress) →
// confirm → mediaId. File type/size are validated before any network call.
export async function uploadOrgMedia(
  client: Pick<AxiosInstance, 'post'>,
  file: { name: string; type: string; size: number; blob: Blob },
  opts: { purpose: string; allowed: AllowedMimes; onProgress?: (p: UploadProgress) => void },
): Promise<string> {
  const valid = validateUploadFile(file, opts.allowed);
  if (!valid.ok) throw new Error(`INVALID_FILE_${valid.reason.toUpperCase()}`);
  const ticket = await createMediaUpload(client, {
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    purpose: opts.purpose,
  });
  await putUploadBytesAxios(ticket.uploadUrl, file.blob, opts.onProgress);
  await confirmMediaUpload(client, ticket.mediaId);
  return ticket.mediaId;
}
