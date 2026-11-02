import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/org-account/en.json';
import ar from '../src/messages/org-account/ar.json';
import toastEn from '../src/messages/toast/en.json';

type Locale = 'en' | 'ar';
const catalogs = { en, ar } as const;

const orgUser = {
  id: '64f000000000000000000002',
  email: 'org@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'organization',
  status: 'active',
};

const orgRecord = {
  registryId: '000123',
  slug: 'el-amel',
  verificationStatus: 'verified',
  nameAr: 'جمعية الأمل',
  nameFr: 'Association El-Amel',
  description: 'Community support association.',
  type: 'Association',
  registrationNumber: 'W-16-0001',
  location: { wilayaId: '16', municipalityId: '1601', address: 'Rue Didouche' },
  website: 'https://el-amel.example.org',
  foundedYear: 2018,
  contact: { email: 'contact@el-amel.example.org', phone: '+213555123456' },
  focusDisciplines: ['64f000000000000000000002'],
  operatingScope: 'National',
  logoMediaId: null,
  coverMediaId: null,
  annualReportMediaId: null,
  publicProfile: { enabled: true },
};

const completion = {
  percent: 62,
  missingFields: ['coverMediaId', 'logoMediaId'],
  complete: false,
};

const usersMe = {
  id: 'u2',
  email: 'org@example.com',
  phone: null,
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
};

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
    '/auth/me': { status: 200, body: orgUser },
    '/organizations/me': { status: 200, body: orgRecord },
    '/organizations/me/profile-completion': { status: 200, body: completion },
    '/users/me': { status: 200, body: usersMe },
    '/users/me/sessions': { status: 200, body: [currentSession, otherSession] },
    '/notifications/preferences': { status: 200, body: { prefs: allPrefs } },
  };
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
      test(`profile renders factsheet translated + public link (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, baseHandlers(), captured);
        await page.goto(`/${locale}/org/profile`);
        await expect(page.getByTestId('org-profile')).toBeVisible();
        await expect(
          page.getByTestId('org-profile').getByRole('heading', { level: 1 }),
        ).toHaveText(catalogs[locale].profile.title);
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          locale === 'ar' ? 'rtl' : 'ltr',
        );
        await expect(page.getByTestId('org-profile-facts')).toBeVisible();
        await expect(page.getByTestId('profile-code')).toHaveText('ORG-000123');
        await expect(page.getByTestId('profile-verification')).toHaveText(
          catalogs[locale].profile.verificationVerified,
        );
        await expect(page.getByTestId('profile-completion')).toContainText('62');
        await expect(page.getByTestId('public-profile-link')).toHaveAttribute(
          'href',
          `/${locale}/orgs/el-amel`,
        );
        await expect(page.getByTestId('cover-empty')).toBeVisible();
        await expect(page.getByTestId('logo-empty')).toBeVisible();
        await expect(page.getByTestId('report-empty')).toBeVisible();
        // Neutral surface: no statute/legal/directory copy in the profile
        // content. The app sidebar legitimately links to Discover Talents.
        await expect(page.locator('body')).not.toContainText(/Law 12-06/i);
        await expect(page.getByTestId('org-profile')).not.toContainText(/Discover Talents/i);
        await expect(page.locator('body')).not.toContainText(/statute/i);
      });

      test(`settings renders all sections with current badge (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, baseHandlers(), captured);
        await page.goto(`/${locale}/org/settings`);
        await expect(page.getByTestId('org-settings')).toBeVisible();
        await expect(page.getByTestId('settings-contact')).toBeVisible();
        await expect(page.getByTestId('settings-password')).toBeVisible();
        await expect(page.getByTestId('settings-sessions')).toBeVisible();
        await expect(page.getByTestId('settings-notifications')).toBeVisible();
        await expect(page.getByTestId('settings-visibility')).toBeVisible();
        await expect(page.getByTestId('settings-danger')).toBeVisible();
        await expect(page.getByTestId('session-row')).toHaveCount(2);
        await expect(page.getByTestId('this-device-badge')).toHaveCount(1);
        await expect(page.getByTestId('this-device-badge')).toContainText(
          catalogs[locale].settings.thisDevice,
        );
        await expect(page.getByTestId('visibility-toggle')).toHaveAttribute('aria-checked', 'true');
      });
    }

    test('fact edit persists via PATCH /organizations/me', async ({ page }) => {
      const captured: Captured[] = [];
      let org = { ...orgRecord };
      await mockApi(
        page,
        {
          ...baseHandlers(),
          '/organizations/me': (body) => {
            if (body && typeof body === 'object') org = { ...org, ...(body as object) };
            return { status: 200, body: org };
          },
        },
        captured,
      );
      await page.goto('/en/org/profile');
      await page.getByLabel(en.profile.websiteLabel).fill('https://new.example.org');
      await page.getByTestId('org-profile-facts').getByRole('button', { name: en.shared.save }).click();
      await expect(page.locator('[data-sonner-toast]')).toContainText(
        toastEn.success.orgProfileUpdated,
      );
      const patch = captured.find(
        (c) => c.path.endsWith('/organizations/me') && c.method === 'PATCH',
      );
      expect(patch?.body).toMatchObject({ website: 'https://new.example.org' });
    });

    test('invalid phone blocks factsheet save client-side', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/org/profile');
      await page.getByLabel(en.profile.contactPhoneLabel).fill('555 123');
      await page.getByTestId('org-profile-facts').getByRole('button', { name: en.shared.save }).click();
      await expect(page.getByText(en.profile.invalidPhone)).toBeVisible();
      expect(captured.find((c) => c.method === 'PATCH')).toBeUndefined();
    });

    test('local phone normalizes to canonical +213 form on save', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/org/profile');
      await page.getByLabel(en.profile.contactPhoneLabel).fill('0550 12 34 56');
      await page.getByTestId('org-profile-facts').getByRole('button', { name: en.shared.save }).click();
      await expect(page.locator('[data-sonner-toast]')).toContainText(
        toastEn.success.orgProfileUpdated,
      );
      const patch = captured.find(
        (c) => c.path.endsWith('/organizations/me') && c.method === 'PATCH',
      );
      expect(patch?.body).toMatchObject({ contact: { phone: '+213550123456' } });
    });

    test('cover rejects wrong file type before any upload', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/org/profile');
      await page.locator('#org-profile-cover').setInputFiles({
        name: 'clip.mp4',
        mimeType: 'video/mp4',
        buffer: Buffer.from([0, 1, 2]),
      });
      await expect(page.getByTestId('cover-error')).toHaveText(en.profile.fileTypeError);
      expect(captured.find((c) => c.path.endsWith('/media/uploads'))).toBeUndefined();
    });

    test('cover upload requires consent before any upload', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(
        page,
        {
          ...baseHandlers(),
          '/media/uploads': { status: 200, body: { mediaId: 'm1', uploadUrl: 'https://cdn.example/up' } },
          '/media/m1/confirm': { status: 200 },
        },
        captured,
      );
      await page.goto('/en/org/profile');
      await page.locator('#org-profile-cover').setInputFiles({
        name: 'cover.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from([0, 1, 2]),
      });
      await expect(page.getByTestId('consent-error')).toHaveText(en.profile.consentRequired);
      expect(captured.find((c) => c.path.endsWith('/media/uploads'))).toBeUndefined();
    });

    test('cover upload runs the 2-step flow then patches factsheet', async ({ page }) => {
      const captured: Captured[] = [];
      let org = { ...orgRecord };
      await mockApi(
        page,
        {
          ...baseHandlers(),
          '/media/uploads': { status: 200, body: { mediaId: 'm1', uploadUrl: 'https://cdn.example/up' } },
          '/media/m1/confirm': { status: 200 },
          '/organizations/me': (body) => {
            if (body && typeof body === 'object') org = { ...org, ...(body as object) };
            return { status: 200, body: org };
          },
        },
        captured,
      );
      await page.goto('/en/org/profile');
      await page.getByLabel(en.profile.consentLabel).check();
      await page.locator('#org-profile-cover').setInputFiles({
        name: 'cover.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from([0, 1, 2]),
      });
      await expect
        .poll(() => captured.find((c) => c.path.endsWith('/media/uploads') && c.method === 'POST'))
        .toBeTruthy();
      await expect.poll(() => captured.find((c) => c.path === 'PUT-bytes')).toBeTruthy();
      await expect.poll(() => captured.find((c) => c.path.endsWith('/media/m1/confirm'))).toBeTruthy();
      await page.getByTestId('org-profile-facts').getByRole('button', { name: en.shared.save }).click();
      await expect
        .poll(() =>
          captured.find((c) => c.path.endsWith('/organizations/me') && c.method === 'PATCH'),
        )
        .toBeTruthy();
      const patch = captured.find(
        (c) => c.path.endsWith('/organizations/me') && c.method === 'PATCH',
      );
      expect(patch?.body).toMatchObject({ coverMediaId: 'm1' });
    });

    test('cover preview renders from real coverMediaId', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(
        page,
        {
          ...baseHandlers(),
          '/organizations/me': { status: 200, body: { ...orgRecord, coverMediaId: 'm9' } },
          '/media/m9': { status: 200, body: { url: 'https://cdn.example/m9' } },
        },
        captured,
      );
      await page.goto('/en/org/profile');
      await expect(page.getByTestId('cover-preview')).toBeVisible();
      await expect(page.getByTestId('cover-empty')).toHaveCount(0);
    });

    test('annual report renders as a link only when attached', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(
        page,
        {
          ...baseHandlers(),
          '/organizations/me': { status: 200, body: { ...orgRecord, annualReportMediaId: 'm7' } },
          '/media/m7': { status: 200, body: { url: 'https://cdn.example/m7' } },
        },
        captured,
      );
      await page.goto('/en/org/profile');
      await expect(page.getByTestId('report-link')).toHaveAttribute(
        'href',
        'https://cdn.example/m7',
      );
      await expect(page.getByTestId('report-link')).toHaveText(en.profile.reportLinkLabel);
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
      await page.goto('/en/org/settings');
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
      await page.goto('/en/org/settings');
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
      await page.goto('/en/org/settings');
      await page.getByTestId('pref-digest').click();
      await expect(page.getByTestId('pref-digest')).toHaveAttribute('aria-checked', 'false');
      const patch = captured.find((c) => c.path.endsWith('/notifications/preferences') && c.method === 'PATCH');
      expect(patch?.body).toEqual({ prefs: { ...allPrefs, digest: false } });
    });

    test('visibility toggle persists via PATCH publicProfile', async ({ page }) => {
      const captured: Captured[] = [];
      let org = { ...orgRecord };
      await mockApi(
        page,
        {
          ...baseHandlers(),
          '/organizations/me': (body) => {
            if (body && typeof body === 'object') org = { ...org, ...(body as object) };
            return { status: 200, body: org };
          },
        },
        captured,
      );
      await page.goto('/en/org/settings');
      await page.getByTestId('visibility-toggle').click();
      await expect(page.getByTestId('visibility-toggle')).toHaveAttribute('aria-checked', 'false');
      const patch = captured.find(
        (c) => c.path.endsWith('/organizations/me') && c.method === 'PATCH',
      );
      expect(patch?.body).toEqual({ publicProfile: { enabled: false } });
    });

    test('delete requires the confirm word before DELETE /organizations/me', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(
        page,
        {
          ...baseHandlers(),
          '/organizations/me': { status: 200, body: { deleted: true, organizationId: 'o1' } },
        },
        captured,
      );
      await page.goto('/en/org/settings');
      await page.getByRole('button', { name: en.settings.deleteCta }).click();
      await expect(page.getByTestId('delete-confirm')).toBeVisible();
      await page.getByLabel(en.settings.deleteConfirmLabel).fill('nope');
      await page.getByTestId('delete-confirm').getByRole('button', { name: en.settings.deleteConfirm }).click();
      expect(
        captured.find((c) => c.path.endsWith('/organizations/me') && c.method === 'DELETE'),
      ).toBeUndefined();
      await page.getByLabel(en.settings.deleteConfirmLabel).fill('DELETE');
      await page.getByTestId('delete-confirm').getByRole('button', { name: en.settings.deleteConfirm }).click();
      await expect
        .poll(() => captured.find((c) => c.path.endsWith('/organizations/me') && c.method === 'DELETE'))
        .toBeTruthy();
      await expect(page).toHaveURL(/\/login/);
    });

    test('invalid phone blocks contact save client-side', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/org/settings');
      await page.getByLabel(en.settings.phoneLabel).fill('555 123');
      // Invalid input keeps the account form clean, so saving stays disabled.
      await expect(
        page.getByTestId('settings-contact').getByRole('button', { name: en.shared.save }),
      ).toBeDisabled();
      expect(captured.find((c) => c.method === 'PATCH')).toBeUndefined();
    });
  });
}
