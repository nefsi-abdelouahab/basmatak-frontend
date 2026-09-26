import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/volunteer-home/en.json';
import ar from '../src/messages/volunteer-home/ar.json';

type Locale = 'en' | 'ar';
const catalogs = { en, ar } as const;

const sessionUser = {
  id: '64f000000000000000000001',
  email: 'v@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'volunteer',
  status: 'active',
};

const me = {
  username: 'amineb',
  location: { wilayaId: '16', municipalityId: '1601' },
  publicProfile: { enabled: true },
};

const dashboard = {
  completionPercent: 62,
  stats: { experiences: 4, hours: 12 },
  latestVerifiedExperience: {
    registryId: '3',
    verificationCode: 'V-1',
    verifiedAt: '2026-09-01T00:00:00.000Z',
    organizationName: 'Helping Org',
  },
};

const oppA = {
  id: '64f000000000000000000001',
  title: 'Food drive',
  registryId: '7',
  mode: 'onsite',
  durationMinutes: 180,
  organization: { id: 'o1', slug: 'helping-org', nameFr: 'Helping Org', nameAr: 'منظمة المساعدة', verificationStatus: 'verified' },
  isFavorited: false,
  favoriteCount: 4,
};

const oppB = {
  id: '64f000000000000000000002',
  title: 'Beach cleanup',
  registryId: '8',
  mode: 'onsite',
  durationMinutes: 90,
  organization: { id: 'o2', slug: 'green-org', nameFr: 'Green Org', nameAr: 'منظمة خضراء', verificationStatus: 'pending' },
  isFavorited: true,
  favoriteCount: 1,
};

const talentA = {
  username: 'amineb',
  firstName: 'Amine',
  lastName: 'Benali',
  headline: 'Community helper',
  experienceCount: 3,
  portfolioCount: 2,
  hasAvailability: true,
  isFavorited: false,
};

const talentB = {
  username: 'sarab',
  firstName: 'Sara',
  lastName: null,
  headline: null,
  experienceCount: 1,
  portfolioCount: 0,
  hasAvailability: false,
  isFavorited: false,
};

const facets = {
  categories: [{ id: 'c1', nameFr: 'Santé', nameAr: 'الصحة' }],
  skills: [{ id: 's1', nameFr: 'Secourisme', nameAr: 'الإسعافات' }],
  wilayas: [{ code: '16', nameFr: 'Alger', nameAr: 'الجزائر' }],
  municipalities: [{ code: '1601', nameFr: 'Alger Centre', nameAr: 'الجزائر الوسطى' }],
};

function cursorPage(items: unknown[], total: number, page = 1, pages = 1, nextCursor: string | null = null) {
  return { items, nextCursor, limit: 20, total, page, pages };
}

interface Captured {
  path: string;
  method: string;
  query: string;
  body: unknown;
}

type Handler = { status: number; body?: unknown } | ((req: { url: URL; method: string }, body: unknown) => { status: number; body?: unknown });

async function mockHomeApi(page: Page, handlers: Record<string, Handler>, captured: Captured[]) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^.*\/api\/v1/, '') || '/';
    const method = route.request().method();
    let rawBody: unknown;
    try {
      rawBody = route.request().postDataJSON();
    } catch {
      rawBody = undefined;
    }
    captured.push({ path, method, query: url.search, body: rawBody });
    const key = Object.keys(handlers).find(
      (k) => path === k || (k.endsWith('*') && path.startsWith(k.slice(0, -1))),
    );
    if (!key) return route.fulfill({ status: 404, body: '{}' });
    const handler = handlers[key];
    const { status, body } = typeof handler === 'function' ? handler({ url, method }, rawBody) : handler;
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: body === undefined ? '' : JSON.stringify(body),
    });
  });
}

function baseHandlers(): Record<string, Handler> {
  return {
    '/auth/me': { status: 200, body: sessionUser },
    '/volunteers/me': { status: 200, body: me },
    '/volunteers/me/dashboard': { status: 200, body: dashboard },
    '/opportunities/recommended': { status: 200, body: cursorPage([oppA], 1) },
    '/opportunities': { status: 200, body: cursorPage([oppA, oppB], 2) },
    '/talents': { status: 200, body: cursorPage([talentA, talentB], 2) },
    '/skill-categories': { status: 200, body: facets.categories },
    '/skills': { status: 200, body: facets.skills },
    '/locations/wilayas': { status: 200, body: facets.wilayas },
    '/locations/wilayas/16/municipalities': { status: 200, body: facets.municipalities },
          '/favorites/lookup': ({ url }) => {
      const targetType = url.searchParams.get('targetType');
      const ids = (url.searchParams.get('targetIds') ?? '').split(',').filter(Boolean);
      const body: Record<string, { favorited: boolean; favoriteCount: number }> = {};
      for (const id of ids) {
        if (targetType === 'opportunity' && id === oppB.id) body[id] = { favorited: true, favoriteCount: 1 };
        else body[id] = { favorited: false, favoriteCount: id === oppA.id ? 4 : 0 };
      }
      return { status: 200, body };
    },
    '/favorites/counts': { status: 200, body: { opportunities: 1, talents: 0 } },
    '/favorites/opportunities*': ({ method }) => {
      if (method === 'POST') return { status: 201, body: { favorited: true, favoriteCount: 5 } };
      return { status: 204 };
    },
    '/favorites/talents*': () => ({ status: 201, body: { favorited: true, favoriteCount: 1 } }),
  };
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
      test(`dashboard renders stats, completion, latest (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockHomeApi(page, baseHandlers(), captured);
        await page.goto(`/${locale}/volunteer/dashboard`);
        await expect(page.getByTestId('volunteer-dashboard')).toBeVisible();
        await expect(
          page.getByTestId('volunteer-dashboard').getByRole('heading', { level: 1 }),
        ).toHaveText(catalogs[locale].dashboard.title);
        await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
        await expect(page.getByTestId('dashboard-completion')).toContainText('62');
        await expect(page.getByTestId('dashboard-stat-experiences')).toContainText('4');
        await expect(page.getByTestId('dashboard-latest')).toBeVisible();
        await expect(page.getByTestId('dashboard-latest-ref')).toContainText('EXP-3');
      });

      test(`opportunities renders banner, embeds, recommended (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockHomeApi(page, baseHandlers(), captured);
        await page.goto(`/${locale}/volunteer/opportunities`);
        await expect(page.getByTestId('volunteer-opportunities')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
        await expect(page.getByTestId('recommended-strip')).toBeVisible();
        await expect(page.getByTestId('feed-count')).toContainText('2');
        await expect(page.getByTestId('opportunity-card')).toHaveCount(3);
        await expect(page.getByTestId('opportunity-org').first()).toContainText(
          locale === 'ar' ? 'منظمة المساعدة' : 'Helping Org',
        );
        await expect(page.getByTestId('opportunity-ref').first()).toContainText('OPP-7');
        await expect(page.getByTestId('opportunity-hours').first()).toContainText('3');
      });

      test(`talents renders banner and cards (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockHomeApi(page, baseHandlers(), captured);
        await page.goto(`/${locale}/volunteer/talents`);
        await expect(page.getByTestId('volunteer-talents')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
        await expect(page.getByTestId('talents-count')).toContainText('2');
        await expect(page.getByTestId('talent-card')).toHaveCount(2);
      });
    }

    test('filter apply serializes to URL and persists across reload', async ({ page }) => {
      const captured: Captured[] = [];
      await mockHomeApi(page, baseHandlers(), captured);
      await page.goto('/en/volunteer/opportunities');
      await page.getByLabel(en.opportunities.searchLabel).fill('food');
      await page.locator('#opp-category').selectOption('c1');
      await page.locator('#opp-sort').selectOption('newest');
      await page.getByTestId('opportunities-filters').getByRole('button', { name: en.opportunities.applyFilters }).click();
      await expect.poll(() => page.url()).toContain('q=food');
      expect(page.url()).toContain('categoryId=c1');
      expect(page.url()).toContain('sort=newest');
      const feedCall = captured.filter((c) => c.path === '/opportunities' && c.method === 'GET').pop();
      expect(feedCall?.query).toContain('q=food');
      await page.reload();
      await expect(page.getByLabel(en.opportunities.searchLabel)).toHaveValue('food');
      await expect(page.getByTestId('feed-count')).toContainText('2');
    });

    test('pagination sends cursor and pages back', async ({ page }) => {
      const captured: Captured[] = [];
      await mockHomeApi(
        page,
        {
          ...baseHandlers(),
          '/opportunities': ({ url }) => {
            const cursor = url.searchParams.get('cursor');
            if (!cursor) return { status: 200, body: cursorPage([oppA, oppB], 45, 1, 3, 'CURSOR-2') };
            return { status: 200, body: cursorPage([oppB], 45, 2, 3, null) };
          },
        },
        captured,
      );
      await page.goto('/en/volunteer/opportunities');
      await expect(page.getByTestId('feed-count')).toContainText('45');
      await page.getByRole('button', { name: en.shared.next }).click();
      await expect.poll(() => captured.filter((c) => c.path === '/opportunities').length).toBeGreaterThan(1);
      const second = captured.filter((c) => c.path === '/opportunities').pop();
      expect(second?.query).toContain('cursor=CURSOR-2');
      await page.getByRole('button', { name: en.shared.previous }).click();
      await expect(page.getByTestId('opportunity-card').first()).toBeVisible();
    });

    test('empty feed shows clear-filters action', async ({ page }) => {
      const captured: Captured[] = [];
      await mockHomeApi(page, { ...baseHandlers(), '/opportunities': { status: 200, body: cursorPage([], 0, 1, 0) } }, captured);
      await page.goto('/en/volunteer/opportunities');
      await expect(page.getByTestId('feed-count')).toContainText('0');
      await expect(page.getByText(en.opportunities.emptyTitle)).toBeVisible();
      await page.getByRole('button', { name: en.shared.clearFilters }).click();
      await expect(page.getByLabel(en.opportunities.searchLabel)).toHaveValue('');
    });

    test('opportunity favorite toggle persists via POST then lookup', async ({ page }) => {
      const captured: Captured[] = [];
      let saved = false;
      await mockHomeApi(
        page,
        {
          ...baseHandlers(),
    '/favorites/lookup': ({ url }) => {
            const ids = (url.searchParams.get('targetIds') ?? '').split(',').filter(Boolean);
            const body: Record<string, { favorited: boolean; favoriteCount: number }> = {};
            for (const id of ids) body[id] = { favorited: saved && id === oppA.id, favoriteCount: 4 };
            return { status: 200, body };
          },
          '/favorites/opportunities*': () => {
            saved = true;
            return { status: 201, body: { favorited: true, favoriteCount: 5 } };
          },
        },
        captured,
      );
      await page.goto('/en/volunteer/opportunities');
      const saveButton = page.getByTestId(`save-opp-${oppA.id}`);
      await expect(saveButton).toHaveAttribute('aria-pressed', 'false');
      await saveButton.click();
      await expect.poll(() => captured.find((c) => c.path.includes('/favorites/opportunities/') && c.method === 'POST')).toBeTruthy();
      await page.reload();
      await expect(page.getByTestId(`save-opp-${oppA.id}`)).toHaveAttribute('aria-pressed', 'true');
    });

    test('guest Save redirects to login with next', async ({ page }) => {
      const captured: Captured[] = [];
      await mockHomeApi(page, { ...baseHandlers(), '/auth/me': { status: 401, body: { statusCode: 401, code: 'UNAUTHORIZED', message: 'expired' } } }, captured);
      await page.goto('/en/volunteer/opportunities');
      await expect(page.getByTestId('volunteer-opportunities')).toBeVisible();
      await page.getByTestId(`save-opp-${oppA.id}`).click();
      await expect.poll(() => page.url()).toContain('/en/login');
      expect(page.url()).toContain('next=');
    });

    test('talents filters serialize multi-value params', async ({ page }) => {
      const captured: Captured[] = [];
      await mockHomeApi(page, baseHandlers(), captured);
      await page.goto('/en/volunteer/talents');
      await page.locator('#talent-skill').selectOption('s1');
      await page.locator('#talent-min-exp').fill('2');
      await page.getByLabel(en.talents.hasAvailability).check();
      await page.locator('#talent-sort').selectOption('experiences_desc');
      await page.getByTestId('talents-filters').getByRole('button', { name: en.talents.applyFilters }).click();
      await expect.poll(() => page.url()).toContain('skillIds=s1');
      expect(page.url()).toContain('minExperiences=2');
      expect(page.url()).toContain('hasAvailability=true');
      expect(page.url()).toContain('sort=experiences_desc');
      const talentsCall = captured.filter((c) => c.path === '/talents' && c.method === 'GET').pop();
      expect(talentsCall?.query).toContain('skillIds=s1');
    });

    test('weekend window fills Fri-Sat bounds (Algeria)', async ({ page }) => {
      const captured: Captured[] = [];
      await mockHomeApi(page, baseHandlers(), captured);
      await page.goto('/en/volunteer/opportunities');
      await page.getByLabel(en.opportunities.windowWeekend).check();
      await page.getByTestId('opportunities-filters').getByRole('button', { name: en.opportunities.applyFilters }).click();
      await expect.poll(() => page.url()).toContain('from=');
      const feedCall = captured.filter((c) => c.path === '/opportunities').pop();
      const query = new URLSearchParams(feedCall?.query ?? '');
      const fromDay = new Date(query.get('from') ?? '').getUTCDay();
      const toDay = new Date(query.get('to') ?? '').getUTCDay();
      expect(fromDay).toBe(5);
      expect(toDay).toBe(6);
    });
  });
}
