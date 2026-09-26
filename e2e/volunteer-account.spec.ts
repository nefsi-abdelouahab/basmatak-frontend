import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/volunteer-account/en.json';
import ar from '../src/messages/volunteer-account/ar.json';

type Locale = 'en' | 'ar';
const catalogs = { en, ar } as const;

const me = {
  username: 'amineb',
  registryId: 'VOL-000123',
  firstName: 'Amine',
  lastName: 'Benali',
  headline: null,
  bio: null,
  birthDate: null,
  location: null,
  avatar: null,
  availabilityNote: null,
  preferredDomains: [],
  geographicBase: null,
  publicProfile: {
    enabled: true,
    showAvatar: true,
    showBiography: true,
    showLocation: true,
    showSkills: true,
    showExperiences: true,
    showAvailability: true,
    showPortfolio: true,
    showStats: true,
  },
  stats: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const dashboard = { completionPercent: 62, stats: null, latestVerifiedExperience: null };

const emptySchedule = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
};

const user = {
  id: '64f000000000000000000001',
  email: 'v@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'volunteer',
  status: 'active',
};

const usersMe = { id: 'u1', email: 'v@example.com', phone: null, emailVerifiedAt: '2026-01-01T00:00:00.000Z' };

const currentSession = {
  id: 'sess-current',
  createdAt: '2026-09-01T00:00:00.000Z',
  expiresAt: '2026-10-01T00:00:00.000Z',
  lastUsedAt: null,
  device: { browser: 'Chrome', os: 'Windows', device: 'Desktop' },
  userAgent: 'Mozilla/5.0',
  isCurrent: true,
};

const otherSession = {
  ...currentSession,
  id: 'sess-old',
  device: { browser: 'Firefox', os: 'Linux', device: 'Laptop' },
  isCurrent: false,
};

const allPrefs = {
  applicationUpdates: true,
  reviews: true,
  verification: true,
  system: true,
  digest: true,
  recordIssued: true,
};

interface Captured {
  path: string;
  method: string;
  body: unknown;
}

async function mockApi(
  page: Page,
  handlers: Record<string, { status: number; body?: unknown } | ((body: unknown) => { status: number; body?: unknown })>,
  captured: Captured[],
) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const url = route.request().url();
    const path = new URL(url).pathname;
    const key = Object.keys(handlers).find((k) => path.endsWith(k));
    if (!key) return route.fulfill({ status: 404, body: '{}' });
    let rawBody: unknown;
    try {
      rawBody = route.request().postDataJSON();
    } catch {
      rawBody = undefined;
    }
    captured.push({ path, method: route.request().method(), body: rawBody });
    const handler = handlers[key];
    const { status, body } = typeof handler === 'function' ? handler(rawBody) : handler;
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: body === undefined ? '' : JSON.stringify(body),
    });
  });
  await page.route('**/cdn.example/**', async (route: Route) => {
    captured.push({ path: 'PUT-bytes', method: 'PUT', body: undefined });
    return route.fulfill({
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: '',
    });
  });
}

function baseHandlers(): Record<string, { status: number; body?: unknown }> {
  return {
    '/auth/me': { status: 200, body: user },
    '/volunteers/me': { status: 200, body: me },
    '/volunteers/me/dashboard': { status: 200, body: dashboard },
    '/volunteers/me/skills': { status: 200, body: [] },
    '/volunteers/me/availability': { status: 200, body: emptySchedule },
    '/skills': { status: 200, body: [{ id: 'seed1', nameFr: 'Santé', nameAr: 'الصحة' }] },
    '/skill-categories': { status: 200, body: [{ id: 'c1', nameFr: 'Santé', nameAr: 'الصحة' }] },
    '/users/me': { status: 200, body: usersMe },
    '/users/me/sessions': { status: 200, body: [currentSession, otherSession] },
    '/notifications/preferences': { status: 200, body: { prefs: allPrefs } },
  };
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
      test(`profile renders all sections translated + public link (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, baseHandlers(), captured);
        await page.goto(`/${locale}/volunteer/profile`);
        await expect(page.getByTestId('volunteer-profile')).toBeVisible();
        await expect(
          page.getByTestId('volunteer-profile').getByRole('heading', { level: 1 }),
        ).toHaveText(catalogs[locale].profile.title);
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          locale === 'ar' ? 'rtl' : 'ltr',
        );
        await expect(page.getByTestId('profile-identity')).toBeVisible();
        await expect(page.getByTestId('profile-avatar')).toBeVisible();
        await expect(page.getByTestId('profile-skills')).toBeVisible();
        await expect(page.getByTestId('profile-availability')).toBeVisible();
        await expect(page.getByTestId('profile-visibility')).toBeVisible();
        await expect(page.getByTestId('profile-completion')).toContainText('62');
        await expect(page.getByTestId('public-profile-link')).toHaveAttribute(
          'href',
          `/${locale}/volunteers/amineb`,
        );
        // Opt-out defaults: every toggle renders ON.
        for (const key of [
          'showAvatar',
          'showBiography',
          'showLocation',
          'showSkills',
          'showExperiences',
          'showAvailability',
          'showPortfolio',
          'showStats',
        ]) {
          await expect(page.getByTestId(`toggle-${key}`)).toHaveAttribute('aria-checked', 'true');
        }
      });

      test(`settings renders sessions with current badge (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, baseHandlers(), captured);
        await page.goto(`/${locale}/volunteer/settings`);
        await expect(page.getByTestId('volunteer-settings')).toBeVisible();
        await expect(page.getByTestId('settings-contact')).toBeVisible();
        await expect(page.getByTestId('settings-password')).toBeVisible();
        await expect(page.getByTestId('settings-sessions')).toBeVisible();
        await expect(page.getByTestId('settings-notifications')).toBeVisible();
        await expect(page.getByTestId('settings-danger')).toBeVisible();
        await expect(page.getByTestId('session-row')).toHaveCount(2);
        await expect(page.getByTestId('this-device-badge')).toHaveCount(1);
        await expect(page.getByTestId('this-device-badge')).toContainText(
          catalogs[locale].settings.thisDevice,
        );
      });
    }

    test('identity edit persists via PATCH /volunteers/me', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(
        page,
        {
          ...baseHandlers(),
          '/volunteers/me': (body) => ({ status: 200, body: { ...me, ...(body as object) } }),
        },
        captured,
      );
      await page.goto('/en/volunteer/profile');
      await page.getByLabel(en.profile.headlineLabel).fill('Community helper');
      await page.getByTestId('profile-identity').getByRole('button', { name: en.shared.save }).click();
      await expect(page.getByTestId('profile-saved')).toBeVisible();
      const patch = captured.find(
        (c) => c.path.endsWith('/volunteers/me') && c.method === 'PATCH',
      );
      expect(patch?.body).toMatchObject({ headline: 'Community helper' });
    });

    test('public toggle persists via PATCH public-settings (opt-out)', async ({ page }) => {
      const captured: Captured[] = [];
      let profile = { ...me };
      await mockApi(
        page,
        {
          ...baseHandlers(),
          '/volunteers/me': (body) => {
            if (body && typeof body === 'object') profile = { ...profile, ...(body as object) };
            return { status: 200, body: profile };
          },
          '/volunteers/me/public-settings': (body) => {
            const flags = (body as { publicProfile: object }).publicProfile;
            profile = { ...profile, publicProfile: { ...profile.publicProfile, ...flags } };
            return { status: 200, body: profile };
          },
        },
        captured,
      );
      await page.goto('/en/volunteer/profile');
      await page.getByTestId('toggle-showStats').click();
      await expect(page.getByTestId('toggle-showStats')).toHaveAttribute('aria-checked', 'false');
      const patch = captured.find((c) => c.path.endsWith('/volunteers/me/public-settings'));
      expect(patch?.body).toEqual({ publicProfile: { showStats: false } });
    });

    test('skill add persists via POST /volunteers/me/skills', async ({ page }) => {
      const captured: Captured[] = [];
      const created = { id: 's9', skillId: 'seed1', level: 4 };
      await mockApi(
        page,
        {
          ...baseHandlers(),
          '/volunteers/me/skills': (body) =>
            typeof body === 'object' && body !== null && 'skillId' in (body as object)
              ? { status: 200, body: created }
              : { status: 200, body: [created] },
        },
        captured,
      );
      await page.goto('/en/volunteer/profile');
      await expect(page.getByTestId('skill-row')).toHaveCount(1);
      const post = captured.find(
        (c) => c.path.endsWith('/volunteers/me/skills') && c.method === 'POST',
      );
      expect(post).toBeUndefined();
      await page.locator('#skill-pick').selectOption('seed1');
      await page.getByTestId('profile-skills').getByRole('button', { name: en.profile.addSkill }).click();
      await expect
        .poll(() =>
          captured.find((c) => c.path.endsWith('/volunteers/me/skills') && c.method === 'POST'),
        )
        .toBeTruthy();
    });

    test('availability save persists via PUT /volunteers/me/availability', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(
        page,
        {
          ...baseHandlers(),
          '/volunteers/me/availability': (body) => ({ status: 200, body: body ?? emptySchedule }),
        },
        captured,
      );
      await page.goto('/en/volunteer/profile');
      await page.getByTestId('profile-availability').getByRole('button', { name: en.profile.addSlot }).first().click();
      await page.locator('#avail-monday-0-from').fill('09:00');
      await page.locator('#avail-monday-0-to').fill('12:00');
      await page.getByTestId('profile-availability').getByRole('button', { name: en.shared.save }).click();
      await expect(page.getByTestId('availability-saved')).toBeVisible();
      const put = captured.find((c) => c.path.endsWith('/volunteers/me/availability') && c.method === 'PUT');
      expect(put?.body).toMatchObject({ monday: [{ from: '09:00', to: '12:00' }] });
    });

    test('avatar rejects wrong file type before any upload', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/volunteer/profile');
      await page.locator('input[type="file"]').setInputFiles({
        name: 'clip.mp4',
        mimeType: 'video/mp4',
        buffer: Buffer.from([0, 1, 2]),
      });
      await expect(page.getByTestId('avatar-error')).toHaveText(en.profile.avatarTypeError);
      expect(captured.find((c) => c.path.endsWith('/media/uploads'))).toBeUndefined();
    });

    test('avatar upload runs the 2-step flow then patches profile', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(
        page,
        {
          ...baseHandlers(),
          '/media/uploads': { status: 200, body: { mediaId: 'm1', uploadUrl: 'https://cdn.example/up' } },
          '/media/m1/confirm': { status: 200 },
          '/volunteers/me': (body) => ({ status: 200, body: { ...me, ...(body as object) } }),
        },
        captured,
      );
      await page.goto('/en/volunteer/profile');
      await page.locator('input[type="file"]').setInputFiles({
        name: 'avatar.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from([0, 1, 2]),
      });
      await expect
        .poll(() =>
          captured.find((c) => c.path.endsWith('/media/uploads') && c.method === 'POST'),
        )
        .toBeTruthy();
      await expect.poll(() => captured.find((c) => c.path === 'PUT-bytes')).toBeTruthy();
      await expect
        .poll(() => captured.find((c) => c.path.endsWith('/media/m1/confirm')))
        .toBeTruthy();
    });

    test('per-session revoke removes the row', async ({ page }) => {
      const captured: Captured[] = [];
      let sessions = [currentSession, otherSession];
      await mockApi(
        page,
        {
          ...baseHandlers(),
          '/users/me/sessions': () => ({ status: 200, body: sessions }),
          '/users/me/sessions/sess-old': () => {
            sessions = [currentSession];
            return { status: 204 };
          },
        },
        captured,
      );
      await page.goto('/en/volunteer/settings');
      await expect(page.getByTestId('session-row')).toHaveCount(2);
      await page.getByTestId('session-row').nth(1).getByRole('button', { name: en.settings.revoke }).click();
      await expect(page.getByTestId('session-row')).toHaveCount(1);
      expect(
        captured.find((c) => c.path.endsWith('/users/me/sessions/sess-old') && c.method === 'DELETE'),
      ).toBeTruthy();
    });

    test('logout-others confirms then keeps current session', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(
        page,
        {
          ...baseHandlers(),
          '/users/me/sessions': () => ({ status: 200, body: [currentSession] }),
          '/auth/logout-others': { status: 204 },
        },
        captured,
      );
      await page.goto('/en/volunteer/settings');
      await page.getByRole('button', { name: en.settings.logoutOthers }).click();
      await expect(page.getByTestId('logout-others-confirm')).toBeVisible();
      expect(captured.find((c) => c.path.endsWith('/auth/logout-others'))).toBeUndefined();
      await page.getByRole('button', { name: en.shared.confirm }).click();
      await expect(page.getByTestId('logout-others-done')).toBeVisible();
      expect(captured.find((c) => c.path.endsWith('/auth/logout-others'))).toBeTruthy();
      await expect(page.getByTestId('session-row')).toHaveCount(1);
    });

    test('notification toggle persists via PATCH preferences', async ({ page }) => {
      const captured: Captured[] = [];
      let prefsState = { ...allPrefs };
      await mockApi(
        page,
        {
          ...baseHandlers(),
          '/notifications/preferences': (body) => {
            const patch = (
              body && typeof body === 'object' ? (body as { prefs?: object }).prefs : undefined
            ) as Record<string, boolean> | undefined;
            if (body && typeof body === 'object') prefsState = { ...prefsState, ...patch };
            return { status: 200, body: { prefs: prefsState } };
          },
        },
        captured,
      );
      await page.goto('/en/volunteer/settings');
      await page.getByTestId('pref-digest').click();
      await expect(page.getByTestId('pref-digest')).toHaveAttribute('aria-checked', 'false');
      const patch = captured.find((c) => c.path.endsWith('/notifications/preferences') && c.method === 'PATCH');
      expect(patch?.body).toEqual({ prefs: { ...allPrefs, digest: false } });
    });

    test('delete requires the confirm word before DELETE /users/me', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(
        page,
        { ...baseHandlers(), '/users/me': { status: 204 } },
        captured,
      );
      await page.goto('/en/volunteer/settings');
      await page.getByRole('button', { name: en.settings.deleteCta }).click();
      await expect(page.getByTestId('delete-confirm')).toBeVisible();
      await page.getByLabel(en.settings.deleteConfirmLabel).fill('nope');
      await page.getByTestId('delete-confirm').getByRole('button', { name: en.settings.deleteConfirm }).click();
      expect(captured.find((c) => c.path.endsWith('/users/me') && c.method === 'DELETE')).toBeUndefined();
      await page.getByLabel(en.settings.deleteConfirmLabel).fill('DELETE');
      await page.getByTestId('delete-confirm').getByRole('button', { name: en.settings.deleteConfirm }).click();
      await expect
        .poll(() =>
          captured.find((c) => c.path.endsWith('/users/me') && c.method === 'DELETE'),
        )
        .toBeTruthy();
    });

    test('invalid phone blocks contact save client-side', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/volunteer/settings');
      await page.getByLabel(en.settings.phoneLabel).fill('555 123');
      await page.getByTestId('settings-contact').getByRole('button', { name: en.shared.save }).click();
      await expect(page.getByText(en.shared.phoneInvalid)).toBeVisible();
      expect(captured.find((c) => c.method === 'PATCH')).toBeUndefined();
    });
  });
}
