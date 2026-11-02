import { z } from 'zod';
import type { AxiosInstance } from 'axios';

// F2 volunteers module: one typed function per own-profile backend endpoint
// (base `/api/v1`). Verified read-only against backend/src/volunteers
// (controllers + DTOs + service):
// - GET/PATCH /volunteers/me (UpdateVolunteerProfileDto fields)
// - PATCH /volunteers/me/public-settings takes `{ publicProfile: {...} }`
//   (PublicProfileDto: enabled, showAvatar, showBiography, showLocation,
//   showSkills, showExperiences, showAvailability, showPortfolio, showStats)
// - skills: GET/POST /volunteers/me/skills, PATCH/DELETE .../skills/:skillId
//   (Add: {skillId, level 1-5, yearsOfExperience?, isPrimary?})
// - availability: GET/PUT /volunteers/me/availability (replace-whole
//   WeeklySchedule — all 7 day keys required, {from,to} HH:mm slots)
// - GET /volunteers/me/dashboard ({completionPercent, stats,
//   latestVerifiedExperience}); GET /skills (plain array), /skill-categories.

export const VolunteerLocationSchema = z
  .object({
    wilayaId: z.string().regex(/^\d{2}$/).optional(),
    municipalityId: z.string().regex(/^\d{4}$/).optional(),
  })
  .passthrough();

export const PublicProfileSchema = z
  .object({
    enabled: z.boolean().optional(),
    showAvatar: z.boolean().optional(),
    showBiography: z.boolean().optional(),
    showLocation: z.boolean().optional(),
    showSkills: z.boolean().optional(),
    showExperiences: z.boolean().optional(),
    showAvailability: z.boolean().optional(),
    showPortfolio: z.boolean().optional(),
    showStats: z.boolean().optional(),
  })
  .passthrough();

export type PublicProfile = z.infer<typeof PublicProfileSchema>;

// Opt-out toggle keys in stable UI order (OQ2 copy: "Show X publicly").
export const PUBLIC_TOGGLE_KEYS = [
  'showAvatar',
  'showBiography',
  'showLocation',
  'showSkills',
  'showExperiences',
  'showAvailability',
  'showPortfolio',
  'showStats',
] as const;

export type PublicToggleKey = (typeof PUBLIC_TOGGLE_KEYS)[number];

/**
 * Privacy-safe backend defaults. `GET /volunteers/me` always returns the
 * concrete flags; these values are only a defensive fallback for legacy
 * payloads that omit a key.
 */
export const PUBLIC_TOGGLE_DEFAULTS: Record<PublicToggleKey, boolean> = {
  showAvatar: false,
  showBiography: true,
  showLocation: false,
  showSkills: true,
  showExperiences: true,
  showAvailability: false,
  showPortfolio: true,
  showStats: true,
};

export const VolunteerMeSchema = z
  .object({
    username: z.string(),
    registryId: z.string().optional(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    headline: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
    birthDate: z.string().nullable().optional(),
    location: VolunteerLocationSchema.nullable().optional(),
    avatar: z.string().nullable().optional(),
    banner: z.string().nullable().optional(),
    availabilityNote: z.string().nullable().optional(),
    preferredDomains: z.array(z.string()).nullable().optional(),
    geographicBase: z.string().nullable().optional(),
    publicProfile: PublicProfileSchema.nullable().optional(),
    stats: z.unknown().nullable().optional(),
    createdAt: z.string().optional(),
  })
  .passthrough();

export type VolunteerMe = z.infer<typeof VolunteerMeSchema>;

export const UpdateVolunteerProfileSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  headline: z.string().max(120).optional(),
  bio: z.string().max(2000).optional(),
  birthDate: z.string().optional(),
  location: VolunteerLocationSchema.optional(),
  avatar: z.string().optional(),
  banner: z.string().optional(),
  availabilityNote: z.string().max(500).optional(),
  preferredDomains: z.array(z.string().min(1).max(60)).max(10).optional(),
  geographicBase: z.string().max(120).optional(),
});

export type UpdateVolunteerProfile = z.infer<typeof UpdateVolunteerProfileSchema>;

export const UpdatePublicSettingsSchema = z.object({
  publicProfile: PublicProfileSchema,
});

export type UpdatePublicSettings = z.infer<typeof UpdatePublicSettingsSchema>;

export const ProfileCompletionSchema = z.object({
  percent: z.number(),
  missingFields: z.array(z.string()),
  complete: z.boolean(),
});

export type ProfileCompletion = z.infer<typeof ProfileCompletionSchema>;

export const VolunteerDashboardSchema = z
  .object({
    completionPercent: z.number(),
    completion: ProfileCompletionSchema.optional(),
    stats: z.unknown().nullable().optional(),
    latestVerifiedExperience: z.unknown().nullable().optional(),
  })
  .passthrough();

export type VolunteerDashboard = z.infer<typeof VolunteerDashboardSchema>;

export const VolunteerSkillSchema = z
  .object({
    _id: z.string().optional(),
    id: z.string().optional(),
    skillId: z.string().optional(),
    nameAr: z.string().optional(),
    nameFr: z.string().optional(),
    categoryId: z.string().nullable().optional(),
    categoryNameAr: z.string().nullable().optional(),
    categoryNameFr: z.string().nullable().optional(),
    level: z.number().int().min(1).max(5).optional(),
    yearsOfExperience: z.number().int().min(0).max(100).nullable().optional(),
    isPrimary: z.boolean().nullable().optional(),
  })
  .passthrough();

export type VolunteerSkill = z.infer<typeof VolunteerSkillSchema>;

export const AddVolunteerSkillSchema = z.object({
  skillId: z.string().min(1),
  level: z.number().int().min(1).max(5),
  yearsOfExperience: z.number().int().min(0).max(100).optional(),
  isPrimary: z.boolean().optional(),
});

export type AddVolunteerSkill = z.infer<typeof AddVolunteerSkillSchema>;

export const UpdateVolunteerSkillSchema = z.object({
  level: z.number().int().min(1).max(5).optional(),
  yearsOfExperience: z.number().int().min(0).max(100).optional(),
  isPrimary: z.boolean().optional(),
});

export type UpdateVolunteerSkill = z.infer<typeof UpdateVolunteerSkillSchema>;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const TimeSlotSchema = z.object({
  from: z.string().regex(HHMM),
  to: z.string().regex(HHMM),
});

export type TimeSlot = z.infer<typeof TimeSlotSchema>;

export const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type DayKey = (typeof DAY_KEYS)[number];

export const AvailabilitySchema = z.object({
  monday: z.array(TimeSlotSchema),
  tuesday: z.array(TimeSlotSchema),
  wednesday: z.array(TimeSlotSchema),
  thursday: z.array(TimeSlotSchema),
  friday: z.array(TimeSlotSchema),
  saturday: z.array(TimeSlotSchema),
  sunday: z.array(TimeSlotSchema),
});

export type Availability = z.infer<typeof AvailabilitySchema>;

export function emptyAvailability(): Availability {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };
}

export const SkillSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    skillId: z.string().optional(),
    nameFr: z.string().optional(),
    nameAr: z.string().optional(),
    name: z.string().optional(),
    categoryId: z.string().optional(),
  })
  .passthrough();

export type Skill = z.infer<typeof SkillSchema>;

export const SkillCategorySchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    nameFr: z.string().optional(),
    nameAr: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough();

export type SkillCategory = z.infer<typeof SkillCategorySchema>;

export const WilayaSchema = z
  .object({
    code: z.string(),
    nameFr: z.string(),
    nameAr: z.string(),
  })
  .passthrough();

export type Wilaya = z.infer<typeof WilayaSchema>;

export const MunicipalitySchema = z
  .object({
    code: z.string(),
    nameFr: z.string(),
    nameAr: z.string(),
  })
  .passthrough();

export type Municipality = z.infer<typeof MunicipalitySchema>;

export const VolunteerMediaReadSchema = z
  .object({
    url: z.string().nullable().optional(),
    media: z
      .object({ url: z.string().nullable().optional() })
      .nullable()
      .optional(),
  })
  .passthrough();

export type VolunteerMediaRead = z.infer<typeof VolunteerMediaReadSchema>;

// Resolve a viewable URL from an own-profile media read (`GET /media/:mediaId`
// → `{ media, url }`). Null means real-or-absent: callers fall back to
// `public/user.jpg` (never hidden, never invented).
export function volunteerMediaUrlOf(read: VolunteerMediaRead | null | undefined): string | null {
  if (!read) return null;
  if (typeof read.url === 'string' && read.url !== '') return read.url;
  const nested = read.media?.url;
  return typeof nested === 'string' && nested !== '' ? nested : null;
}

export async function getVolunteerMedia(
  client: Pick<AxiosInstance, 'get'>,
  mediaId: string,
): Promise<VolunteerMediaRead> {
  const { data } = await client.get(`/media/${encodeURIComponent(mediaId)}`);
  return VolunteerMediaReadSchema.parse(data);
}

type HttpClient = Pick<AxiosInstance, 'get' | 'post' | 'patch' | 'put' | 'delete'>;

export async function getVolunteerMe(client: HttpClient): Promise<VolunteerMe> {
  const { data } = await client.get('/volunteers/me');
  return VolunteerMeSchema.parse(data);
}

export async function patchVolunteerMe(
  client: HttpClient,
  input: UpdateVolunteerProfile,
): Promise<VolunteerMe> {
  const { data } = await client.patch('/volunteers/me', input);
  return VolunteerMeSchema.parse(data);
}

export async function patchPublicSettings(
  client: HttpClient,
  input: UpdatePublicSettings,
): Promise<VolunteerMe> {
  const { data } = await client.patch('/volunteers/me/public-settings', input);
  return VolunteerMeSchema.parse(data);
}

export async function getVolunteerDashboard(
  client: HttpClient,
): Promise<VolunteerDashboard> {
  const { data } = await client.get('/volunteers/me/dashboard');
  return VolunteerDashboardSchema.parse(data);
}

export async function getVolunteerProfileCompletion(
  client: HttpClient,
): Promise<ProfileCompletion> {
  const { data } = await client.get('/volunteers/me/profile-completion');
  return ProfileCompletionSchema.parse(data);
}

export async function listMySkills(client: HttpClient): Promise<VolunteerSkill[]> {
  const { data } = await client.get('/volunteers/me/skills');
  return z.array(VolunteerSkillSchema).parse(data);
}

export async function addMySkill(
  client: HttpClient,
  input: AddVolunteerSkill,
): Promise<VolunteerSkill> {
  const { data } = await client.post('/volunteers/me/skills', input);
  return VolunteerSkillSchema.parse(data);
}

export async function updateMySkill(
  client: HttpClient,
  skillId: string,
  input: UpdateVolunteerSkill,
): Promise<VolunteerSkill> {
  const { data } = await client.patch(`/volunteers/me/skills/${skillId}`, input);
  return VolunteerSkillSchema.parse(data);
}

export async function deleteMySkill(client: HttpClient, skillId: string): Promise<void> {
  await client.delete(`/volunteers/me/skills/${skillId}`);
}

export async function getMyAvailability(client: HttpClient): Promise<Availability> {
  const { data } = await client.get('/volunteers/me/availability');
  return AvailabilitySchema.parse(data);
}

export async function putMyAvailability(
  client: HttpClient,
  input: Availability,
): Promise<Availability> {
  const { data } = await client.put('/volunteers/me/availability', input);
  return AvailabilitySchema.parse(data);
}

export async function listSkills(
  client: HttpClient,
  params?: { categoryId?: string; q?: string },
): Promise<Skill[]> {
  const { data } = await client.get('/skills', { params });
  return z.array(SkillSchema).parse(data);
}

export async function listSkillCategories(client: HttpClient): Promise<SkillCategory[]> {
  const { data } = await client.get('/skill-categories');
  return z.array(SkillCategorySchema).parse(data);
}

export async function listWilayas(client: HttpClient): Promise<Wilaya[]> {
  const { data } = await client.get('/locations/wilayas');
  return z.array(WilayaSchema).parse(data);
}

export async function listMunicipalities(
  client: HttpClient,
  wilayaId: string,
): Promise<Municipality[]> {
  const { data } = await client.get(
    `/locations/wilayas/${encodeURIComponent(wilayaId)}/municipalities`,
  );
  return z.array(MunicipalitySchema).parse(data);
}
