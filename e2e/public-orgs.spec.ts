import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/public-orgs/en.json';
import ar from '../src/messages/public-orgs/ar.json';

type Locale = 'en' | 'ar';
const catalogs = { en, ar } as const;

const guest = {
  '/auth/me': { status: 401, body: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Expired' } },
};

const orgCard = {
  id: '64f000000000000000000001',
  slug: 'timimoun-cultural',
  nameFr: 'Association Culturelle',
  nameAr: 'الجمعية الثقافية',
  registryId: 'ORG-000042',
  verificationStatus: 'verified',
};

const orgsPage = {
  items: [orgCard],
  nextCursor: null,
  limit: 6,
  total: 1,
  page: 1,
  pages: 1,
};

const oppCard = {
  _id: '64f0000000000000000000b2',
  slug: 'cultural-heritage-festival',
  title: 'Cultural Heritage Festival Documentation',
  registryId: 'OPP-000123',
  mode: 'onsite',
  endDate: '2026-10-18T00:00:00.000Z',
  durationMinutes: 180,
  organization: {
    id: '64f0000000000000000000d4',
    slug: 'timimoun-cultural',
    nameFr: 'Association Culturelle',
    nameAr: 'الجمعية الثقافية',
    verificationStatus: 'verified',
  },
  isFavorited: false,
  favoriteCount: 4,
};

const oppsPage = {
  items: [oppCard],
  nextCursor: null,
  limit: 9,
  total: 1,
  page: 1,
  pages: 1,
};

const talentsPage = {
  items: [{ username: 'amineb', firstName: 'Amine', bio: 'Photographer', isFavorited: false }],
  nextCursor: null,
  limit: 6,
  total: 1,
  page: 1,
  pages: 1,
};

const profile = {
  slug: 'timimoun-cultural',
  registryId: 'ORG-000042',
  nameFr: 'Association Culturelle',
  nameAr: 'الجمعية الثقافية',
  description: 'Community culture house.',
  website: 'https://example.org',
  foundedYear: 2018,
  verificationStatus: 'verified',
  contact: { email: 'contact@example.org', phone: '+213555123456' },
  focusDisciplines: ['culture'],
  stats: { opportunitiesActive: 4, opportunitiesCompleted: 9, verifiedHours: 1420 },
};

const archivePage = {
  items: [oppCard],
  nextCursor: null,
  limit: 9,
  total: 1,
  page: 1,
  pages: 1,
  counts: { published: 1, completed: 9, closed: 1 },
};

const reliability = { responseRate: 0.8 };

const positionOpen = {
  _id: '64f0000000000000000000a1',
  title: 'Lead Event Photographer',
  requiredCount: 2,
  filledCount: 1,
  applicationCount: 3,
  assigned: [{ volunteerId: 'v1', fullName: 'Amine Benali', username: 'amineb' }],
  skillNames: [{ skillId: 's1', nameFr: 'Photo', nameAr: 'تصوير' }],
};

const detail = {
  _id: '64f0000000000000000000b2',
  slug: 'cultural-heritage-festival',
  title: 'Cultural Heritage Festival Documentation',
  description: 'Document the annual gathering.',
  registryId: 'OPP-000123',
  mode: 'onsite',
  coverMediaId: null,
  endDate: '2026-10-18T00:00:00.000Z',
  applicationDeadline: '2026-10-16T23:59:00.000Z',
  durationMinutes: 180,
  prerequisites: ['Camera'],
  status: 'published',
  positions: [positionOpen],
  organization: {
    id: '64f0000000000000000000d4',
    slug: 'timimoun-cultural',
    nameFr: 'Association Culturelle',
    nameAr: 'الجمعية الثقافية',
    verificationStatus: 'verified',
  },
  isFavorited: false,
  favoriteCount: 4,
};

const relatedPage = {
  items: [{ ...oppCard, _id: '64f0000000000000000000b3', slug: 'oasis-cleanup', title: 'Oasis Cleanup Day' }],
  nextCursor: null,
  limit: 6,
  total: 1,
  page: 1,
  pages: 1,
};

interface Captured {
  path: string;
  method: string;
}

type Handler = { status: number; body?: unknown };
type Handlers = Record<string, Handler>;

async function mockApi(page: Page, handlers: Handlers, captured: Captured[]) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    const key = Object.keys(handlers).find((k) => path.endsWith(k));
    if (!key) return route.fulfill({ status: 404, body: '{}' });
    captured.push({ path, method: route.request().method() });
    const { status, body } = handlers[key] as Handler;
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: body === undefined ? '' : JSON.stringify(body),
    });
  });
}

function landingHandlers(): Handlers {
  return {
    ...guest,
    '/organizations': { status: 200, body: orgsPage },
    '/opportunities': { status: 200, body: oppsPage },
    '/talents': { status: 200, body: talentsPage },
    '/skill-categories': { status: 200, body: { items: [] } },
    '/locations/wilayas': { status: 200, body: { items: [] } },
  };
}

function orgHandlers(): Handlers {
  return {
    ...guest,
    '/organizations/timimoun-cultural/opportunities': { status: 200, body: archivePage },
    '/organizations/timimoun-cultural/reliability': { status: 200, body: reliability },
    '/organizations/timimoun-cultural': { status: 200, body: profile },
  };
}

function detailHandlers(): Handlers {
  return {
    ...guest,
    '/organizations/timimoun-cultural/opportunities': { status: 200, body: relatedPage },
    '/opportunities/cultural-heritage-festival': { status: 200, body: detail },
  };
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
      test(`landing renders feeds, counts, neutral sample card (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, landingHandlers(), captured);
        await page.goto(`/${locale}`);
        await expect(page.getByTestId('public-landing')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          locale === 'ar' ? 'rtl' : 'ltr',
        );
        await expect(
          page.getByTestId('public-landing').getByRole('heading', { level: 1 }),
        ).toHaveText(catalogs[locale].landing.title);
        await expect(page.getByTestId('feed-count')).toHaveText(
          catalogs[locale].landing.feedCount.replace('{total}', '1'),
        );
        await expect(page.getByTestId('opp-card')).toHaveCount(1);
        await expect(page.getByTestId('opp-ref')).toHaveText(
          catalogs[locale].landing.ref.replace('{ref}', 'OPP-000123'),
        );
        await expect(page.getByTestId('sample-record-card')).toBeVisible();
        // Neutral surface: no civic/authority vocabulary anywhere.
        await expect(page.getByTestId('public-landing').getByText(/Accredit|Audit|Supervis/i)).toHaveCount(0);
      });

      test(`org profile renders ribbon, archive tabs, neutral reliability (${locale})`, async ({
        page,
      }) => {
        const captured: Captured[] = [];
        await mockApi(page, orgHandlers(), captured);
        await page.goto(`/${locale}/orgs/timimoun-cultural`);
        await expect(page.getByTestId('public-org-profile')).toBeVisible();
        await expect(page.getByTestId('org-code')).toHaveText(
          catalogs[locale].orgProfile.code.replace('{code}', 'ORG-000042'),
        );
        await expect(page.getByTestId('org-ribbon')).toBeVisible();
        await expect(page.getByTestId('org-reliability')).toBeVisible();
        await expect(page.getByTestId('archive-tabs')).toBeVisible();
        await page.getByTestId('tab-completed').click();
        await expect(page.getByTestId('archive-count')).toHaveText(
          catalogs[locale].orgProfile.archiveCount.replace('{total}', '9'),
        );
        await expect(page.getByTestId('archive-card')).toHaveCount(1);
        await expect(
          page.getByTestId('public-org-profile').getByText(/Accredit|Supervis|Audit/i),
        ).toHaveCount(0);
      });

      test(`opp details render meta, positions, publisher, related (${locale})`, async ({
        page,
      }) => {
        const captured: Captured[] = [];
        await mockApi(page, detailHandlers(), captured);
        await page.goto(`/${locale}/opportunities/cultural-heritage-festival`);
        await expect(page.getByTestId('public-opp-details')).toBeVisible();
        await expect(page.getByTestId('detail-ref')).toHaveText(
          catalogs[locale].oppDetails.code.replace('{code}', 'OPP-000123'),
        );
        await expect(page.getByTestId('detail-meta')).toBeVisible();
        await expect(page.getByTestId('position-card')).toHaveCount(1);
        await expect(page.getByTestId('detail-org')).toBeVisible();
        await expect(page.getByTestId('detail-related')).toBeVisible();
        await expect(
          page.getByTestId('public-opp-details').getByText(/Law 12-06|Dispatch|Statutory/i),
        ).toHaveCount(0);
      });
    }

    test('guest apply on landing redirects to login with next', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, landingHandlers(), captured);
      await page.goto('/en');
      await expect(page.getByTestId('opp-card')).toHaveCount(1);
      await page.getByTestId('apply-cta').first().click();
      await expect(page).toHaveURL(/\/en\/login\?next=/, { timeout: 20000 });
      expect(
        captured.find((c) => c.path.includes('/positions/') && c.method === 'POST'),
      ).toBeUndefined();
    });

    test('guest apply on public details redirects to login with next', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, detailHandlers(), captured);
      await page.goto('/en/opportunities/cultural-heritage-festival');
      await expect(page.getByTestId('public-opp-details')).toBeVisible();
      await page.getByTestId('apply-cta').first().click();
      await expect(page).toHaveURL(/\/en\/login\?next=/, { timeout: 20000 });
      expect(
        captured.find((c) => c.path.includes('/positions/') && c.method === 'POST'),
      ).toBeUndefined();
    });

    test('unknown org slug renders the shared 404 state', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(
        page,
        { ...guest, '/organizations/nope': { status: 404, body: {} } },
        captured,
      );
      await page.goto('/en/orgs/nope');
      await expect(page.getByTestId('public-org-profile')).toBeVisible();
      await expect(page.getByTestId('org-facts')).toHaveCount(0);
    });

    test('non-published opportunity renders the details 404 state', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(
        page,
        { ...guest, '/opportunities/gone': { status: 404, body: {} } },
        captured,
      );
      await page.goto('/en/opportunities/gone');
      await expect(page.getByTestId('public-opp-details')).toBeVisible();
      await expect(page.getByTestId('detail-meta')).toHaveCount(0);
    });
  });
}

test.describe('org profile session states (content-level, no layout switch)', () => {
  test('guest sees no manage control and no sidebar', async ({ page }) => {
    const captured: Captured[] = [];
    await mockApi(page, orgHandlers(), captured);
    await page.goto('/en/orgs/timimoun-cultural');
    await expect(page.getByTestId('public-org-profile')).toBeVisible();
    await expect(page.getByTestId('org-facts')).toBeVisible();
    await expect(page.getByTestId('org-manage')).toHaveCount(0);
    await expect(page.locator('aside')).toHaveCount(0);
    await expect(page.getByTestId('shell-sidebar')).toHaveCount(0);
  });

  test('signed-in non-owner sees no manage control and no sidebar', async ({ page }) => {
    const captured: Captured[] = [];
    await mockApi(
      page,
      {
        ...orgHandlers(),
        '/auth/me': {
          status: 200,
          body: { id: 'o9', email: 'other@example.org', role: 'organization', status: 'active' },
        },
        '/organizations/me': { status: 200, body: { slug: 'other-org' } },
      },
      captured,
    );
    await page.goto('/en/orgs/timimoun-cultural');
    await expect(page.getByTestId('public-org-profile')).toBeVisible();
    await expect(page.getByTestId('org-facts')).toBeVisible();
    await expect(page.getByTestId('org-manage')).toHaveCount(0);
    await expect(page.locator('aside')).toHaveCount(0);
    await expect(page.getByTestId('shell-sidebar')).toHaveCount(0);
  });

  test('owner sees manage control and no sidebar', async ({ page }) => {
    const captured: Captured[] = [];
    await mockApi(
      page,
      {
        ...orgHandlers(),
        '/auth/me': {
          status: 200,
          body: { id: 'o1', email: 'owner@example.org', role: 'organization', status: 'active' },
        },
        '/organizations/me': { status: 200, body: { slug: 'timimoun-cultural' } },
      },
      captured,
    );
    await page.goto('/en/orgs/timimoun-cultural');
    await expect(page.getByTestId('public-org-profile')).toBeVisible();
    await expect(page.getByTestId('org-manage')).toBeVisible();
    await expect(page.getByTestId('org-manage')).toHaveAttribute('href', '/en/org/profile');
    await expect(page.locator('aside')).toHaveCount(0);
    await expect(page.getByTestId('shell-sidebar')).toHaveCount(0);
  });
});
