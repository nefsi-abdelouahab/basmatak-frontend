import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/volunteer-credentials/en.json';
import ar from '../src/messages/volunteer-credentials/ar.json';

type Locale = 'en' | 'ar';
const catalogs = { en, ar } as const;

const user = {
  id: '64f000000000000000000001',
  email: 'v@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'volunteer',
  status: 'active',
};

const exp1 = {
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

const exp2 = {
  ...exp1,
  id: '64f0000000000000000000a2',
  registryId: 'EXP-000002',
  title: 'Food drive',
  verificationCode: 'IJKLMNOP',
  publicVisibility: 'private',
};

const expPage = {
  items: [exp1, exp2],
  nextCursor: null,
  limit: 20,
  total: 2,
  page: 1,
  pages: 1,
};

const expDetail = { ...exp1, evidence: [] };

const reviews = [
  { rating: 5, comment: 'Great work', organization: { slug: 'el-amel', nameFr: 'Association El-Amel', nameAr: 'جمعية الأمل' } },
];

const portfolioItems = [
  {
    id: 'p1',
    title: 'Cleanup photos',
    description: 'Shoreline set',
    mediaIds: ['m1'],
    visibility: 'public',
    order: 0,
    typeLabel: 'Photography',
    tags: ['beach', 'team'],
    media: [
      { mediaId: 'm1', type: 'file', mimeType: 'image/jpeg', filename: 'a.jpg', url: null },
    ],
  },
  {
    id: 'p2',
    title: 'Field notes',
    description: null,
    mediaIds: [],
    visibility: 'private',
    order: 1,
    typeLabel: null,
    tags: [],
    media: [],
  },
];

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
        headers: { 'content-disposition': 'attachment; filename=\"attestation.pdf\"', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-disposition' },
        contentType: 'application/pdf',
        body: Buffer.from([37, 80, 68, 70]),
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
  await page.route('**/cdn.example/**', async (route: Route) => {
    captured.push({ path: 'PUT-bytes', method: 'PUT', body: undefined, query: '' });
    return route.fulfill({
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: '',
    });
  });
}

function baseHandlers(): Record<string, Handler> {
  return {
    '/auth/me': { status: 200, body: user },
    '/experiences/me': { status: 200, body: expPage },
    '/experiences/64f0000000000000000000a1': { status: 200, body: expDetail },
    '/volunteers/me/reviews': { status: 200, body: reviews },
    '/skill-categories': {
      status: 200,
      body: [{ id: 'c1', nameFr: 'Santé', nameAr: 'الصحة' }],
    },
    '/skills': { status: 200, body: [{ id: 'seed1', skillId: 'seed1', nameFr: 'Secours', nameAr: 'إسعاف' }] },
    '/portfolio/me': { status: 200, body: portfolioItems },
    '/portfolio/me/order': { status: 200, body: portfolioItems },
    '/portfolio/p1': { status: 204 },
    '/portfolio/p2': { status: 204 },
    '/media/uploads': { status: 200, body: { mediaId: 'm9', uploadUrl: 'https://cdn.example/up' } },
    '/media/m9/confirm': { status: 200 },
  };
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
      test(`experiences renders enriched records translated plus reviews (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, baseHandlers(), captured);
        await page.goto(`/${locale}/volunteer/experiences`);
        await expect(page.getByTestId('volunteer-experiences')).toBeVisible();
        await expect(
          page.getByTestId('volunteer-experiences').getByRole('heading', { level: 1 }),
        ).toHaveText(catalogs[locale].experiences.title);
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          locale === 'ar' ? 'rtl' : 'ltr',
        );
        await expect(page.getByTestId('exp-filters')).toBeVisible();
        await expect(page.getByTestId('exp-count')).toContainText('2');
        await expect(page.getByTestId('exp-card')).toHaveCount(2);
        // Enriched line: org name by locale, inline code, EXP registry id.
        const first = page.getByTestId('exp-card').first();
        await expect(first).toContainText(
          locale === 'ar' ? 'جمعية الأمل' : 'Association El-Amel',
        );
        await expect(first).toContainText('ABCDEFGH');
        await expect(first).toContainText('EXP-000001');
        // No audio player anywhere on the route.
        await expect(page.locator('audio')).toHaveCount(0);
        // Reviews section on the same page (OQ2).
        await expect(page.getByTestId('exp-reviews')).toBeVisible();
        await expect(page.getByTestId('review-row')).toHaveCount(1);
      });

      test(`portfolio renders ordered items with metadata translated (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, baseHandlers(), captured);
        await page.goto(`/${locale}/volunteer/portfolio`);
        await expect(page.getByTestId('volunteer-portfolio')).toBeVisible();
        await expect(
          page.getByTestId('volunteer-portfolio').getByRole('heading', { level: 1 }),
        ).toHaveText(catalogs[locale].portfolio.title);
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          locale === 'ar' ? 'rtl' : 'ltr',
        );
        await expect(page.getByTestId('portfolio-count')).toContainText('2');
        await expect(page.getByTestId('portfolio-card')).toHaveCount(2);
        const first = page.getByTestId('portfolio-card').first();
        await expect(first).toContainText('Photography');
        await expect(first).toContainText('beach');
        await expect(page.locator('audio')).toHaveCount(0);
      });
    }

    test('category filter refetches with the query param', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/volunteer/experiences');
      await expect(page.getByTestId('exp-card')).toHaveCount(2);
      await page.locator('#exp-category').selectOption('c1');
      await expect
        .poll(() =>
          captured.find(
            (c) => c.path.endsWith('/experiences/me') && c.query.includes('categoryId=c1'),
          ),
        )
        .toBeTruthy();
    });

    test('visibility toggle persists via PATCH with publicVisibility', async ({ page }) => {
      const captured: Captured[] = [];
      let visibility = 'private';
      await mockApi(
        page,
        {
          ...baseHandlers(),
          '/experiences/me': () => ({
            status: 200,
            body: { ...expPage, items: [{ ...exp2, publicVisibility: visibility }] },
          }),
          '/experiences/64f0000000000000000000a2/visibility': (body) => {
            visibility = (body as { publicVisibility: string }).publicVisibility;
            return { status: 200, body: {} };
          },
        },
        captured,
      );
      await page.goto('/en/volunteer/experiences');
      const toggle = page.getByTestId('visibility-toggle-64f0000000000000000000a2');
      await expect(toggle).toHaveAttribute('aria-checked', 'false');
      await toggle.click();
      await expect
        .poll(() => captured.find((c) => c.path.endsWith('/visibility') && c.method === 'PATCH'))
        .toBeTruthy();
      const patch = captured.find((c) => c.path.endsWith('/visibility') && c.method === 'PATCH');
      expect(patch?.body).toEqual({ publicVisibility: 'public' });
    });

    test('attestation downloads as a file without navigation', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/volunteer/experiences');
      const before = page.url();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('exp-download-64f0000000000000000000a1').click(),
      ]);
      expect(download.suggestedFilename()).toBe('attestation.pdf');
      expect(page.url()).toBe(before);
    });

    test('copy link confirms or falls back to selectable text', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/volunteer/experiences');
      await page.getByTestId('exp-copy-64f0000000000000000000a1').click();
      await expect(
        page.getByTestId('exp-copied-64f0000000000000000000a1').or(
          page.getByTestId('exp-copy-fallback-64f0000000000000000000a1'),
        ),
      ).toBeVisible();
    });

    test('portfolio create posts metadata then lists the item', async ({ page }) => {
      const captured: Captured[] = [];
      let items = [...portfolioItems];
      await mockApi(
        page,
        {
          ...baseHandlers(),
          '/portfolio/me': (body, method) => {
            if (method === 'POST') {
              const created = {
                id: 'p3',
                description: null,
                mediaIds: [],
                visibility: 'public',
                order: 2,
                typeLabel: null,
                tags: [],
                media: [],
                ...((body as object) ?? {}),
              };
              items = [...items, created];
              return { status: 200, body: created };
            }
            return { status: 200, body: items };
          },
        },
        captured,
      );
      await page.goto('/en/volunteer/portfolio');
      await expect(page.getByTestId('portfolio-card')).toHaveCount(2);
      await page.getByTestId('portfolio-new').click();
      await page.getByLabel(en.portfolio.titleLabel).fill('New sample');
      await page.getByLabel(en.portfolio.typeLabelLabel).fill('Design');
      await page.getByLabel(en.portfolio.tagsLabel).fill('poster, print');
      await page.getByTestId('portfolio-submit').click();
      await expect(page.getByTestId('portfolio-card')).toHaveCount(3);
      const post = captured.find((c) => c.path.endsWith('/portfolio/me') && c.method === 'POST');
      expect(post?.body).toMatchObject({ title: 'New sample', typeLabel: 'Design' });
    });

    test('portfolio reorder saves the full id sequence', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/volunteer/portfolio');
      await page.getByTestId('portfolio-move-down-p1').click();
      await page.getByTestId('portfolio-save-order').click();
      await expect
        .poll(() => captured.find((c) => c.path.endsWith('/portfolio/me/order') && c.method === 'PUT'))
        .toBeTruthy();
      const put = captured.find((c) => c.path.endsWith('/portfolio/me/order') && c.method === 'PUT');
      expect(put?.body).toEqual({ itemIds: ['p2', 'p1'] });
    });

    test('portfolio delete requires confirm before DELETE', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/volunteer/portfolio');
      await page.getByTestId('portfolio-delete-p1').click();
      await expect(page.getByTestId('portfolio-delete-confirm')).toBeVisible();
      expect(
        captured.find((c) => c.path.endsWith('/portfolio/p1') && c.method === 'DELETE'),
      ).toBeUndefined();
      await page.getByTestId('portfolio-delete-confirm-btn').click();
      await expect
        .poll(() => captured.find((c) => c.path.endsWith('/portfolio/p1') && c.method === 'DELETE'))
        .toBeTruthy();
    });

    test('portfolio rejects audio before any upload', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/volunteer/portfolio');
      await page.getByTestId('portfolio-new').click();
      await page.locator('#portfolio-file').setInputFiles({
        name: 'clip.mp3',
        mimeType: 'audio/mpeg',
        buffer: Buffer.from([0, 1, 2]),
      });
      await expect(page.getByTestId('portfolio-file-error')).toHaveText(en.portfolio.fileTypeError);
      expect(captured.find((c) => c.path.endsWith('/media/uploads'))).toBeUndefined();
    });

    test('portfolio PDF upload runs the 2-step flow then attaches', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/volunteer/portfolio');
      await page.getByTestId('portfolio-new').click();
      await page.locator('#portfolio-file').setInputFiles({
        name: 'doc.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from([0, 1, 2]),
      });
      await expect
        .poll(() => captured.find((c) => c.path.endsWith('/media/uploads') && c.method === 'POST'))
        .toBeTruthy();
      await expect.poll(() => captured.find((c) => c.path === 'PUT-bytes')).toBeTruthy();
      await expect
        .poll(() => captured.find((c) => c.path.endsWith('/media/m9/confirm')))
        .toBeTruthy();
      await expect(page.getByTestId('portfolio-attached')).toContainText('m9');
    });
  });
}
