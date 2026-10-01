import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/volunteer-home/en.json';
import ar from '../src/messages/volunteer-home/ar.json';
import commonEn from '../src/messages/common/en.json';
import { expectLoginRedirect } from './login-redirect';

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
  firstName: 'Amine',
  lastName: 'Benali',
  headline: 'Community helper',
  avatar: null,
  location: { wilayaId: '16', municipalityId: '1601' },
  publicProfile: { enabled: true, showAvatar: true },
};

const mySkills = [{ skillId: 's1', level: 4 }];

const dashboard = {
  completionPercent: 62,
  stats: { completedTasks: 12, verifiedExperiences: 6, volunteerHours: 34 },
  latestVerifiedExperience: {
    id: '64f0000000000000000000e1',
    registryId: '3',
    title: 'Cultural Event Photographer',
    description: null,
    skills: ['s1'],
    duration: 240,
    organization: { id: 'o1', slug: 'helping-org', nameFr: 'Helping Org', nameAr: 'منظمة المساعدة' },
    verificationCode: 'V-1',
    verifiedAt: '2026-09-01T00:00:00.000Z',
    publicVisibility: 'public',
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

const talentProfileA = {
  username: 'amineb',
  registryId: 'VOL-000042',
  firstName: 'Amine',
  avatar: null,
  bio: 'Engineer.',
  headline: 'Full-Stack Developer',
  availabilityNote: 'Available on weekends',
  preferredDomains: [],
  geographicBase: null,
  stats: { completedTasks: 3, verifiedExperiences: 6, volunteerHours: 34 },
  areasOfContribution: [],
  location: { wilayaId: '16' },
  skills: [],
  experiences: [],
  availability: {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [{ from: '09:00', to: '12:00' }],
    sunday: [],
  },
  portfolio: {
    items: [
      { id: 'p1', title: 'Ksar Photo Archive', description: null, typeLabel: null, tags: [], media: [] },
      { id: 'p2', title: 'Foggara Web UI', description: null, typeLabel: null, tags: [], media: [] },
    ],
  },
  isFavorited: false,
  favoriteCount: 0,
};

const talentProfileB = {
  username: 'sarab',
  registryId: 'VOL-000043',
  firstName: null,
  avatar: null,
  bio: null,
  headline: null,
  availabilityNote: null,
  preferredDomains: [],
  geographicBase: null,
  stats: null,
  areasOfContribution: null,
  location: null,
  skills: null,
  experiences: null,
  availability: null,
  portfolio: null,
  isFavorited: false,
  favoriteCount: 0,
};

const facets = {
  categories: [{ id: 'c1', nameFr: 'Santé', nameAr: 'الصحة' }],
  skills: [{ id: 's1', nameFr: 'Secourisme', nameAr: 'الإسعافات' }],
  wilayas: [{ id: '16', code: '16', nameFr: 'Alger', nameAr: 'الجزائر' }],
  municipalities: [{ id: '1601', code: '1601', nameFr: 'Alger Centre', nameAr: 'الجزائر الوسطى' }],
};

const notificationA = {
  _id: '64f0000000000000000000n1',
  type: 'application.accepted',
  isRead: false,
  createdAt: '2026-09-10T00:00:00.000Z',
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
    '/volunteers/me/skills': { status: 200, body: mySkills },
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
    '/notifications/unread-count': { status: 200, body: { count: 2 } },
    '/notifications': { status: 200, body: cursorPage([notificationA], 1) },
    '/notifications/64f0000000000000000000n1/read': {
      status: 200,
      body: { ...notificationA, isRead: true },
    },
    '/notifications/read-all': { status: 200, body: { updated: 1 } },
    '/favorites/opportunities*': ({ method }) => {
      if (method === 'POST') return { status: 201, body: { favorited: true, favoriteCount: 5 } };
      return { status: 204 };
    },
    '/favorites/talents*': () => ({ status: 201, body: { favorited: true, favoriteCount: 1 } }),
  };
}

const publicDetail = {
  _id: '64f000000000000000000001',
  slug: 'food-drive',
  title: 'Food drive',
  description: 'Help distribute food to families.',
  registryId: '7',
  mode: 'onsite',
  coverMediaId: null,
  endDate: '2026-10-18T00:00:00.000Z',
  applicationDeadline: '2026-10-16T23:59:00.000Z',
  durationMinutes: 180,
  prerequisites: ['Camera'],
  status: 'published',
  positions: [],
  organization: {
    id: 'o1',
    slug: 'helping-org',
    nameFr: 'Helping Org',
    nameAr: 'منظمة المساعدة',
    verificationStatus: 'verified',
  },
  isFavorited: false,
  favoriteCount: 4,
};

const relatedEmptyPage = {
  items: [],
  nextCursor: null,
  limit: 6,
  total: 0,
  page: 1,
  pages: 1,
};

function detailHandlers(): Record<string, Handler> {
  return {
    ...baseHandlers(),
    '/opportunities/64f000000000000000000001': { status: 200, body: publicDetail },
    '/organizations/helping-org/opportunities': { status: 200, body: relatedEmptyPage },
  };
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
      test(`dashboard renders header, stats, latest, feed, rail (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockHomeApi(page, baseHandlers(), captured);
        await page.goto(`/${locale}/volunteer/dashboard`);
        await expect(page.getByTestId('volunteer-dashboard')).toBeVisible();
        await expect(
          page.getByTestId('volunteer-dashboard').getByRole('heading', { level: 1 }),
        ).toHaveText(catalogs[locale].dashboard.title);
        await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
        // Header card: real name, headline, location, skill chip, view-profile, greeting.
        await expect(page.getByTestId('dashboard-header')).toContainText('Amine Benali');
        await expect(page.getByTestId('dashboard-header')).toContainText('Community helper');
        await expect(page.getByTestId('dashboard-header')).toContainText(
          locale === 'ar' ? 'الجزائر' : 'Alger',
        );
        await expect(page.getByTestId('dashboard-header')).toContainText(
          locale === 'ar' ? 'الإسعافات' : 'Secourisme',
        );
        await expect(page.getByTestId('dashboard-view-profile')).toHaveAttribute(
          'href',
          `/${locale}/volunteer/talents/amineb`,
        );
        await expect(page.getByTestId('dashboard-header')).toContainText(
          catalogs[locale].dashboard.greetingSubtitle,
        );
        // 4-stat row binds the real stats keys (missing number → 0).
        await expect(page.getByTestId('dashboard-stat-completed')).toContainText('12');
        await expect(page.getByTestId('dashboard-stat-verified')).toContainText('6');
        await expect(page.getByTestId('dashboard-stat-hours')).toContainText('34');
        await expect(page.getByTestId('dashboard-stat-skills')).toContainText('1');
        // Latest verified experience + view-all count.
        await expect(page.getByTestId('dashboard-latest')).toBeVisible();
        await expect(page.getByTestId('dashboard-latest')).toContainText('Cultural Event Photographer');
        await expect(page.getByTestId('dashboard-latest')).toContainText(
          catalogs[locale].dashboard.latestVerifiedBadge,
        );
        await expect(page.getByTestId('dashboard-latest-ref')).toContainText('EXP-3');
        await expect(page.getByTestId('dashboard-latest-view-all')).toContainText('6');
        // Feed tabs reuse the opportunity card; rail shows completion + suggestions.
        await expect(page.getByTestId('feed-tab-recommended')).toBeVisible();
        await expect(page.getByTestId('feed-panel-recommended').getByTestId('opportunity-card')).toHaveCount(1);
        // Dashboard opportunity links land on the shared public routes (locale-prefixed).
        await expect(page.getByTestId('feed-view-all')).toHaveAttribute(
          'href',
          `/${locale}/opportunities`,
        );
        await expect(
          page.getByTestId('feed-panel-recommended').getByRole('link', { name: 'Food drive' }),
        ).toHaveAttribute('href', `/${locale}/opportunities/64f000000000000000000001`);
        await expect(page.getByTestId('rail-suggested-item').first()).toHaveAttribute(
          'href',
          `/${locale}/opportunities/64f000000000000000000001`,
        );
        await page.getByTestId('feed-tab-recent').click();
        await expect(page.getByTestId('feed-panel-recent').getByTestId('opportunity-card')).toHaveCount(2);
        await expect(page.getByTestId('dashboard-completion')).toContainText('62');
        await expect(page.getByTestId('rail-suggested')).toBeVisible();
        await expect(page.getByTestId('rail-popular-gap')).toBeVisible();
      });

      test(`opportunities renders banner, embeds, recommended (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockHomeApi(page, baseHandlers(), captured);
        await page.goto(`/${locale}/volunteer/opportunities`);
        await expect(page.getByTestId('volunteer-opportunities')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
        await expect(page.getByTestId('recommended-strip')).toBeVisible();
        await expect(page.getByTestId('feed-count')).toContainText('2');
        await expect(page.getByTestId('opportunity-card')).toHaveCount(2);
        await expect(page.getByTestId('suggested-item')).toHaveCount(1);
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

    test(`shell: navbar bell+avatar, sidebar with Discover, bottomnav (${width})`, async ({
      page,
    }) => {
      const captured: Captured[] = [];
      await mockHomeApi(page, baseHandlers(), captured);
      await page.goto('/en/volunteer/dashboard');
      await expect(page.getByTestId('volunteer-dashboard')).toBeVisible();

      // Navbar: bell wired to the real unread-count endpoint, avatar menu.
      await expect(page.getByTestId('navbar-bell')).toBeVisible();
      await expect(page.getByTestId('navbar-bell-count')).toContainText('2');
      await expect(page.getByTestId('navbar-avatar')).toBeVisible();
      // Navbar: volunteer links removed — Home/Opportunities live in the
      // dashboard, Discover Talents moved to the sidebar.
      await expect(page.getByTestId('navbar-link-home')).toHaveCount(0);
      await expect(page.getByTestId('navbar-link-opportunities')).toHaveCount(0);
      await expect(page.getByTestId('navbar-link-talents')).toHaveCount(0);

      // Sidebar: My Space + Discover + Account groups.
      const sidebar = page.getByTestId('shell-sidebar');
      if (width >= 1024) {
        await expect(sidebar).toBeVisible();
        await expect(sidebar.getByTestId('sidebar-link-dashboard')).toBeVisible();
        await expect(sidebar.getByTestId('sidebar-link-applications')).toBeVisible();
        await expect(sidebar.getByTestId('sidebar-link-opportunities')).toBeVisible();
        await expect(sidebar.getByTestId('sidebar-link-talents')).toBeVisible();
        await expect(sidebar.getByTestId('sidebar-link-settings')).toBeVisible();
      } else {
        await expect(sidebar).toBeHidden();
      }

      // Right rail renders beside the center column on desktop widths.
      if (width >= 1024) {
        await expect(page.getByTestId('dashboard-rail')).toBeVisible();
        await expect(page.getByTestId('rail-suggested')).toBeVisible();
      }

      // Bottom tab bar below lg: icons only, active=dashboard, More folds the rest.
      const bottomnav = page.getByTestId('shell-bottomnav');
      if (width >= 1024) {
        await expect(bottomnav).toBeHidden();
      } else {
        await expect(bottomnav).toBeVisible();
        await expect(bottomnav.getByTestId('bottomnav-tab-dashboard')).toHaveAttribute(
          'aria-current',
          'page',
        );
        await expect(bottomnav.getByTestId('bottomnav-tab-opportunities')).toBeVisible();
        for (const tab of ['dashboard', 'applications', 'opportunities', 'tasks', 'more']) {
          const text = await bottomnav.getByTestId(`bottomnav-tab-${tab}`).textContent();
          expect(text?.trim()).toBe('');
        }
        await bottomnav.getByTestId('bottomnav-tab-more').click();
        await expect(page.getByTestId('bottomnav-more-menu')).toBeVisible();
        await expect(page.getByTestId('bottomnav-tab-experiences')).toBeVisible();
        await expect(page.getByTestId('bottomnav-tab-portfolio')).toBeVisible();
        await expect(page.getByTestId('bottomnav-tab-talents')).toBeVisible();
        await expect(page.getByTestId('bottomnav-tab-settings')).toBeVisible();
      }

      // Bell dropdown lists real notifications with read actions.
      await page.getByTestId('navbar-bell').click();
      await expect(page.getByTestId('navbar-notifications')).toBeVisible();
      await expect(page.getByTestId('navbar-notifications-read-all')).toBeVisible();
      await expect(page.getByTestId('navbar-notifications')).toContainText('application.accepted');
      if (width < 640) {
        const box = await page.getByTestId('navbar-notifications').boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }

      // Avatar menu links to the real public profile, no duplicate bell.
      await page.getByTestId('navbar-bell').click();
      await page.getByTestId('navbar-avatar').click();
      await expect(page.getByTestId('navbar-avatar-menu')).toBeVisible();
        await expect(page.getByTestId('navbar-avatar-menu').getByText(commonEn.nav.viewProfile)).toHaveAttribute(
          'href',
          '/en/volunteer/talents/amineb',
        );
    });

    test(`desktop center column scrolls without moving the rails (${width})`, async ({
      page,
    }) => {
      test.skip(width !== 1440, 'independent center scroll is a desktop behavior');
      const captured: Captured[] = [];
      await mockHomeApi(page, baseHandlers(), captured);
      await page.goto('/en/volunteer/dashboard');
      await expect(page.getByTestId('dashboard-center')).toBeVisible();
      const before = await page.evaluate(() => {
        const sidebar = document.querySelector('[data-testid="shell-sidebar"]') as HTMLElement;
        const rail = document.querySelector('[data-testid="dashboard-rail"]') as HTMLElement;
        const center = document.querySelector('[data-testid="dashboard-center"]') as HTMLElement;
        return {
          sidebarTop: sidebar.getBoundingClientRect().top,
          railTop: rail.getBoundingClientRect().top,
          scrollable: center.scrollHeight > center.clientHeight,
        };
      });
      expect(before.scrollable).toBe(true);
      await page.evaluate(() => {
        const center = document.querySelector('[data-testid="dashboard-center"]') as HTMLElement;
        center.scrollTop = 600;
      });
      const after = await page.evaluate(() => {
        const sidebar = document.querySelector('[data-testid="shell-sidebar"]') as HTMLElement;
        const rail = document.querySelector('[data-testid="dashboard-rail"]') as HTMLElement;
        const center = document.querySelector('[data-testid="dashboard-center"]') as HTMLElement;
        return {
          sidebarTop: sidebar.getBoundingClientRect().top,
          railTop: rail.getBoundingClientRect().top,
          scrollTop: center.scrollTop,
        };
      });
      expect(after.scrollTop).toBeGreaterThan(0);
      expect(after.sidebarTop).toBe(before.sidebarTop);
      expect(after.railTop).toBe(before.railTop);
    });

    test('filter apply serializes to URL and persists across reload', async ({ page }) => {
      const captured: Captured[] = [];
      await mockHomeApi(page, baseHandlers(), captured);
      await page.goto('/en/volunteer/opportunities');
      await page.locator('#opp-q').fill('food');
      await page.locator('#opp-q').press('Enter');
      await expect.poll(() => page.url()).toContain('q=food');
      // Below xl the refine panel lives in the filter drawer — scope the
      // facet assertion to whichever surface is active (drawer or panel).
      const filtersOpen = page.getByTestId('opportunities-filters-open');
      if (await filtersOpen.isVisible()) {
        await filtersOpen.click();
        const drawer = page.getByTestId('opportunities-filters-drawer');
        await expect(drawer).toBeVisible();
        await drawer.getByTestId('filter-category-c1').check();
      } else {
        await page.getByTestId('filter-category-c1').check();
      }
      await expect.poll(() => page.url()).toContain('categoryId=c1');
      await page.locator('#opp-sort').selectOption('newest');
      await expect.poll(() => page.url()).toContain('sort=newest');
      const feedCall = captured.filter((c) => c.path === '/opportunities' && c.method === 'GET').pop();
      expect(feedCall?.query).toContain('q=food');
      await page.reload();
      await expect(page.locator('#opp-q')).toHaveValue('food');
      await expect(page.getByTestId('filter-category-c1')).toBeChecked();
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
      await expect(page.locator('#opp-q')).toHaveValue('');
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
      await expectLoginRedirect(page, 'en', '/volunteer/opportunities');
    });

    test('talents filters serialize multi-value params', async ({ page }) => {
      const captured: Captured[] = [];
      await mockHomeApi(page, baseHandlers(), captured);
      await page.goto('/en/volunteer/talents');
      // Below xl the refine panel lives in the filter drawer — scope the
      // facet assertions to whichever surface is active (drawer or panel).
      const filtersOpen = page.getByTestId('talents-filters-open');
      if (await filtersOpen.isVisible()) {
        await filtersOpen.click();
        const drawer = page.getByTestId('talents-filters-drawer');
        await expect(drawer).toBeVisible();
        await drawer.getByLabel('Secourisme').check();
        await drawer.getByLabel(en.talents.verificationExperienced).check();
        await drawer.getByLabel(en.talents.hasAvailability).check();
      } else {
        await page.getByLabel('Secourisme').check();
        await page.getByLabel(en.talents.verificationExperienced).check();
        await page.getByLabel(en.talents.hasAvailability).check();
      }
      await page.locator('#talent-sort').selectOption('newest');
      await expect.poll(() => page.url()).toContain('skillIds=s1');
      expect(page.url()).toContain('minExperiences=5');
      expect(page.url()).toContain('hasAvailability=true');
      await expect.poll(() => page.url()).toContain('sort=newest');
      const talentsCall = captured.filter((c) => c.path === '/talents' && c.method === 'GET').pop();
      expect(talentsCall?.query).toContain('skillIds=s1');
    });

    test('talent cards render real portfolio preview and availability from the public profile', async ({
      page,
    }) => {
      const captured: Captured[] = [];
      const handlers = baseHandlers();
      handlers['/volunteers/amineb'] = { status: 200, body: talentProfileA };
      handlers['/volunteers/sarab'] = { status: 200, body: talentProfileB };
      await mockHomeApi(page, handlers, captured);
      await page.goto('/en/volunteer/talents');
      await expect(page.getByTestId('talent-card')).toHaveCount(2);
      const first = page.getByTestId('talent-card').first();
      await expect(first.getByText('Full-Stack Developer')).toBeVisible();
      await expect(first.getByText('Available on weekends')).toBeVisible();
      await expect(first.getByText('Public portfolio (2 items)')).toBeVisible();
      await expect(first.getByRole('link', { name: 'Ksar Photo Archive' })).toHaveAttribute(
        'href',
        /\/volunteer\/talents\/amineb#portfolio/,
      );
      const second = page.getByTestId('talent-card').nth(1);
      await expect(second.getByText(/Public portfolio/)).toHaveCount(0);
      await expect(second.getByText('Sara')).toBeVisible();
    });

    test('weekend window fills Fri-Sat bounds (Algeria)', async ({ page }) => {
      const captured: Captured[] = [];
      await mockHomeApi(page, baseHandlers(), captured);
      await page.goto('/en/volunteer/opportunities');
      const filtersOpen = page.getByTestId('opportunities-filters-open');
      if (await filtersOpen.isVisible()) {
        await filtersOpen.click();
        await page.getByTestId('opportunities-filters-drawer').getByTestId('filter-avail-weekend').click();
      } else {
        await page.getByTestId('filter-avail-weekend').click();
      }
      await expect.poll(() => page.url()).toContain('from=');
      const feedCall = captured.filter((c) => c.path === '/opportunities').pop();
      const query = new URLSearchParams(feedCall?.query ?? '');
      const fromDay = new Date(query.get('from') ?? '').getUTCDay();
      const toDay = new Date(query.get('to') ?? '').getUTCDay();
      expect(fromDay).toBe(5);
      expect(toDay).toBe(6);
    });

    test('opportunities columns scroll independently without moving each other', async ({ page }) => {
      test.skip(width !== 1440, 'independent column scroll is a desktop behavior');
      const captured: Captured[] = [];
      await mockHomeApi(page, baseHandlers(), captured);
      await page.goto('/en/volunteer/opportunities');
      await expect(page.getByTestId('opportunities-center')).toBeVisible();
      const contract = await page.evaluate(() => {
        const styleOf = (testId: string) => {
          const el = document.querySelector(`[data-testid="${testId}"]`) as HTMLElement;
          const style = getComputedStyle(el);
          return { overflowY: style.overflowY, top: el.getBoundingClientRect().top };
        };
        return {
          center: styleOf('opportunities-center'),
          filters: styleOf('opportunities-filters'),
          sidebar: styleOf('shell-sidebar'),
          bodyScrolls: document.documentElement.scrollHeight > window.innerHeight + 1,
        };
      });
      expect(['auto', 'scroll']).toContain(contract.center.overflowY);
      expect(['auto', 'scroll']).toContain(contract.filters.overflowY);
      expect(contract.bodyScrolls).toBe(false);
      await page.evaluate(() => {
        const center = document.querySelector('[data-testid="opportunities-center"]') as HTMLElement;
        center.scrollTop = 400;
      });
      await page.evaluate(() => {
        const filters = document.querySelector('[data-testid="opportunities-filters"]') as HTMLElement;
        filters.scrollTop = 400;
      });
      const after = await page.evaluate(() => {
        const topOf = (testId: string) =>
          (document.querySelector(`[data-testid="${testId}"]`) as HTMLElement).getBoundingClientRect().top;
        const center = document.querySelector('[data-testid="opportunities-center"]') as HTMLElement;
        const filters = document.querySelector('[data-testid="opportunities-filters"]') as HTMLElement;
        return {
          sidebarTop: topOf('shell-sidebar'),
          filtersTop: topOf('opportunities-filters'),
          centerTop: topOf('opportunities-center'),
          centerScroll: center.scrollTop,
          filtersScroll: filters.scrollTop,
        };
      });
      expect(after.sidebarTop).toBe(contract.sidebar.top);
      expect(after.filtersTop).toBe(contract.filters.top);
      expect(after.centerTop).toBe(contract.center.top);
    });
  });
}

test.describe('viewport 768 (tablet bottom tab bar)', () => {
  test.use({ viewport: { width: 768, height: 800 } });

  test('sidebar hidden, bottomnav tab bar visible with More menu', async ({ page }) => {
    const captured: Captured[] = [];
    await mockHomeApi(page, baseHandlers(), captured);
    await page.goto('/en/volunteer/dashboard');
    await expect(page.getByTestId('volunteer-dashboard')).toBeVisible();
    await expect(page.getByTestId('shell-sidebar')).toBeHidden();
    const bottomnav = page.getByTestId('shell-bottomnav');
    await expect(bottomnav).toBeVisible();
    await expect(bottomnav.getByTestId('bottomnav-tab-dashboard')).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(bottomnav.getByTestId('bottomnav-tab-tasks')).toBeVisible();
    for (const tab of ['dashboard', 'tasks', 'more']) {
      const text = await bottomnav.getByTestId(`bottomnav-tab-${tab}`).textContent();
      expect(text?.trim()).toBe('');
    }
    await bottomnav.getByTestId('bottomnav-tab-more').click();
    await expect(page.getByTestId('bottomnav-more-menu')).toBeVisible();
    // md+ navbar links render at 768; bell+avatar stay in all widths.
    await expect(page.getByTestId('navbar-bell')).toBeVisible();
    await expect(page.getByTestId('navbar-avatar')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('viewport 390 RTL mobile notifications', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('ar notifications panel fits the viewport without overflow', async ({ page }) => {
    const captured: Captured[] = [];
    await mockHomeApi(page, baseHandlers(), captured);
    await page.goto('/ar/volunteer/dashboard');
    await expect(page.getByTestId('volunteer-dashboard')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.getByTestId('navbar-bell').click();
    const panel = page.getByTestId('navbar-notifications');
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('public details navigation (EN+AR)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
    test(`dashboard card → public details → Back returns (${locale})`, async ({ page }) => {
      const captured: Captured[] = [];
      await mockHomeApi(page, detailHandlers(), captured);
      await page.goto(`/${locale}/volunteer/dashboard`);
      await expect(page.getByTestId('volunteer-dashboard')).toBeVisible();
      await page
        .getByTestId('feed-panel-recommended')
        .getByRole('link', { name: 'Food drive' })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/opportunities/64f000000000000000000001`));
      await expect(page.getByTestId('public-opp-details')).toBeVisible();
      await expect(page.getByTestId('detail-header')).toContainText('Food drive');
      await page.getByTestId('opp-back').click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/volunteer/dashboard`));
      await expect(page.getByTestId('volunteer-dashboard')).toBeVisible();
    });

    test(`direct public details entry → Back falls back to listing (${locale})`, async ({
      page,
    }) => {
      const captured: Captured[] = [];
      await page.addInitScript(() => {
        Object.defineProperty(window.History.prototype, 'length', {
          get: () => 1,
          configurable: true,
        });
      });
      await mockHomeApi(page, detailHandlers(), captured);
      await page.goto(`/${locale}/opportunities/64f000000000000000000001`);
      await expect(page.getByTestId('public-opp-details')).toBeVisible();
      await page.getByTestId('opp-back').click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/opportunities/?$`));
    });
  }
});
