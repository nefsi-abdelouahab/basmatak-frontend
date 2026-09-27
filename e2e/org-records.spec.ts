import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/orgRecords/en.json';
import ar from '../src/messages/orgRecords/ar.json';

type Locale = 'en' | 'ar';
const catalogs = { en, ar } as const;

const user = {
  id: '64f000000000000000000002',
  email: 'org@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'organization',
  status: 'active',
};

const rec1 = {
  id: '64f0000000000000000000a1',
  registryId: 'EXP-000001',
  title: 'Beach cleanup',
  description: 'Shoreline shift',
  skills: ['64f0000000000000000000b2'],
  duration: 180,
  organization: { id: 'o1', slug: 'el-amel', nameFr: 'Association El-Amel', nameAr: 'جمعية الأمل' },
  verifiedAt: '2026-09-05T12:00:00.000Z',
  verificationCode: 'ABCDEFGH',
  publicVisibility: 'public',
  review: { rating: 5, notes: 'Great work' },
};

const rec2 = {
  ...rec1,
  id: '64f0000000000000000000a2',
  registryId: 'EXP-000002',
  title: 'Food drive',
  verificationCode: 'IJKLMNOP',
  publicVisibility: 'private',
  review: null,
};

const recPage = {
  items: [rec1, rec2],
  nextCursor: null,
  limit: 20,
  total: 2,
  page: 1,
  pages: 1,
};

const reviewsPage = {
  items: [{ rating: 5, comment: 'Great work' }],
  nextCursor: null,
  limit: 20,
  total: 1,
  page: 1,
  pages: 1,
};

interface Captured {
  path: string;
  method: string;
  body: unknown;
  query: string;
}

type Handler = { status: number; body?: unknown } | ((body: unknown, method: string) => { status: number; body?: unknown });

async function mockApi(page: Page, handlers: Record<string, Handler>, captured: Captured[]) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/attestation')) {
      captured.push({ path: url.pathname, method: route.request().method(), body: undefined, query: url.search });
      return route.fulfill({
        status: 200,
        headers: { 'content-disposition': 'attachment; filename="attestation.pdf"', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-disposition' },
        contentType: 'application/pdf',
        body: Buffer.from([37, 80, 68, 70]),
      });
    }
    if (url.search.includes('format=csv')) {
      captured.push({ path: url.pathname, method: route.request().method(), body: undefined, query: url.search });
      return route.fulfill({
        status: 200,
        headers: { 'content-disposition': 'attachment; filename="org-experiences.csv"', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-disposition' },
        contentType: 'text/csv',
        body: 'id,registryId,title\n1,EXP-000001,Beach cleanup\n',
      });
    }
    const key = Object.keys(handlers).find((k) => url.pathname.endsWith(k));
    if (!key) return route.fulfill({ status: 404, body: '{}' });
    let rawBody: unknown;
    try {
      rawBody = route.request().postDataJSON();
    } catch {
      rawBody = undefined;
    }
    captured.push({ path: url.pathname, method: route.request().method(), body: rawBody, query: url.search });
    const handler = handlers[key];
    const { status, body } = typeof handler === 'function' ? handler(rawBody, route.request().method()) : handler;
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: body === undefined ? '' : JSON.stringify(body),
    });
  });
}

function baseHandlers(): Record<string, Handler> {
  return {
    '/auth/me': { status: 200, body: user },
    '/organizations/me/experiences': { status: 200, body: recPage },
    '/organizations/me/reviews': { status: 200, body: reviewsPage },
  };
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
      test(`archive renders enriched rows translated plus reviews (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, baseHandlers(), captured);
        await page.goto(`/${locale}/org/experiences`);
        await expect(page.getByTestId('org-records')).toBeVisible();
        await expect(
          page.getByTestId('org-records').getByRole('heading', { level: 1 }),
        ).toHaveText(catalogs[locale].archive.title);
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          locale === 'ar' ? 'rtl' : 'ltr',
        );
        await expect(page.getByTestId('org-records-filters')).toBeVisible();
        await expect(page.getByTestId('org-records-count')).toContainText('2');
        await expect(page.getByTestId('org-record-card')).toHaveCount(2);
        // Enriched line: inline code, EXP registry id, visibility display.
        const first = page.getByTestId('org-record-card').first();
        await expect(first).toContainText('ABCDEFGH');
        await expect(first).toContainText('EXP-000001');
        await expect(first).toContainText(
          locale === 'ar' ? 'عام' : 'Public',
        );
        // No audio player anywhere on the route.
        await expect(page.locator('audio')).toHaveCount(0);
        // No ledger/SHA/civic-registry copy anywhere on the route.
        const bodyText = (await page.getByTestId('org-records').innerText()).toLowerCase();
        expect(bodyText).not.toContain('sha-256');
        expect(bodyText).not.toContain('ledger');
        expect(bodyText).not.toContain('dz-civic');
        // Reviews-given section on the same page (OQ2: section below archive).
        await expect(page.getByTestId('org-reviews')).toBeVisible();
        await expect(page.getByTestId('org-review-row')).toHaveCount(1);
      });
    }

    test('search filter refetches with the q param', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/org/experiences');
      await expect(page.getByTestId('org-record-card')).toHaveCount(2);
      await page.locator('#org-records-q').fill('beach');
      await expect
        .poll(() =>
          captured.find(
            (c) => c.path.endsWith('/organizations/me/experiences') && c.query.includes('q=beach'),
          ),
        )
        .toBeTruthy();
    });

    test('visibility filter refetches with the visibility param', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/org/experiences');
      await expect(page.getByTestId('org-record-card')).toHaveCount(2);
      await page.locator('#org-records-visibility').selectOption('private');
      await expect
        .poll(() =>
          captured.find(
            (c) => c.path.endsWith('/organizations/me/experiences') && c.query.includes('visibility=private'),
          ),
        )
        .toBeTruthy();
    });

    test('CSV exports as a file without navigation', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/org/experiences');
      const before = page.url();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('org-records-csv').click(),
      ]);
      expect(download.suggestedFilename()).toBe('org-experiences.csv');
      expect(page.url()).toBe(before);
    });

    test('copy link confirms or falls back to selectable text', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/org/experiences');
      await page.getByTestId('org-copy-64f0000000000000000000a1').click();
      await expect(
        page.getByTestId('org-copied-64f0000000000000000000a1').or(
          page.getByTestId('org-copy-fallback-64f0000000000000000000a1'),
        ),
      ).toBeVisible();
    });

    test('attestation downloads as a file without navigation', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/org/experiences');
      const before = page.url();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('org-download-64f0000000000000000000a1').click(),
      ]);
      expect(download.suggestedFilename()).toBe('attestation.pdf');
      expect(page.url()).toBe(before);
    });
  });
}
