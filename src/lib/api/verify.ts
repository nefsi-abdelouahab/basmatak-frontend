import { z } from 'zod';
import type { AxiosInstance } from 'axios';
import {
  PublicExperienceEvidenceSchema,
  PublicExperienceReviewSchema,
  PublicOrganizationEmbedSchema,
} from './publicTalent';

// Public certificate verification module: one typed read of
// `GET /verify/:verificationCode` (backend `PublicVerificationController` ->
// `ExperiencesService.getPublicProof`). The backend returns a loose
// `Record<string, unknown>`, so every field is optional except the echoed
// `verificationCode`; `.passthrough()` keeps future additive fields from
// breaking the page.
//
// PRIVACY: `volunteer.firstName` is only present when the profile's
// `showBiography` gate is open. `volunteer.handle` is the username fallback.
// `fullName` is never part of this payload and must never be rendered.
// `skills` are raw skill-id strings; the page resolves names from the public
// skills endpoint (no backend join in scope).

export const VerificationVolunteerSchema = z
  .object({
    handle: z.string().optional(),
    firstName: z.string().nullable().optional(),
  })
  .passthrough();

export type VerificationVolunteer = z.infer<typeof VerificationVolunteerSchema>;

export const VerificationProofSchema = z
  .object({
    registryId: z.string().optional(),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    skills: z.array(z.string()).optional().default([]),
    /** MINUTES (same unit as every public experience duration). */
    duration: z.number().optional(),
    organization: PublicOrganizationEmbedSchema.nullable().optional(),
    verifiedAt: z.string().optional(),
    verificationCode: z.string(),
    review: PublicExperienceReviewSchema.nullable().optional(),
    volunteer: VerificationVolunteerSchema.nullable().optional(),
    evidence: z.array(PublicExperienceEvidenceSchema).optional().default([]),
  })
  .passthrough();

export type VerificationProof = z.infer<typeof VerificationProofSchema>;

type HttpClient = Pick<AxiosInstance, 'get'>;

/**
 * Accepts a bare code, a lowercase code, surrounding whitespace, or a pasted
 * `/verify/<code>` URL (with locale, query, or hash) and returns the canonical
 * uppercase code. Unknown shapes are returned trimmed/uppercased so the API can
 * answer with its real 404 instead of the client inventing validation errors.
 */
export function normalizeVerificationCode(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  const withoutQuery = trimmed.split(/[?#]/, 1)[0] ?? '';
  const withoutTrailingSlash = withoutQuery.replace(/\/+$/, '');
  const lastSegment = withoutTrailingSlash.split('/').pop() ?? withoutTrailingSlash;
  return lastSegment.replace(/\s+/g, '').toUpperCase();
}

export async function fetchPublicProof(
  client: HttpClient,
  code: string,
): Promise<VerificationProof> {
  const normalized = normalizeVerificationCode(code);
  const { data } = await client.get(`/verify/${encodeURIComponent(normalized)}`);
  return VerificationProofSchema.parse(data);
}
