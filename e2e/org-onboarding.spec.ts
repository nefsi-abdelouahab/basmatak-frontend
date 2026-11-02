import { expect, test, type Page, type Route } from '@playwright/test';
import orgAr from '../src/messages/orgOnboarding/ar.json';
import orgEn from '../src/messages/orgOnboarding/en.json';
import toastEn from '../src/messages/toast/en.json';

type Locale = 'en' | 'ar';
const catalogs = { en: orgEn, ar: orgAr } as const;

const verifiedOrgUser = {
  id: '64f000000000000000000002',
  email: 'org@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'organization',
  status: 'active',
};

const unverifiedOrgUser = { ...verifiedOrgUser, emailVerifiedAt: null };

const orgRecord = {
  registryId: 'ORG-000123',
  verificationStatus: 'pending',
  nameFr: 'Association El-Amel',
  type: 'Association',
};

async function mockApi(page: Page, handlers: Record<string, { status: number; body?: unknown }>) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    const key = Object.keys(handlers).find((k) => path.endsWith(k));
    if (!key) return route.fulfill({ status: 404, body: '{}' });
    const { status, body } = handlers[key];
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: body === undefined ? '' : JSON.stringify(body),
    });
  });
  await page.route('https://uploads.test/**', async (route: Route) => {
    if (route.request().method() === 'PUT') return route.fulfill({ status: 200, body: '' });
    return route.fulfill({ status: 404, body: '{}' });
  });
}

async function mockOnboarding(
  page: Page,
  opts: {
    user?: unknown;
    org?: unknown;
    completion?: unknown;
    verification?: unknown;
    wilayas?: unknown;
    municipalities?: unknown;
  } = {},
) {
  await mockApi(page, {
    '/auth/me': { status: 200, body: opts.user ?? verifiedOrgUser },
    '/organizations/me': { status: 200, body: opts.org ?? orgRecord },
    '/organizations/me/profile-completion': {
      status: 200,
      body: opts.completion ?? {
        percent: 33,
        missingFields: ['website', 'coverMediaId'],
        complete: false,
      },
    },
    '/organizations/me/verification': {
      status: 200,
      body: opts.verification ?? { verificationStatus: 'pending', latest: null },
    },
    '/locations/wilayas': {
      status: 200,
      body: opts.wilayas ?? [{ code: '16', nameFr: 'Alger', nameAr: 'الجزائر' }],
    },
    '/wilayas/16/municipalities': {
      status: 200,
      body: opts.municipalities ?? [{ code: '1601', nameFr: 'Alger Centre', nameAr: 'الجزائر الوسطى' }],
    },
    '/media/uploads': {
      status: 200,
      body: { mediaId: 'm1', uploadUrl: 'https://uploads.test/f1' },
    },
    '/media/m1/confirm': { status: 200, body: {} },
  });
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
      test(`complete-profile renders, translated, RTL-correct (${locale})`, async ({ page }) => {
        await mockOnboarding(page);
        await page.goto(`/${locale}/org/complete-profile`);
        await expect(page.getByTestId('org-complete-profile')).toBeVisible();
        await expect(
          page.getByTestId('org-complete-profile').getByRole('heading', { level: 1 }),
        ).toHaveText(catalogs[locale].completeProfile.title);
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          locale === 'ar' ? 'rtl' : 'ltr',
        );
        await expect(page.getByTestId('org-checklist')).toContainText(
          catalogs[locale].completeProfile.checklistTitle,
        );
      });

      test(`verification-dossier renders, translated, shows registry code (${locale})`, async ({
        page,
      }) => {
        await mockOnboarding(page);
        await page.goto(`/${locale}/org/verification-dossier`);
        await expect(page.getByTestId('org-dossier')).toBeVisible();
        await expect(
          page.getByTestId('org-dossier').getByRole('heading', { level: 1 }),
        ).toHaveText(catalogs[locale].dossier.title);
        await expect(page.getByTestId('org-registry-code')).toContainText('ORG-000123');
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          locale === 'ar' ? 'rtl' : 'ltr',
        );
      });
    }

    test('complete-profile PATCH drives checklist to 100%', async ({ page }) => {
      let completion: unknown = { percent: 33, missingFields: ['website'], complete: false };
      await mockApi(page, {
        '/auth/me': { status: 200, body: verifiedOrgUser },
        '/organizations/me': { status: 200, body: orgRecord },
        '/locations/wilayas': { status: 200, body: [] },
      });
      await page.route('**/api/v1/organizations/me/profile-completion', async (route: Route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(completion),
        });
      });
      await page.route('**/api/v1/organizations/me', async (route: Route) => {
        if (route.request().method() === 'PATCH') {
          completion = { percent: 100, missingFields: [], complete: true };
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(orgRecord),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(orgRecord),
        });
      });
      await page.goto('/en/org/complete-profile');
      await page.getByLabel(orgEn.completeProfile.websiteLabel).fill('https://example.org');
      await page.getByRole('button', { name: orgEn.completeProfile.save }).click();
      await expect(page.locator('[data-sonner-toast]')).toContainText(
        toastEn.success.orgProfileUpdated,
      );
      await expect(page.getByTestId('org-checklist')).toContainText('100%');
    });

    test('dossier upload→confirm→submit→pending', async ({ page }) => {
      await mockOnboarding(page);
      await page.route('**/api/v1/organizations/me/verification', async (route: Route) => {
        const url = new URL(route.request().url()).pathname;
        if (route.request().method() === 'POST' && url.endsWith('/organizations/me/verification')) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'pending' }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ verificationStatus: 'pending', latest: null }),
        });
      });
      await page.goto('/en/org/verification-dossier');
      await page
        .locator('#org-dossier-files')
        .setInputFiles([{ name: 'id.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') }]);
      await page.getByRole('button', { name: orgEn.dossier.submit }).click();
      await expect(page.getByTestId('org-dossier-submitted')).toContainText(
        orgEn.dossier.submitted,
      );
      await expect(page.getByTestId('org-pending-review')).toContainText(
        orgEn.dossier.pendingTitle,
      );
    });

    test('rejected dossier shows reason and resubmit CTA', async ({ page }) => {
      await mockOnboarding(page, {
        verification: {
          verificationStatus: 'rejected',
          latest: { status: 'rejected', documents: ['m0'], rejectionReason: 'Unreadable scan' },
        },
      });
      await page.goto('/en/org/verification-dossier');
      await expect(page.getByTestId('org-dossier')).toContainText(
        orgEn.dossier.rejectedTitle,
      );
      await expect(page.getByTestId('org-dossier')).toContainText('Unreadable scan');
      await expect(
        page.getByRole('button', { name: orgEn.dossier.resubmit }),
      ).toBeVisible();
    });

    test('unverified org is gated to email verification', async ({ page }) => {
      await mockOnboarding(page, { user: unverifiedOrgUser });
      await page.goto('/en/org/verification-dossier');
      await expect(page).toHaveURL(/\/en\/verify-email/);
    });
  });
}
