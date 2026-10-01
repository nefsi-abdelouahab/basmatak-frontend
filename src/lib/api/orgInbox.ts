import { z } from 'zod';
import type { AxiosInstance } from 'axios';

// F11 org-review module: one typed function per review-queue backend endpoint
// (base `/api/v1`). Verified read-only against backend/src:
// - applications.controller: GET /organizations/me/applications
//   (OrganizationApplicationsQueryDto: ?opportunityId=&status=&q=, cursor
//   `cursor`/`limit`, CursorPage with name joins); GET
//   /opportunities/:opportunityId/applications (owner-scoped per-opp view);
//   GET /applications/:applicationId (organization role reads own-org rows
//   with joins); POST /applications/:applicationId/start-review (pending only,
//   else 409 INVALID_APPLICATION_STATUS); POST
//   /applications/:applicationId/accept (pending|under_review, transaction incl.
//   seat + participation); POST /applications/:applicationId/reject
//   (pending|under_review, `{reason}` required).
// - participations.controller: GET /organizations/me/participants
//   (OrgParticipantsQueryDto: ?q=&opportunityId=&status=, cursor
//   `cursor`/`limit`, CursorPage incl. `completed` + submission-state/files
//   join); GET /opportunities/:opportunityId/participants (owner-scoped
//   per-opp view); POST /participations/:participationId/remove
//   (accepted|active only, `{reason}` required, seat stays allocated).
// - submissions.controller: GET /organizations/me/submissions
//   (SubmissionListQueryDto: ?status= single or comma-separated multi e.g.
//   `submitted,under_review`, ?opportunityId=&q=&format=(image|video|document|
//   link)&sort=(newest|oldest), cursor `cursor`/`limit`, totals, volunteer
//   join); GET /submissions/:submissionId; POST
//   /submissions/:submissionId/start-review (submitted → under_review).
// - verifications.controller: POST /submissions/:submissionId/verify (single
//   atomic approve-and-mint, VerifyDto `{notes?, review?}` all optional — the
//   UI posts `{}`); POST /submissions/:submissionId/reject (RejectDto
//   `{reason}` required, maps to `rejected`); GET
//   /verifications/:verificationId (issued-verification read).
// - public-volunteers.controller: GET /volunteers/:username (applicant
//   skills/experiences via opt-out-gated public blocks: `skills` null unless
//   showSkills, `experiences` null unless showExperiences).
// - media.controller: GET /media/:mediaId → `{ media, url }` with 200; the
//   owning org passes via OrganizationOpportunityMediaAccess
//   (backend-v2-media-org-read, bound in media.module.ts): role
//   `organization`, purpose `submission_evidence`, visibility `private`,
//   submission → organization → organizations.userId === actor sub. File
//   evidence resolves to a signed read URL; link evidence to its stored URL.
// Summary/dashboard reads live in orgStats.ts (F9); opportunity CRUD in
// orgOpps.ts (F10); verified archive + CSV in orgRecords.ts (F12) — never
// here (FD file-disjointness).

export const CursorPageSchema = <T extends z.ZodTypeAny>(item: T) =>
  z
    .object({
      items: z.array(item),
      nextCursor: z.string().nullable().optional(),
      limit: z.number().optional(),
      total: z.number(),
      page: z.number().optional(),
      pages: z.number().optional(),
    })
    .passthrough();

// Exact backend vocabularies — tabs map 1:1, no invented states.
export const APPLICATION_STATUSES = [
  'pending',
  'under_review',
  'accepted',
  'rejected',
  'withdrawn',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const PARTICIPANT_STATUSES = [
  'accepted',
  'active',
  'completed',
  'withdrawn',
  'removed',
] as const;

export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

// Roster remove is valid exactly where the backend allows it.
export const REMOVABLE_PARTICIPANT_STATUSES: ParticipantStatus[] = [
  'accepted',
  'active',
];

export const SUBMISSION_INBOX_STATUSES = [
  'submitted',
  'under_review',
  'verified',
  'rejected',
] as const;

export type SubmissionInboxStatus = (typeof SUBMISSION_INBOX_STATUSES)[number];

// Default to-review filter: the multi-status the backend documents.
export const TO_REVIEW_STATUSES = 'submitted,under_review';

export const SUBMISSION_FORMATS = ['image', 'video', 'document', 'link'] as const;

export type SubmissionFormat = (typeof SUBMISSION_FORMATS)[number];

export const SUBMISSION_INBOX_SORTS = ['newest', 'oldest'] as const;

export type SubmissionInboxSort = (typeof SUBMISSION_INBOX_SORTS)[number];

export const JoinedNameSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    username: z.string().nullable().optional(),
    nameFr: z.string().nullable().optional(),
    nameAr: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    slug: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
  })
  .passthrough();

export type JoinedName = z.infer<typeof JoinedNameSchema>;

export const InboxApplicationSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    status: z.string(),
    message: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    positionId: z.string().nullable().optional(),
    opportunityId: z.string().nullable().optional(),
    volunteerId: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    applicant: JoinedNameSchema.nullable().optional(),
    volunteer: JoinedNameSchema.nullable().optional(),
    opportunity: JoinedNameSchema.nullable().optional(),
    position: JoinedNameSchema.nullable().optional(),
  })
  .passthrough();

export type InboxApplication = z.infer<typeof InboxApplicationSchema>;

export const InboxParticipantSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    status: z.string(),
    reason: z.string().nullable().optional(),
    opportunityId: z.string().nullable().optional(),
    volunteerId: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    volunteer: JoinedNameSchema.nullable().optional(),
    opportunity: JoinedNameSchema.nullable().optional(),
    submission: z.unknown().nullable().optional(),
  })
  .passthrough();

export type InboxParticipant = z.infer<typeof InboxParticipantSchema>;

export const SubmissionEvidenceSchema = z
  .object({
    mediaId: z.string(),
  })
  .passthrough();

export type SubmissionEvidence = z.infer<typeof SubmissionEvidenceSchema>;

export const InboxSubmissionSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    status: z.string(),
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    opportunityId: z.string().nullable().optional(),
    participationId: z.string().nullable().optional(),
    volunteerId: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    volunteer: JoinedNameSchema.nullable().optional(),
    opportunity: JoinedNameSchema.nullable().optional(),
    evidence: z.array(SubmissionEvidenceSchema).nullable().optional(),
    review: z.unknown().nullable().optional(),
  })
  .passthrough();

export type InboxSubmission = z.infer<typeof InboxSubmissionSchema>;

// Applicant context: opt-out-gated public blocks only (null when hidden).
// Permissive by design — hidden blocks render as neutral empty states.
export const ApplicantProfileSchema = z
  .object({
    username: z.string(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    skills: z.array(z.unknown()).nullable().optional(),
    experiences: z.array(z.unknown()).nullable().optional(),
    areasOfContribution: z.array(z.unknown()).nullable().optional(),
  })
  .passthrough();

export type ApplicantProfile = z.infer<typeof ApplicantProfileSchema>;

// Owning-org media read: `{ media, url }` with 200 (files resolve to a signed
// read URL, links to the stored external URL). Null when unresolvable — the
// UI renders the neutral empty state, never a broken embed.
export const EvidenceMediaSchema = z
  .object({
    media: z.unknown().optional(),
    url: z.string().nullable().optional(),
    signedUrl: z.string().nullable().optional(),
  })
  .passthrough();

export type EvidenceMedia = z.infer<typeof EvidenceMediaSchema>;

export function evidenceUrlOf(media: EvidenceMedia | undefined): string | null {
  if (!media) return null;
  return media.url ?? media.signedUrl ?? null;
}

export const VerificationReadSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    status: z.string().optional(),
    submissionId: z.string().nullable().optional(),
    verificationCode: z.string().nullable().optional(),
    createdAt: z.string().optional(),
  })
  .passthrough();

export type VerificationRead = z.infer<typeof VerificationReadSchema>;

export type InboxApplicationPage = z.infer<
  ReturnType<typeof CursorPageSchema>
>;
export type InboxParticipantPage = z.infer<
  ReturnType<typeof CursorPageSchema>
>;
export type InboxSubmissionPage = z.infer<
  ReturnType<typeof CursorPageSchema>
>;

export function rowId(row: { id?: string; _id?: string }): string {
  return row.id ?? row._id ?? '';
}

export function evidenceIdsOf(
  submission: Pick<InboxSubmission, 'evidence'> | undefined,
): string[] {
  if (!submission || !Array.isArray(submission.evidence)) return [];
  return submission.evidence
    .map((item) => item.mediaId)
    .filter((id) => typeof id === 'string' && id.length > 0);
}

// Reason dialogs: submit stays blocked while the trimmed reason is empty
// (backend RejectDto/MinLength(1) would 400/422 otherwise).
export function isReasonValid(reason: string): boolean {
  return reason.trim().length > 0;
}

// Action-availability gates mirror the backend transition guards exactly:
// start-review (pending only), accept/reject (pending|under_review),
// remove (accepted|active), submission start-review (submitted only),
// verify/reject (submitted|under_review). Anything else renders no button
// (the backend answers 409) — never a disabled invented state.
export function canStartReviewApplication(status: string): boolean {
  return status === 'pending';
}

export function canAcceptApplication(status: string): boolean {
  return status === 'pending' || status === 'under_review';
}

export function canRejectApplication(status: string): boolean {
  return status === 'pending' || status === 'under_review';
}

export function canRemoveParticipation(status: string): boolean {
  return (REMOVABLE_PARTICIPANT_STATUSES as string[]).includes(status);
}

export function canStartReviewSubmission(status: string): boolean {
  return status === 'submitted';
}

export function canDecideSubmission(status: string): boolean {
  return status === 'submitted' || status === 'under_review';
}

function dropEmpty(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
  );
}

// Shared query builder for the three queues: multi-status arrays join with
// commas (SubmissionListQueryDto documents `submitted,under_review`); empty
// values drop so the backend applies its defaults.
export function buildInboxQuery(filters: {
  opportunityId?: string;
  status?: string | string[];
  q?: string;
  format?: string;
  sort?: string;
  cursor?: string;
  limit?: number;
}): Record<string, unknown> {
  const status = Array.isArray(filters.status)
    ? filters.status.join(',')
    : filters.status;
  return dropEmpty({
    opportunityId: filters.opportunityId,
    status,
    q: filters.q,
    format: filters.format,
    sort: filters.sort,
    cursor: filters.cursor,
    limit: filters.limit,
  });
}

type HttpClient = Pick<AxiosInstance, 'get' | 'post'>;

export interface InboxListParams {
  opportunityId?: string;
  status?: string | string[];
  q?: string;
  sort?: string;
  cursor?: string;
  limit?: number;
}

export async function listOrgApplications(
  client: HttpClient,
  params?: InboxListParams,
): Promise<InboxApplicationPage> {
  const { data } = await client.get('/organizations/me/applications', {
    params: buildInboxQuery(params ?? {}),
  });
  return CursorPageSchema(InboxApplicationSchema).parse(data);
}

export async function listOpportunityApplications(
  client: HttpClient,
  opportunityId: string,
  params?: Omit<InboxListParams, 'opportunityId'>,
): Promise<InboxApplicationPage> {
  const { data } = await client.get(
    `/opportunities/${encodeURIComponent(opportunityId)}/applications`,
    { params: buildInboxQuery(params ?? {}) },
  );
  return CursorPageSchema(InboxApplicationSchema).parse(data);
}

export async function getOrgApplication(
  client: HttpClient,
  applicationId: string,
): Promise<InboxApplication> {
  const { data } = await client.get(
    `/applications/${encodeURIComponent(applicationId)}`,
  );
  return InboxApplicationSchema.parse(data);
}

export async function startReviewApplication(
  client: HttpClient,
  applicationId: string,
): Promise<InboxApplication> {
  const { data } = await client.post(
    `/applications/${encodeURIComponent(applicationId)}/start-review`,
  );
  return InboxApplicationSchema.parse(data);
}

export async function acceptApplication(
  client: HttpClient,
  applicationId: string,
): Promise<InboxApplication> {
  const { data } = await client.post(
    `/applications/${encodeURIComponent(applicationId)}/accept`,
  );
  return InboxApplicationSchema.parse(data);
}

export async function rejectApplication(
  client: HttpClient,
  applicationId: string,
  input: { reason: string },
): Promise<InboxApplication> {
  const { data } = await client.post(
    `/applications/${encodeURIComponent(applicationId)}/reject`,
    { reason: input.reason },
  );
  return InboxApplicationSchema.parse(data);
}

export async function getApplicantProfile(
  client: HttpClient,
  username: string,
): Promise<ApplicantProfile> {
  const { data } = await client.get(
    `/volunteers/${encodeURIComponent(username)}`,
  );
  return ApplicantProfileSchema.parse(data);
}

export async function listOrgParticipants(
  client: HttpClient,
  params?: InboxListParams,
): Promise<InboxParticipantPage> {
  const { data } = await client.get('/organizations/me/participants', {
    params: buildInboxQuery(params ?? {}),
  });
  return CursorPageSchema(InboxParticipantSchema).parse(data);
}

export async function listOpportunityParticipants(
  client: HttpClient,
  opportunityId: string,
  params?: Omit<InboxListParams, 'opportunityId'>,
): Promise<InboxParticipantPage> {
  const { data } = await client.get(
    `/opportunities/${encodeURIComponent(opportunityId)}/participants`,
    { params: buildInboxQuery(params ?? {}) },
  );
  return CursorPageSchema(InboxParticipantSchema).parse(data);
}

export async function removeParticipation(
  client: HttpClient,
  participationId: string,
  input: { reason: string },
): Promise<InboxParticipant> {
  const { data } = await client.post(
    `/participations/${encodeURIComponent(participationId)}/remove`,
    { reason: input.reason },
  );
  return InboxParticipantSchema.parse(data);
}

export interface SubmissionInboxParams extends InboxListParams {
  format?: SubmissionFormat;
  sort?: SubmissionInboxSort;
}

export async function listOrgSubmissions(
  client: HttpClient,
  params?: SubmissionInboxParams,
): Promise<InboxSubmissionPage> {
  const { data } = await client.get('/organizations/me/submissions', {
    params: buildInboxQuery(params ?? {}),
  });
  return CursorPageSchema(InboxSubmissionSchema).parse(data);
}

export async function getOrgSubmission(
  client: HttpClient,
  submissionId: string,
): Promise<InboxSubmission> {
  const { data } = await client.get(
    `/submissions/${encodeURIComponent(submissionId)}`,
  );
  return InboxSubmissionSchema.parse(data);
}

export async function startReviewSubmission(
  client: HttpClient,
  submissionId: string,
): Promise<InboxSubmission> {
  const { data } = await client.post(
    `/submissions/${encodeURIComponent(submissionId)}/start-review`,
  );
  return InboxSubmissionSchema.parse(data);
}

export async function verifySubmission(
  client: HttpClient,
  submissionId: string,
): Promise<InboxSubmission> {
  // Single atomic approve-and-mint: VerifyDto is all-optional, so the UI
  // posts an empty body (no invented notes/review payload).
  const { data } = await client.post(
    `/submissions/${encodeURIComponent(submissionId)}/verify`,
    {},
  );
  return InboxSubmissionSchema.parse(data);
}

export async function rejectSubmission(
  client: HttpClient,
  submissionId: string,
  input: { reason: string },
): Promise<InboxSubmission> {
  const { data } = await client.post(
    `/submissions/${encodeURIComponent(submissionId)}/reject`,
    { reason: input.reason },
  );
  return InboxSubmissionSchema.parse(data);
}

export async function getVerification(
  client: HttpClient,
  verificationId: string,
): Promise<VerificationRead> {
  const { data } = await client.get(
    `/verifications/${encodeURIComponent(verificationId)}`,
  );
  return VerificationReadSchema.parse(data);
}

// Owning-org private evidence read (backend-v2-media-org-read): 200 +
// `{ media, url }` for the owning org; 403 MEDIA_ACCESS_DENIED for strangers
// (surfaced via the F0 error mapping), 404 for unknown ids.
export async function getEvidenceMedia(
  client: HttpClient,
  mediaId: string,
): Promise<EvidenceMedia> {
  const { data } = await client.get(`/media/${encodeURIComponent(mediaId)}`);
  return EvidenceMediaSchema.parse(data);
}
