import { z } from 'zod';
import type { AxiosInstance } from 'axios';

// F5 opportunity module: one typed function per consumed backend endpoint
// (base `/api/v1`). Verified read-only against backend/src:
// - GET /opportunities/:idOrSlug (public, published-only, id-or-slug;
//   enriched via OpportunityEmbedProvider.embedFull: positions carry
//   `applicationCount` + `assigned` names + `skillNames`; org embed is
//   `{id, slug, nameFr, nameAr, logoMediaId, verificationStatus}`)
// - GET /opportunities (public feed; supports `categoryId` + `limit`)
// - POST /opportunities/:opportunityId/positions/:positionId/applications
//   (volunteer role, `{message?}` trimmed <= 2000, immutable afterwards)
// - POST /applications/:applicationId/withdraw (own live application)
// - POST /reports `{targetType, targetId, reason, description?}`
//   (authenticated; reason non-empty <= 2000, description <= 4000)
// - GET /media/:mediaId (public cover read returns metadata + signed URL)
// - GET /applications/me (OQ1-approved scoped lookup of the volunteer's own
//   application id for Withdraw; matched client-side on opportunityId +
//   positionId; F6 may consume this function read-only — no duplication)
//
// Deviation-1 resolution (verified in opportunity-embed.provider.ts):
// the org SELECT is `slug nameFr nameAr logoMediaId verificationStatus` —
// NO `reliability` sub-object rides the embed. Reliability is cached on
// `organizations.reliability` and served by
// `GET /organizations/:slug/reliability` (F18-owned). This module therefore
// renders the sidebar from the embed only: no extra endpoint, no invented
// stats.

export const AssignedVolunteerSchema = z
  .object({
    volunteerId: z.string(),
    fullName: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
    avatarMediaId: z.string().nullable().optional(),
  })
  .passthrough();

export type AssignedVolunteer = z.infer<typeof AssignedVolunteerSchema>;

export const PositionSkillNameSchema = z
  .object({
    skillId: z.string(),
    nameAr: z.string().optional(),
    nameFr: z.string().optional(),
  })
  .passthrough();

export const OpportunityPositionSchema = z
  .object({
    _id: z.string().optional(),
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    requiredCount: z.number().optional(),
    filledCount: z.number().optional(),
    requiredSkills: z.array(z.unknown()).nullable().optional(),
    deliverables: z.array(z.string()).nullable().optional(),
    startAt: z.string().nullable().optional(),
    applicationCount: z.number().nullable().optional(),
    assigned: z.array(AssignedVolunteerSchema).nullable().optional(),
    skillNames: z.array(PositionSkillNameSchema).nullable().optional(),
  })
  .passthrough();

export type OpportunityPosition = z.infer<typeof OpportunityPositionSchema>;

export const OrganizationEmbedSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    nameFr: z.string().nullable().optional(),
    nameAr: z.string().nullable().optional(),
    logoMediaId: z.string().nullable().optional(),
    verificationStatus: z.string().optional(),
  })
  .passthrough();

export type OrganizationEmbed = z.infer<typeof OrganizationEmbedSchema>;

export const CategoryNameSchema = z
  .object({
    nameAr: z.string().optional(),
    nameFr: z.string().optional(),
  })
  .passthrough();

const LocationLabelSchema = z
  .object({
    nameAr: z.string().optional(),
    nameFr: z.string().optional(),
  })
  .passthrough();

export const OpportunityDetailSchema = z
  .object({
    _id: z.string().optional(),
    id: z.string().optional(),
    slug: z.string().optional(),
    title: z.string(),
    description: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    registryId: z.string().nullable().optional(),
    mode: z.string().nullable().optional(),
    coverMediaId: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    applicationDeadline: z.string().nullable().optional(),
    durationMinutes: z.number().nullable().optional(),
    prerequisites: z.array(z.string()).nullable().optional(),
    status: z.string().optional(),
    location: z
      .object({
        wilayaId: z.string().nullable().optional(),
        municipalityId: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    positions: z.array(OpportunityPositionSchema).nullable().optional(),
    organization: OrganizationEmbedSchema.nullable().optional(),
    categoryName: CategoryNameSchema.nullable().optional(),
    locationLabels: z
      .object({
        wilaya: LocationLabelSchema.nullable().optional(),
        municipality: LocationLabelSchema.nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    isFavorited: z.boolean().nullable().optional(),
    favoriteCount: z.number().nullable().optional(),
  })
  .passthrough();

export type OpportunityDetail = z.infer<typeof OpportunityDetailSchema>;

export const CursorPageSchema = <Item extends z.ZodTypeAny>(itemSchema: Item) =>
  z
    .object({
      items: z.array(itemSchema),
      nextCursor: z.string().nullable().optional(),
      limit: z.number().optional(),
      total: z.number().optional(),
      page: z.number().optional(),
      pages: z.number().optional(),
    })
    .passthrough();

export const MyApplicationSchema = z
  .object({
    _id: z.string().optional(),
    id: z.string().optional(),
    opportunityId: z.string().optional(),
    positionId: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export type MyApplication = z.infer<typeof MyApplicationSchema>;

// Live states occupy the seat-request (backend partial unique index covers
// pending | under_review | accepted); rejected/withdrawn never block.
export const LIVE_APPLICATION_STATUSES = ['pending', 'under_review', 'accepted'] as const;

export const ApplyInputSchema = z.object({
  message: z.string().trim().max(2000).optional(),
});

export type ApplyInput = z.infer<typeof ApplyInputSchema>;

export const ReportOpportunityInputSchema = z.object({
  targetId: z.string().min(1),
  reason: z.string().trim().min(1).max(2000),
  description: z.string().trim().max(4000).optional(),
});

export type ReportOpportunityInput = z.infer<typeof ReportOpportunityInputSchema>;

export const ApplicationSchema = z
  .object({
    _id: z.string().optional(),
    id: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export type Application = z.infer<typeof ApplicationSchema>;

export const ReportSchema = z
  .object({
    _id: z.string().optional(),
    id: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export type OpportunityReport = z.infer<typeof ReportSchema>;

export const CoverMediaSchema = z
  .object({
    url: z.string().optional(),
    signedUrl: z.string().optional(),
  })
  .passthrough();

export type CoverMedia = z.infer<typeof CoverMediaSchema>;

export function detailIdOf(detail: OpportunityDetail): string {
  return detail._id ?? detail.id ?? detail.slug ?? '';
}

export function positionKeyOf(position: OpportunityPosition): string {
  return position._id ?? position.id ?? '';
}

export function orgDisplayName(org: OrganizationEmbed | null | undefined, locale: string): string {
  if (!org) return '';
  const primary = locale === 'ar' ? org.nameAr : org.nameFr;
  const fallback = locale === 'ar' ? org.nameFr : org.nameAr;
  return primary ?? fallback ?? '';
}

export function labelFor(
  label: { nameAr?: string; nameFr?: string } | null | undefined,
  locale: string,
): string {
  if (!label) return '';
  return (locale === 'ar' ? label.nameAr : label.nameFr) ?? '';
}

type HttpClient = Pick<AxiosInstance, 'get' | 'post'>;

export async function getOpportunityDetail(
  client: HttpClient,
  idOrSlug: string,
): Promise<OpportunityDetail> {
  const { data } = await client.get(`/opportunities/${encodeURIComponent(idOrSlug)}`);
  return OpportunityDetailSchema.parse(data);
}

export async function listRelatedOpportunities(
  client: HttpClient,
  params: { categoryId: string; limit?: number; excludeId?: string },
): Promise<OpportunityDetail[]> {
  const { data } = await client.get('/opportunities', {
    params: { categoryId: params.categoryId, limit: params.limit ?? 6 },
  });
  const page = CursorPageSchema(OpportunityDetailSchema).parse(data);
  return params.excludeId
    ? page.items.filter((item) => detailIdOf(item) !== params.excludeId)
    : page.items;
}

export async function applyToPosition(
  client: HttpClient,
  opportunityId: string,
  positionId: string,
  input: ApplyInput,
): Promise<Application> {
  const parsed = ApplyInputSchema.parse(input);
  const body = parsed.message ? { message: parsed.message } : {};
  const { data } = await client.post(
    `/opportunities/${encodeURIComponent(opportunityId)}/positions/${encodeURIComponent(positionId)}/applications`,
    body,
  );
  return ApplicationSchema.parse(data);
}

export async function withdrawApplication(
  client: HttpClient,
  applicationId: string,
): Promise<Application> {
  const { data } = await client.post(
    `/applications/${encodeURIComponent(applicationId)}/withdraw`,
    {},
  );
  return ApplicationSchema.parse(data);
}

export async function reportOpportunity(
  client: HttpClient,
  input: ReportOpportunityInput,
): Promise<OpportunityReport> {
  const parsed = ReportOpportunityInputSchema.parse(input);
  const { data } = await client.post('/reports', {
    targetType: 'opportunity',
    targetId: parsed.targetId,
    reason: parsed.reason,
    ...(parsed.description ? { description: parsed.description } : {}),
  });
  return ReportSchema.parse(data);
}

export async function getCoverMedia(client: HttpClient, mediaId: string): Promise<CoverMedia> {
  const { data } = await client.get(`/media/${encodeURIComponent(mediaId)}`);
  return CoverMediaSchema.parse(data);
}

export function coverUrlOf(media: CoverMedia | undefined): string | null {
  if (!media) return null;
  return media.signedUrl ?? media.url ?? null;
}

// OQ1-approved: scoped own-application lookup for Withdraw. Reads the first
// page (max 50) of GET /applications/me and matches opportunityId +
// positionId with a live status client-side. Returns null when absent —
// the UI hides Withdraw rather than guessing.
export async function findMyApplicationForPosition(
  client: HttpClient,
  opportunityId: string,
  positionId: string,
): Promise<MyApplication | null> {
  const { data } = await client.get('/applications/me', { params: { limit: 50 } });
  const page = CursorPageSchema(MyApplicationSchema).parse(data);
  return (
    page.items.find(
      (item) =>
        item.opportunityId === opportunityId &&
        item.positionId === positionId &&
        item.status !== undefined &&
        (LIVE_APPLICATION_STATUSES as readonly string[]).includes(item.status),
    ) ?? null
  );
}

export function myApplicationIdOf(app: MyApplication): string {
  return app._id ?? app.id ?? '';
}
