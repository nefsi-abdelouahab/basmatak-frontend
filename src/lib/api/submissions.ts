import { z } from 'zod';
import type { AxiosInstance } from 'axios';

// F7 submissions module: one typed function per volunteer-side submission or
// evidence endpoint owned by this session (base `/api/v1`). Verified read-only
// against backend/src/submissions (controller + submission.dto.ts + service)
// and backend/src/media (controller + media.dto.ts + media.constants.ts):
// - POST /participations/:participationId/submissions (create draft, {title?} ≤200)
// - GET /submissions/me (own list, CursorPage), GET /submissions/:submissionId
// - PATCH /submissions/:submissionId (title ≤200, description ≤5000,
//   evidence ≤50 ObjectIds, consentConfirmed; rejected→draft transition)
// - POST /submissions/:submissionId/submit ({consentConfirmed?}; requires
//   description + ≥1 evidence per deliverables; 400 CONSENT_REQUIRED when
//   imagery evidence lacks consent)
// - POST /media/links {url, purpose, visibility?} (video-as-link, host
//   allowlist), DELETE /media/:mediaId (evidence removal).
//
// NOTE: file uploads/confirms are NOT duplicated here — they live in F2's
// lib/api/media.ts (import-only, deviation 1 approved). This module owns only
// link/delete plus evidence validators scoped to purpose `submission_evidence`.

export const SUBMISSION_PURPOSE = 'submission_evidence' as const;

export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

export const EVIDENCE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type EvidenceMime = (typeof EVIDENCE_MIMES)[number];

export const ALLOWED_LINK_HOSTS = ['youtube.com', 'youtu.be', 'drive.google.com'] as const;

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export function validateEvidenceFile(file: {
  name: string;
  type: string;
  size: number;
}): { ok: true } | { ok: false; reason: 'type' | 'size' } {
  if (!(EVIDENCE_MIMES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: 'type' };
  }
  if (file.size < 1 || file.size > MAX_EVIDENCE_BYTES) {
    return { ok: false, reason: 'size' };
  }
  return { ok: true };
}

// Mirrors backend `assertAllowedLinkHost`: https only; youtube.com and
// drive.google.com match exactly or as subdomains; youtu.be is exact-match
// only (no subdomains). Returns the normalized URL or a rejection reason.
export function isAllowedEvidenceLink(
  raw: string,
): { ok: true; url: string } | { ok: false; reason: 'url' | 'host' } {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'url' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, reason: 'url' };
  const host = parsed.hostname.toLowerCase();
  if (host === 'youtu.be') return { ok: true, url: parsed.toString() };
  if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    return { ok: true, url: parsed.toString() };
  }
  if (host === 'drive.google.com' || host.endsWith('.drive.google.com')) {
    return { ok: true, url: parsed.toString() };
  }
  return { ok: false, reason: 'host' };
}

export const SUBMISSION_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

// Evidence reads carry `{ mediaId }` entries (backend stores
// `evidence: [{ mediaId }]`; detail expands them with media metadata), while
// writes send ObjectId strings — so reads accept both shapes. The backend
// names the participation link `participantId` (unique index); older clients
// read `participationId`, so both keys are accepted (passthrough keeps them).
export const SubmissionEvidenceEntrySchema = z
  .object({ mediaId: z.unknown().optional() })
  .passthrough();

export const SubmissionSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    participationId: z.unknown().optional(),
    participantId: z.unknown().optional(),
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    evidence: z.array(z.union([z.string(), SubmissionEvidenceEntrySchema])).optional(),
    consentConfirmed: z.boolean().nullable().optional(),
    status: z.string().optional(),
    rejectionReason: z.string().nullable().optional(),
    review: z.unknown().nullable().optional(),
  })
  .passthrough();

export type Submission = z.infer<typeof SubmissionSchema>;

export function submissionIdOf(s: Submission): string {
  return (s.id ?? s._id ?? '') as string;
}

export function submissionStatusOf(s: Submission): string {
  return s.status ?? 'draft';
}

// The backend names the participation link `participantId` (unique index);
// reads accept the legacy `participationId` alias too. Serialized ObjectIds
// arrive as strings — non-string values coerce, missing links yield ''.
export function submissionParticipantIdOf(s: Submission): string {
  const raw = (s.participantId ?? s.participationId ?? '') as unknown;
  return typeof raw === 'string' ? raw : String(raw ?? '');
}

// Evidence entries arrive as `{ mediaId }` objects on reads (detail expands
// them with media metadata) and as ObjectId strings on writes.
export function evidenceMediaIdOf(entry: string | { mediaId?: unknown }): string {
  if (typeof entry === 'string') return entry;
  const raw = (entry as { mediaId?: unknown } | null | undefined)?.mediaId;
  return typeof raw === 'string' ? raw : String(raw ?? '');
}

export function evidenceMediaIdsOf(s: Submission): string[] {
  if (!Array.isArray(s.evidence)) return [];
  return s.evidence.map(evidenceMediaIdOf).filter((id) => id !== '');
}

export const CreateSubmissionInputSchema = z.object({
  title: z.string().max(200).optional(),
});

export type CreateSubmissionInput = z.infer<typeof CreateSubmissionInputSchema>;

export const UpdateSubmissionInputSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  evidence: z.array(z.string().regex(OBJECT_ID)).max(50).optional(),
  consentConfirmed: z.boolean().optional(),
});

export type UpdateSubmissionInput = z.infer<typeof UpdateSubmissionInputSchema>;

export const SubmitSubmissionInputSchema = z.object({
  consentConfirmed: z.boolean().optional(),
});

export type SubmitSubmissionInput = z.infer<typeof SubmitSubmissionInputSchema>;

export const LinkedMediaSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    mediaId: z.string().optional(),
    url: z.string().optional(),
  })
  .passthrough();

export type LinkedMedia = z.infer<typeof LinkedMediaSchema>;

export function linkedMediaIdOf(m: LinkedMedia): string {
  return (m.mediaId ?? m.id ?? m._id ?? '') as string;
}

type HttpClient = Pick<AxiosInstance, 'get' | 'post' | 'patch' | 'delete'>;

export async function createSubmission(
  client: HttpClient,
  participationId: string,
  input?: CreateSubmissionInput,
): Promise<Submission> {
  const { data } = await client.post(
    `/participations/${participationId}/submissions`,
    input ?? {},
  );
  return SubmissionSchema.parse(data);
}

export async function getSubmission(
  client: HttpClient,
  submissionId: string,
): Promise<Submission> {
  const { data } = await client.get(`/submissions/${submissionId}`);
  return SubmissionSchema.parse(data);
}

export async function listMySubmissions(
  client: HttpClient,
  params?: { cursor?: string; limit?: number },
): Promise<Submission[]> {
  const { data } = await client.get('/submissions/me', { params });
  if (Array.isArray(data)) return z.array(SubmissionSchema).parse(data);
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    return z.array(SubmissionSchema).parse((data as { items: unknown }).items);
  }
  return z.array(SubmissionSchema).parse(data);
}

export async function patchSubmission(
  client: HttpClient,
  submissionId: string,
  input: UpdateSubmissionInput,
): Promise<Submission> {
  const { data } = await client.patch(`/submissions/${submissionId}`, input);
  return SubmissionSchema.parse(data);
}

export async function submitSubmission(
  client: HttpClient,
  submissionId: string,
  input?: SubmitSubmissionInput,
): Promise<Submission> {
  const { data } = await client.post(`/submissions/${submissionId}/submit`, input ?? {});
  return SubmissionSchema.parse(data);
}

export async function createMediaLink(
  client: HttpClient,
  input: { url: string; visibility?: string },
): Promise<LinkedMedia> {
  const { data } = await client.post('/media/links', {
    url: input.url,
    purpose: SUBMISSION_PURPOSE,
    ...(input.visibility ? { visibility: input.visibility } : {}),
  });
  return LinkedMediaSchema.parse(data);
}

export async function deleteMedia(client: HttpClient, mediaId: string): Promise<void> {
  await client.delete(`/media/${mediaId}`);
}

// Client-side submit readiness (mirrors backend submit rules): description
// non-empty + ≥1 evidence. Consent is gated separately via
// `needsImageryConsent` (imagery presence heuristic) so the checkbox error can
// target the consent control instead of the submit button.
export function submitReadiness(s: {
  description?: string | null;
  evidence?: string[];
}): { ok: true } | { ok: false; reason: 'description' | 'evidence' } {
  if (!s.description || s.description.trim().length === 0) {
    return { ok: false, reason: 'description' };
  }
  if (!s.evidence || s.evidence.length < 1) {
    return { ok: false, reason: 'evidence' };
  }
  return { ok: true };
}

// Whether the imagery-consent checkbox must be checked before submit.
// Mirrors the backend rule (`isImageryMedia` in submissions.service.ts):
// image/* files and external video links require consent; PDFs do not.
// Items whose kind is unknown (pre-existing server ids) conservatively
// require consent so `400 CONSENT_REQUIRED` never surprises.
export type EvidenceKind = 'image' | 'pdf' | 'link' | 'unknown';

export function needsImageryConsent(items: { kind: EvidenceKind }[]): boolean {
  return items.some((i) => i.kind === 'image' || i.kind === 'link' || i.kind === 'unknown');
}

export function evidenceKindOfMime(mime: string): EvidenceKind {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  return 'unknown';
}

export function isConsentRequiredError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code?: unknown }).code === 'CONSENT_REQUIRED';
  }
  return false;
}
