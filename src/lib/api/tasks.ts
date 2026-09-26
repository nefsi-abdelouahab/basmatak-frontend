import { z } from 'zod';
import type { AxiosInstance, AxiosResponse } from 'axios';
import { downloadBlob } from './download';

// F6 tasks module: one typed function per volunteer post-apply backend
// endpoint (base `/api/v1`). Verified read-only against backend/src:
// - applications.controller: GET applications/me (ApplicationListQueryDto:
//   ?status= in APPLICATION_STATUSES, ?from=/?to= ISO created-at bounds,
//   cursor `cursor`/`limit`), GET applications/:applicationId (owner/org),
//   POST applications/:applicationId/withdraw (valid from pending,
//   under_review, accepted — accepted path withdraws the matching
//   participation transactionally and frees the seat).
// - participations.controller: GET participations/me
//   (ParticipationListQueryDto: ?status= in PARTICIPANT_STATUSES only —
//   NO from/to params, cursor `cursor`/`limit`), GET
//   participations/:participationId (owner/org, Session 19
//   org/task/schedule/location + position-deliverables joins), POST
//   participations/:participationId/withdraw (accepted/active, frees the
//   seat via filledCount decrement).
// - activity.controller: GET volunteers/me/activity (ActivityFeedQueryDto:
//   cursor `cursor`/`limit`, newest first).
// - attestation.controller: GET experiences/:experienceId/attestation
//   (streamed PDF, `Content-Disposition: attachment`, never persisted).
// "Application ID" is a client-side ObjectId short form (applications have
// no registryId by design — V2 §C#2). No messaging, no submission, no
// visibility endpoints live here (F7/F8 own those files).

export const APPLICATION_STATUSES = [
  'pending',
  'under_review',
  'accepted',
  'rejected',
  'withdrawn',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const PARTICIPATION_STATUSES = [
  'accepted',
  'active',
  'completed',
  'withdrawn',
  'removed',
] as const;

export type ParticipationStatus = (typeof PARTICIPATION_STATUSES)[number];

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

export const JoinedNameSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    nameFr: z.string().nullable().optional(),
    nameAr: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    slug: z.string().nullable().optional(),
  })
  .passthrough();

export const ApplicationRowSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    status: z.string(),
    message: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    opportunityId: z.string().optional(),
    positionId: z.string().optional(),
    organization: JoinedNameSchema.nullable().optional(),
    opportunity: JoinedNameSchema.nullable().optional(),
    position: JoinedNameSchema.nullable().optional(),
    decisionActor: JoinedNameSchema.nullable().optional(),
    experienceId: z.string().nullable().optional(),
  })
  .passthrough();

export type ApplicationRow = z.infer<typeof ApplicationRowSchema>;

export const ParticipationRowSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    status: z.string(),
    reason: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    applicationId: z.string().optional(),
    opportunityId: z.string().optional(),
    positionId: z.string().optional(),
    organization: JoinedNameSchema.nullable().optional(),
    opportunity: JoinedNameSchema.nullable().optional(),
    position: JoinedNameSchema.nullable().optional(),
    schedule: z.unknown().nullable().optional(),
    locationLabels: JoinedNameSchema.nullable().optional(),
    experienceId: z.string().nullable().optional(),
  })
  .passthrough();

export type ParticipationRow = z.infer<typeof ParticipationRowSchema>;

export const ActivityItemSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    type: z.string().optional(),
    kind: z.string().optional(),
    title: z.string().nullable().optional(),
    createdAt: z.string().optional(),
  })
  .passthrough();

export type ActivityItem = z.infer<typeof ActivityItemSchema>;

export type ApplicationPage = z.infer<ReturnType<typeof CursorPageSchema>>;
export type ParticipationPage = z.infer<ReturnType<typeof CursorPageSchema>>;
export type ActivityPage = z.infer<ReturnType<typeof CursorPageSchema>>;

export interface ApplicationListParams {
  status?: ApplicationStatus;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export interface ParticipationListParams {
  status?: ParticipationStatus;
  cursor?: string;
  limit?: number;
}

export interface ActivityParams {
  cursor?: string;
  limit?: number;
}

function dropEmpty(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
  );
}

export function buildApplicationParams(params: ApplicationListParams): Record<string, unknown> {
  return dropEmpty({ ...params });
}

export function buildParticipationParams(
  params: ParticipationListParams,
): Record<string, unknown> {
  return dropEmpty({ ...params });
}

// Client-side short reference for applications (no backend id exists).
// Uppercase last 6 chars of the ObjectId hex string.
export function shortApplicationId(objectId: string): string {
  const hex = objectId.trim();
  return hex.slice(-6).toUpperCase();
}

export function rowId(row: { id?: string; _id?: string }): string {
  return row.id ?? row._id ?? '';
}

// Withdraw availability mirrors the backend transition whitelists:
// applications withdraw from pending/under_review/accepted;
// participations withdraw from accepted/active.
export function canWithdrawApplication(status: string): boolean {
  return status === 'pending' || status === 'under_review' || status === 'accepted';
}

export function canWithdrawParticipation(status: string): boolean {
  return status === 'accepted' || status === 'active';
}

export type TimelineStepState = 'done' | 'current' | 'todo';

// Neutral volunteer timeline (Submitted → Under review → Accepted).
// Rejected/withdrawn/removed render the reached steps plus a terminal flag.
export function applicationTimeline(status: string): {
  steps: TimelineStepState[];
  terminal: 'rejected' | 'withdrawn' | null;
} {
  if (status === 'rejected') return { steps: ['done', 'todo', 'todo'], terminal: 'rejected' };
  if (status === 'withdrawn') return { steps: ['done', 'todo', 'todo'], terminal: 'withdrawn' };
  if (status === 'under_review') return { steps: ['done', 'current', 'todo'], terminal: null };
  if (status === 'accepted') return { steps: ['done', 'done', 'current'], terminal: null };
  return { steps: ['current', 'todo', 'todo'], terminal: null };
}

export function participationTimeline(status: string): {
  steps: TimelineStepState[];
  terminal: 'withdrawn' | 'removed' | null;
} {
  if (status === 'withdrawn') return { steps: ['done', 'todo', 'todo'], terminal: 'withdrawn' };
  if (status === 'removed') return { steps: ['done', 'todo', 'todo'], terminal: 'removed' };
  if (status === 'active') return { steps: ['done', 'current', 'todo'], terminal: null };
  if (status === 'completed') return { steps: ['done', 'done', 'current'], terminal: null };
  return { steps: ['current', 'todo', 'todo'], terminal: null };
}

type HttpClient = Pick<AxiosInstance, 'get' | 'post'>;

export async function listMyApplications(
  client: HttpClient,
  params?: ApplicationListParams,
): Promise<ApplicationPage> {
  const { data } = await client.get('/applications/me', {
    params: buildApplicationParams(params ?? {}),
  });
  return CursorPageSchema(ApplicationRowSchema).parse(data);
}

export async function getApplication(
  client: HttpClient,
  applicationId: string,
): Promise<ApplicationRow> {
  const { data } = await client.get(`/applications/${applicationId}`);
  return ApplicationRowSchema.parse(data);
}

export async function withdrawApplication(
  client: HttpClient,
  applicationId: string,
): Promise<ApplicationRow> {
  const { data } = await client.post(`/applications/${applicationId}/withdraw`);
  return ApplicationRowSchema.parse(data);
}

export async function listMyParticipations(
  client: HttpClient,
  params?: ParticipationListParams,
): Promise<ParticipationPage> {
  const { data } = await client.get('/participations/me', {
    params: buildParticipationParams(params ?? {}),
  });
  return CursorPageSchema(ParticipationRowSchema).parse(data);
}

export async function getParticipation(
  client: HttpClient,
  participationId: string,
): Promise<ParticipationRow> {
  const { data } = await client.get(`/participations/${participationId}`);
  return ParticipationRowSchema.parse(data);
}

export async function withdrawParticipation(
  client: HttpClient,
  participationId: string,
): Promise<ParticipationRow> {
  const { data } = await client.post(`/participations/${participationId}/withdraw`);
  return ParticipationRowSchema.parse(data);
}

export async function getVolunteerActivity(
  client: HttpClient,
  params?: ActivityParams,
): Promise<ActivityPage> {
  const { data } = await client.get('/volunteers/me/activity', {
    params: dropEmpty({ ...(params ?? {}) }),
  });
  return CursorPageSchema(ActivityItemSchema).parse(data);
}

// Attestation streams through the single shared blob-download path
// (Content-Disposition filename, triggered save — never navigation).
// Header names are normalized to lowercase: axios v1 exposes an
// AxiosHeaders instance (case-insensitive get, case-sensitive direct
// access), while downloadBlob looks up the exact lowercase key.
export async function downloadAttestation(
  client: HttpClient,
  experienceId: string,
): Promise<string> {
  return downloadBlob(async (url, config) => {
    const response = (await client.get(url, {
      params: config.params,
      responseType: 'blob',
    })) as AxiosResponse<Blob>;
    const raw = response.headers as unknown as {
      toJSON?: () => Record<string, unknown>;
      [key: string]: unknown;
    };
    const source: Record<string, unknown> =
      typeof raw?.toJSON === 'function' ? raw.toJSON() : { ...(raw as object) };
    const headers: Record<string, string | string[] | undefined> = {};
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'string' || Array.isArray(value)) {
        headers[key.toLowerCase()] = value as string | string[];
      }
    }
    return { data: response.data, headers };
  }, `/experiences/${experienceId}/attestation`);
}
