import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/opportunityDetails/en.json';
import ar from '../src/messages/opportunityDetails/ar.json';

type Locale = 'en' | 'ar';
const catalogs = { en, ar } as const;

const user = {
  id: '64f000000000000000000001',
  email: 'v@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'volunteer',
  status: 'active',
};

const positionOpen = {
  _id: '64f0000000000000000000a1',
  title: 'Lead Event Photographer',
  description: 'Capture the festival.',
  requiredCount: 2,
  filledCount: 1,
  requiredSkills: [],
  deliverables: ['15 edited photographs'],
  startAt: null,
  applicationCount: 3,
  assigned: [{ volunteerId: 'v1', fullName: 'Amine Benali', username: 'amineb', avatarMediaId: null }],
  skillNames: [{ skillId: 's1', nameFr: 'Photo', nameAr: 'تصوير' }],
};

const positionSecond = {
  _id: '64f0000000000000000000a2',
  title: 'Documentary Videographer',
  description: 'Film the gathering.',
  requiredCount: 1,
  filledCount: 0,
  requiredSkills: [],
  deliverables: [],
  startAt: null,
  applicationCount: 1,
  assigned: [],
  skillNames: [],
};

const detail = {
  _id: '64f0000000000000000000b2',
  slug: 'cultural-heritage-festival',
  title: 'Cultural Heritage Festival Documentation',
  description: 'Document the annual gathering.',
  categoryId: '64f0000000000000000000c3',
  registryId: 'OPP-000123',
  mode: 'onsite',
  coverMediaId: null,
  endDate: '2026-10-18T00:00:00.000Z',
  startDate: '2026-10-18T00:00:00.000Z',
  applicationDeadline: '2026-10-16T23:59:00.000Z',
  durationMinutes: 180,
  prerequisites: ['Camera'],
  status: 'published',
  location: { wilayaId: '01', municipalityId: '0101' },
  positions: [positionOpen, positionSecond],
  organization: {
    id: '64f0000000000000000000d4',
    slug: 'timimoun-cultural',
    nameFr: 'Association Culturelle',
    nameAr: 'الجمعية الثقافية',
    logoMediaId: null,
    verificationStatus: 'verified',
  },
  categoryName: { nameFr: 'Culture', nameAr: 'ثقافة' },
  locationLabels: { wilaya: { nameFr: 'Adrar', nameAr: 'أدرار' }, municipality: null },
  isFavorited: false,
  favoriteCount: 4,
};

const relatedItem = {
  ...detail,
  _id: '64f0000000000000000000b3',
  slug: 'oasis-cleanup',
  title: 'Oasis Cleanup Day',
};

const relatedPage = {
  items: [relatedItem],
  nextCursor: null,
  limit: 6,
  total: 1,
  page: 1,
  pages: 1,
};

const emptyApps = { items: [], nextCursor: null, limit: 50, total: 0, page: 1, pages: 1 };

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
}

function authedHandlers(
  overrides: Record<string, { status: number; body?: unknown } | ((body: unknown) => { status: number; body?: unknown })> = {},
): Record<string, { status: number; body?: unknown } | ((body: unknown) => { status: number; body?: unknown })> {
  return {
    '/auth/me': { status: 200, body: user },
    '/opportunities/cultural-heritage-festival': { status: 200, body: detail },
    '/opportunities': { status: 200, body: relatedPage },
    '/applications/me': { status: 200, body: emptyApps },
    ...overrides,
  };
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
      test(`detail renders translated meta, positions, sidebar, related (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, authedHandlers(), captured);
        await page.goto(`/${locale}/volunteer/opportunities/cultural-heritage-festival`);
        await expect(page.getByTestId('opportunity-details')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          locale === 'ar' ? 'rtl' : 'ltr',
        );
        await expect(
          page.getByTestId('opportunity-details').getByRole('heading', { level: 1 }),
        ).toHaveText(detail.title);
        await expect(page.getByTestId('detail-ref')).toHaveText('OPP-000123');
        await expect(page.getByTestId('detail-header')).toBeVisible();
        await expect(page.getByTestId('detail-meta')).toBeVisible();
        await expect(page.getByTestId('position-card')).toHaveCount(2);
        await expect(page.getByTestId('detail-org')).toBeVisible();
        await expect(page.getByTestId('detail-related')).toBeVisible();
        await expect(page.getByRole('heading', { name: catalogs[locale].positions.title })).toBeVisible();
        await expect(page.getByRole('heading', { name: catalogs[locale].certificate.title }).first()).toBeVisible();
        // FCD CUT: perks/logistics blocks never render.
        await expect(page.getByText('Hospitality')).toHaveCount(0);
        await expect(page.getByText('Civic Recognition')).toHaveCount(0);
      });
    }

    test('apply with message posts then shows success', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(
        page,
        authedHandlers({
          '/positions/64f0000000000000000000a1/applications': {
            status: 201,
            body: { _id: 'app9', status: 'pending' },
          },
        }),
        captured,
      );
      await page.goto('/en/volunteer/opportunities/cultural-heritage-festival');
      await expect(page.getByTestId('position-card')).toHaveCount(2);
      await page.getByTestId('apply-cta').click();
      await expect(page.getByTestId('apply-dialog')).toBeVisible();
      await page.locator('#apply-message').fill('Motivated photographer');
      await page.getByTestId('apply-submit').click();
      await expect
        .poll(() =>
          captured.find(
            (c) => c.path.endsWith('/positions/64f0000000000000000000a1/applications') && c.method === 'POST',
          ),
        )
        .toBeTruthy();
      const post = captured.find(
        (c) => c.path.endsWith('/positions/64f0000000000000000000a1/applications') && c.method === 'POST',
      );
      expect(post?.body).toEqual({ message: 'Motivated photographer' });
      await expect(page.getByTestId('apply-success')).toBeVisible();
    });

    test('guest apply redirects to login with next', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(
        page,
        {
          '/auth/me': { status: 401, body: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Expired' } },
          '/opportunities/cultural-heritage-festival': { status: 200, body: detail },
          '/opportunities': { status: 200, body: relatedPage },
        },
        captured,
      );
      await page.goto('/en/volunteer/opportunities/cultural-heritage-festival');
      await expect(page.getByTestId('opportunity-details')).toBeVisible();
      await page.getByTestId('apply-cta').click();
      await expect(page).toHaveURL(/\/en\/login\?next=/);
      expect(
        captured.find((c) => c.path.includes('/positions/') && c.method === 'POST'),
      ).toBeUndefined();
    });

    test('withdraw confirms then posts and shows success', async ({ page }) => {
      const captured: Captured[] = [];
      const liveApps = {
        ...emptyApps,
        items: [{ _id: 'app1', opportunityId: '64f0000000000000000000b2', positionId: '64f0000000000000000000a1', status: 'pending' }],
        total: 1,
      };
      await mockApi(
        page,
        authedHandlers({
          '/applications/me': { status: 200, body: liveApps },
          '/applications/app1/withdraw': { status: 200, body: { _id: 'app1', status: 'withdrawn' } },
        }),
        captured,
      );
      await page.goto('/en/volunteer/opportunities/cultural-heritage-festival');
      await expect(page.getByTestId('withdraw-cta')).toBeVisible();
      await page.getByTestId('withdraw-cta').click();
      await expect(page.getByTestId('withdraw-confirm')).toBeVisible();
      await page.getByTestId('withdraw-confirm-action').click();
      await expect(page.getByTestId('withdraw-success')).toBeVisible();
      expect(
        captured.find((c) => c.path.endsWith('/applications/app1/withdraw') && c.method === 'POST'),
      ).toBeTruthy();
    });

    test('report requires a reason then posts with the opportunity target', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(
        page,
        authedHandlers({
          '/reports': { status: 201, body: { _id: 'r1', status: 'open' } },
        }),
        captured,
      );
      await page.goto('/en/volunteer/opportunities/cultural-heritage-festival');
      await page.getByTestId('report-cta').click();
      await expect(page.getByTestId('report-dialog')).toBeVisible();
      await page.getByTestId('report-submit').click();
      await expect(page.getByText(en.report.reasonRequired)).toBeVisible();
      expect(captured.find((c) => c.path.endsWith('/reports'))).toBeUndefined();
      await page.locator('#report-reason').fill('Spam');
      await page.getByTestId('report-submit').click();
      await expect(page.getByTestId('report-success')).toBeVisible();
      const post = captured.find((c) => c.path.endsWith('/reports') && c.method === 'POST');
      expect(post?.body).toEqual({
        targetType: 'opportunity',
        targetId: '64f0000000000000000000b2',
        reason: 'Spam',
      });
    });

    test('full position disables apply with a gate note', async ({ page }) => {
      const captured: Captured[] = [];
      const fullDetail = {
        ...detail,
        positions: [{ ...positionOpen, filledCount: 2 }],
      };
      await mockApi(
        page,
        authedHandlers({ '/opportunities/cultural-heritage-festival': { status: 200, body: fullDetail } }),
        captured,
      );
      await page.goto('/en/volunteer/opportunities/cultural-heritage-festival');
      await expect(page.getByTestId('apply-cta')).toBeDisabled();
      await expect(page.getByTestId('apply-gate-note')).toHaveText(en.positions.fullNote);
    });

    test('non-published id renders the 404 state', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(
        page,
        authedHandlers({
          '/opportunities/cultural-heritage-festival': {
            status: 404,
            body: { statusCode: 404, code: 'NOT_FOUND', message: 'Missing' },
          },
        }),
        captured,
      );
      await page.goto('/en/volunteer/opportunities/cultural-heritage-festival');
      await expect(page.getByText(en.detail.notFoundTitle)).toBeVisible();
    });
  });
}
