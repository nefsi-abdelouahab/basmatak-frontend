import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  AvailabilitySchema,
  UpdateVolunteerProfileSchema,
  VolunteerDashboardSchema,
  VolunteerMeSchema,
  addMySkill,
  deleteMySkill,
  emptyAvailability,
  getMyAvailability,
  getVolunteerDashboard,
  getVolunteerMe,
  listMySkills,
  listSkillCategories,
  listSkills,
  patchPublicSettings,
  patchVolunteerMe,
  putMyAvailability,
  updateMySkill,
} from './volunteers';

function stubClient(handlers: {
  get?: (url: string) => unknown;
  post?: (url: string, body?: unknown) => unknown;
  patch?: (url: string, body?: unknown) => unknown;
  put?: (url: string, body?: unknown) => unknown;
  delete?: (url: string) => unknown;
}) {
  const get = vi.fn(async (url: string) => ({ data: handlers.get?.(url) }));
  const post = vi.fn(async (url: string, body?: unknown) => ({ data: handlers.post?.(url, body) }));
  const patch = vi.fn(async (url: string, body?: unknown) => ({
    data: handlers.patch?.(url, body),
  }));
  const put = vi.fn(async (url: string, body?: unknown) => ({ data: handlers.put?.(url, body) }));
  const del = vi.fn(async (url: string) => ({ data: handlers.delete?.(url) }));
  const client = { get, post, patch, put, delete: del } as unknown as AxiosInstance;
  return { client, get, post, patch, put, del };
}

const me = {
  username: 'amineb',
  registryId: 'VOL-000123',
  firstName: 'Amine',
  lastName: 'Benali',
  publicProfile: { enabled: true, showStats: true },
  stats: null,
};

describe('volunteer profile validators', () => {
  it('accepts valid profile/availability/dashboard payloads', () => {
    expect(VolunteerMeSchema.safeParse(me).success).toBe(true);
    expect(
      UpdateVolunteerProfileSchema.safeParse({ firstName: 'Amine', headline: 'Hi' }).success,
    ).toBe(true);
    expect(AvailabilitySchema.safeParse(emptyAvailability()).success).toBe(true);
    expect(
      VolunteerDashboardSchema.safeParse({
        completionPercent: 62,
        stats: null,
        latestVerifiedExperience: null,
      }).success,
    ).toBe(true);
  });

  it('rejects overlong names and malformed slots', () => {
    expect(
      UpdateVolunteerProfileSchema.safeParse({ firstName: 'x'.repeat(81) }).success,
    ).toBe(false);
    expect(
      AvailabilitySchema.safeParse({ ...emptyAvailability(), monday: [{ from: '9:00', to: 'x' }] })
        .success,
    ).toBe(false);
    expect(
      AvailabilitySchema.safeParse({ monday: [] }).success,
    ).toBe(false);
  });
});

describe('volunteer api functions', () => {
  it('getVolunteerMe reads and patchVolunteerMe writes /volunteers/me', async () => {
    const { client, patch } = stubClient({
      get: (url) => (url === '/volunteers/me' ? me : undefined),
      patch: (url, body) => (url === '/volunteers/me' ? { ...me, ...(body as object) } : undefined),
    });
    expect(await getVolunteerMe(client)).toMatchObject({ username: 'amineb' });
    const updated = await patchVolunteerMe(client, { headline: 'Helper' });
    expect(updated.headline).toBe('Helper');
    expect(patch).toHaveBeenCalledWith('/volunteers/me', { headline: 'Helper' });
  });

  it('patchPublicSettings wraps flags in { publicProfile }', async () => {
    const { client, patch } = stubClient({
      patch: (url, body) =>
        url === '/volunteers/me/public-settings'
          ? { ...me, publicProfile: (body as { publicProfile: unknown }).publicProfile }
          : undefined,
    });
    const updated = await patchPublicSettings(client, {
      publicProfile: { showStats: false },
    });
    expect(patch).toHaveBeenCalledWith('/volunteers/me/public-settings', {
      publicProfile: { showStats: false },
    });
    expect(updated.publicProfile?.showStats).toBe(false);
  });

  it('getVolunteerDashboard exposes completionPercent', async () => {
    const { client } = stubClient({
      get: (url) =>
        url === '/volunteers/me/dashboard'
          ? { completionPercent: 62, stats: null, latestVerifiedExperience: null }
          : undefined,
    });
    expect((await getVolunteerDashboard(client)).completionPercent).toBe(62);
  });

  it('skills CRUD hits the own-skills endpoints', async () => {
    const skill = { id: 's1', skillId: 'seed1', level: 3 };
    const { client, del } = stubClient({
      get: (url) => (url === '/volunteers/me/skills' ? [skill] : undefined),
      post: (url) => (url === '/volunteers/me/skills' ? skill : undefined),
      patch: (url) => (url === '/volunteers/me/skills/s1' ? { ...skill, level: 4 } : undefined),
      delete: () => undefined,
    });
    expect(await listMySkills(client)).toHaveLength(1);
    expect((await addMySkill(client, { skillId: 'seed1', level: 3 })).level).toBe(3);
    expect((await updateMySkill(client, 's1', { level: 4 })).level).toBe(4);
    await deleteMySkill(client, 's1');
    expect(del).toHaveBeenCalledWith('/volunteers/me/skills/s1');
  });

  it('availability GET/PUT round-trips the whole schedule', async () => {
    const schedule = { ...emptyAvailability(), monday: [{ from: '09:00', to: '12:00' }] };
    const { client } = stubClient({
      get: (url) => (url === '/volunteers/me/availability' ? schedule : undefined),
      put: (url, body) => (url === '/volunteers/me/availability' ? body : undefined),
    });
    expect((await getMyAvailability(client)).monday).toHaveLength(1);
    expect((await putMyAvailability(client, schedule)).monday).toHaveLength(1);
  });

  it('listSkills/listSkillCategories read the reference endpoints', async () => {
    const { client } = stubClient({
      get: (url) => {
        if (url === '/skills') return [{ id: 'seed1', nameFr: 'Santé' }];
        if (url === '/skill-categories') return [{ id: 'c1', nameFr: 'Santé' }];
        return undefined;
      },
    });
    expect(await listSkills(client)).toHaveLength(1);
    expect(await listSkillCategories(client)).toHaveLength(1);
  });
});
