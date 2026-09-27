import { z } from 'zod';
import type { AxiosInstance } from 'axios';

// F9 org-workspace module: one typed function per dashboard backend endpoint
// (base `/api/v1`). Verified read-only against backend/src:
// - organizations: GET /organizations/me (own org facts incl. registryId,
//   coverMediaId, location{}, foundedYear, verificationStatus).
// - participations/org-dashboard.controller+service: GET
//   /organizations/me/stats → { opportunitiesActive, opportunitiesCompleted,
//   applicationsPending, applicationsUnderReview, participantsActive,
//   participantsCompleted, verifiedHours (= sum(durationMinutes)),
//   decisionsLast30d, decidedRatio?, medianDecisionHours? }; GET
//   /organizations/me/participants (OrgParticipantsQueryDto: ?q=,
//   ?opportunityId=, ?status=, cursor `cursor`/`limit`, CursorPage with
//   volunteer/opportunity embeds + submission-state join).
// - submissions.controller: GET /organizations/me/submissions
//   (?opportunityId=, multi-status, ?q=, ?format=, ?sort=, totals, volunteer
//   join). F9 reads a pending-family summary page only.
// - applications.controller: GET /organizations/me/applications (aggregate
//   inbox ?opportunityId=&status=&q=&page=, name joins). F9 reads a
//   newest-first summary page only.
// - activity.controller: GET /organizations/me/activity (newest first).
// - trust.controller: GET /organizations/me/publish-gate → { locked,
//   pendingCount, threshold, pendingOpportunities }.
// - notifications.controller: GET /notifications (polled CursorPage read;
//   read-only strip in F9, no deep-linking per OQ1).
// Mutations (start-review/accept/reject/verify, CRUD, read-all) live in
// F10/F11 files — never here (FD file-disjointness).

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

export const OrgProfileSchema = z
  .object({
    registryId: z.string().optional(),
    verificationStatus: z.string().optional(),
    nameAr: z.string().optional(),
    nameFr: z.string().optional(),
    description: z.string().optional(),
    logoMediaId: z.string().nullable().optional(),
    coverMediaId: z.string().nullable().optional(),
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
  })
  .passthrough();

export type OrgProfile = z.infer<typeof OrgProfileSchema>;

export const OrgStatsSchema = z
  .object({
    opportunitiesActive: z.number(),
    opportunitiesCompleted: z.number(),
    applicationsPending: z.number(),
    applicationsUnderReview: z.number(),
    participantsActive: z.number(),
    participantsCompleted: z.number(),
    verifiedHours: z.number(),
    decisionsLast30d: z.number(),
    decidedRatio: z.number().optional(),
    medianDecisionHours: z.number().optional(),
  })
  .passthrough();

export type OrgStats = z.infer<typeof OrgStatsSchema>;

export const JoinedNameSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    nameFr: z.string().nullable().optional(),
    nameAr: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    slug: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
  })
  .passthrough();

export const SubmissionSummaryRowSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    status: z.string(),
    title: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    volunteer: JoinedNameSchema.nullable().optional(),
    opportunity: JoinedNameSchema.nullable().optional(),
  })
  .passthrough();

export type SubmissionSummaryRow = z.infer<typeof SubmissionSummaryRowSchema>;

export const ApplicationSummaryRowSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    status: z.string(),
    message: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    applicant: JoinedNameSchema.nullable().optional(),
    volunteer: JoinedNameSchema.nullable().optional(),
    opportunity: JoinedNameSchema.nullable().optional(),
  })
  .passthrough();

export type ApplicationSummaryRow = z.infer<typeof ApplicationSummaryRowSchema>;

export const ParticipantSummaryRowSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    status: z.string(),
    createdAt: z.string().optional(),
    volunteer: JoinedNameSchema.nullable().optional(),
    opportunity: JoinedNameSchema.nullable().optional(),
    submission: z.unknown().nullable().optional(),
  })
  .passthrough();

export type ParticipantSummaryRow = z.infer<typeof ParticipantSummaryRowSchema>;

export const OrgActivityItemSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    type: z.string().optional(),
    kind: z.string().optional(),
    title: z.string().nullable().optional(),
    createdAt: z.string().optional(),
  })
  .passthrough();

export type OrgActivityItem = z.infer<typeof OrgActivityItemSchema>;

export const PublishGateSchema = z
  .object({
    locked: z.boolean(),
    pendingCount: z.number().optional(),
    threshold: z.number().optional(),
    pendingOpportunities: z.array(z.unknown()).optional(),
  })
  .passthrough();

export type PublishGate = z.infer<typeof PublishGateSchema>;

export const NotificationRowSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    title: z.string().nullable().optional(),
    body: z.string().nullable().optional(),
    type: z.string().optional(),
    kind: z.string().optional(),
    isRead: z.boolean().optional(),
    readAt: z.string().nullable().optional(),
    createdAt: z.string().optional(),
  })
  .passthrough();

export type NotificationRow = z.infer<typeof NotificationRowSchema>;

export const OrgCoverMediaSchema = z
  .object({
    url: z.string().optional(),
    signedUrl: z.string().optional(),
  })
  .passthrough();

export type OrgCoverMedia = z.infer<typeof OrgCoverMediaSchema>;

// Real cover URL only (never a placeholder). Null when unresolvable.
export function orgCoverUrlOf(media: OrgCoverMedia | undefined): string | null {
  if (!media) return null;
  return media.signedUrl ?? media.url ?? null;
}

export type SubmissionSummaryPage = z.infer<
  ReturnType<typeof CursorPageSchema>
>;
export type ApplicationSummaryPage = z.infer<
  ReturnType<typeof CursorPageSchema>
>;
export type ParticipantSummaryPage = z.infer<
  ReturnType<typeof CursorPageSchema>
>;
export type OrgActivityPage = z.infer<ReturnType<typeof CursorPageSchema>>;
export type NotificationPage = z.infer<ReturnType<typeof CursorPageSchema>>;

export const DASHBOARD_SUMMARY_LIMIT = 5;

// Display-only org code. Never a route key, never a link target.
export function orgDisplayCode(registryId: string | undefined | null): string | null {
  const code = (registryId ?? '').trim();
  if (code.length === 0) return null;
  return `ORG-${code}`;
}

export interface StatCard {
  key: string;
  value: number;
}

// Pure mapping: every card renders from its stats field. Hours render from
// verifiedHours (backend sum(durationMinutes)) — no client-side aggregation.
// Optional reliability fields render iff present (never invented zeroes).
export function statCards(stats: OrgStats): StatCard[] {
  const cards: StatCard[] = [
    { key: 'opportunitiesActive', value: stats.opportunitiesActive },
    { key: 'opportunitiesCompleted', value: stats.opportunitiesCompleted },
    { key: 'applicationsPending', value: stats.applicationsPending },
    { key: 'applicationsUnderReview', value: stats.applicationsUnderReview },
    { key: 'participantsActive', value: stats.participantsActive },
    { key: 'participantsCompleted', value: stats.participantsCompleted },
    { key: 'verifiedHours', value: stats.verifiedHours },
    { key: 'decisionsLast30d', value: stats.decisionsLast30d },
  ];
  if (stats.decidedRatio !== undefined) {
    cards.push({ key: 'decidedRatio', value: stats.decidedRatio });
  }
  if (stats.medianDecisionHours !== undefined) {
    cards.push({ key: 'medianDecisionHours', value: stats.medianDecisionHours });
  }
  return cards;
}

export function isGateLocked(gate: PublishGate): boolean {
  return gate.locked === true;
}

export function rowId(row: { id?: string; _id?: string }): string {
  return row.id ?? row._id ?? '';
}

function dropEmpty(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
  );
}

type HttpClient = Pick<AxiosInstance, 'get'>;

export async function getMyOrganization(client: HttpClient): Promise<OrgProfile> {
  const { data } = await client.get('/organizations/me');
  return OrgProfileSchema.parse(data);
}

export async function getOrgStats(client: HttpClient): Promise<OrgStats> {
  const { data } = await client.get('/organizations/me/stats');
  return OrgStatsSchema.parse(data);
}

export interface InboxSummaryParams {
  limit?: number;
  cursor?: string;
}

export async function listParticipantsSummary(
  client: HttpClient,
  params?: InboxSummaryParams,
): Promise<ParticipantSummaryPage> {
  const { data } = await client.get('/organizations/me/participants', {
    params: dropEmpty({ limit: DASHBOARD_SUMMARY_LIMIT, ...(params ?? {}) }),
  });
  return CursorPageSchema(ParticipantSummaryRowSchema).parse(data);
}

export async function listSubmissionsSummary(
  client: HttpClient,
  params?: InboxSummaryParams,
): Promise<SubmissionSummaryPage> {
  const { data } = await client.get('/organizations/me/submissions', {
    params: dropEmpty({ limit: DASHBOARD_SUMMARY_LIMIT, ...(params ?? {}) }),
  });
  return CursorPageSchema(SubmissionSummaryRowSchema).parse(data);
}

export async function listApplicationsSummary(
  client: HttpClient,
  params?: InboxSummaryParams,
): Promise<ApplicationSummaryPage> {
  const { data } = await client.get('/organizations/me/applications', {
    params: dropEmpty({ limit: DASHBOARD_SUMMARY_LIMIT, ...(params ?? {}) }),
  });
  return CursorPageSchema(ApplicationSummaryRowSchema).parse(data);
}

export async function getOrgActivity(
  client: HttpClient,
  params?: InboxSummaryParams,
): Promise<OrgActivityPage> {
  const { data } = await client.get('/organizations/me/activity', {
    params: dropEmpty({ limit: DASHBOARD_SUMMARY_LIMIT, ...(params ?? {}) }),
  });
  return CursorPageSchema(OrgActivityItemSchema).parse(data);
}

export async function getPublishGate(client: HttpClient): Promise<PublishGate> {
  const { data } = await client.get('/organizations/me/publish-gate');
  return PublishGateSchema.parse(data);
}

export async function listNotifications(
  client: HttpClient,
  params?: InboxSummaryParams,
): Promise<NotificationPage> {
  const { data } = await client.get('/notifications', {
    params: dropEmpty({ limit: DASHBOARD_SUMMARY_LIMIT, ...(params ?? {}) }),
  });
  return CursorPageSchema(NotificationRowSchema).parse(data);
}

// Org cover read, scoped to this module (F9-owned; no cross-session import).
// Renders only when a signed URL resolves — otherwise the neutral empty state.
export async function getOrgCoverMedia(
  client: HttpClient,
  mediaId: string,
): Promise<OrgCoverMedia> {
  const { data } = await client.get(`/media/${encodeURIComponent(mediaId)}`);
  return OrgCoverMediaSchema.parse(data);
}
