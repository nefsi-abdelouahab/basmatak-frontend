import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/volunteer-favorites/en.json';

// Task 5 saved-items page: list, in-place unsave, disabled non-public rows,
// and the per-tab empty state. The API is fully mocked, so these tests assert
// the client contract (typed list shape + mutations), not the backend.

const sessionUser = {
  id: '64f000000000000000000001',
  email: 'v@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'volunteer',
  status: 'active',
};

const publishedItem = {
  targetType: 'opportunity',
  targetId: '64f000000000000000000001',
  createdAt: '2026-10-01T00:00:00.000Z',
  summary: {
    title: 'Beach cleanup',
    slug: 'beach-cleanup',
    status: 'published',
    applicationDeadline: '2026-12-31T00:00:00.000Z',
    organization: {
      slug: 'green-algeria',
      nameAr: 'الجزائر الخضراء',
      nameFr: 'Green Algeria',
    },
  },
};

const closedItem = {
  targetType: 'opportunity',
  targetId: '64f000000000000000000002',
  createdAt: '2026-09-01T00:00:00.000Z',
  summary: {
    title: 'Desert cleanup',
    slug: 'desert-cleanup',
    status: 'closed',
    applicationDeadline: null,
    organization: null,
  },
};

const talentItem = {
  targetType: 'talent',
  targetId: '64f0000000000000000000a1',
  createdAt: '2026-10-02T00:00:00.000Z',
  summary: { username: 'amineb', fullName: 'Amine Benali' },
};

const organizationItem = {
  targetType: 'organization',
  targetId: '64f0000000000000000000b1',
  createdAt: '2026-10-03T00:00:00.000Z',
  summary: {
    slug: 'green-algeria',
    nameAr: 'الجزائر الخضراء',
    nameFr: 'Green Algeria',
    status: 'active',
  },
};

interface Captured {
  path: string;
  method: string;
  query: string;
}

type Handler =
  | { status: number; body?: unknown }
  | ((req: { url: URL; method: string }) => { status: number; body?: unknown });

async function mockFavoritesApi(
  page: Page,
  handlers: Record<string, Handler>,
  captured: Captured[],
) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^.*\/api\/v1/, '') || '/';
    const method = route.request().method();
    captured.push({ path, method, query: url.search });
    const key = Object.keys(handlers).find(
      (k) => path === k || (k.endsWith('*') && path.startsWith(k.slice(0, -1))),
    );
    if (!key) return route.fulfill({ status: 404, body: '{}' });
    const handler = handlers[key];
    const { status, body } = typeof handler === 'function' ? handler({ url, method }) : handler;
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: body === undefined ? '' : JSON.stringify(body),
    });
  });
}

function pageOf(items: unknown[], total = items.length) {
  return { items, nextCursor: null, limit: 20, total, page: 1, pages: 1 };
}

function baseHandlers(
  lists: {
    opportunity?: unknown[];
    talent?: unknown[];
    organization?: unknown[];
  } = {},
): Record<string, Handler> {
  const opportunity = lists.opportunity ?? [publishedItem, closedItem];
  const talent = lists.talent ?? [talentItem];
  const organization = lists.organization ?? [organizationItem];
  return {
    '/auth/me': { status: 200, body: sessionUser },
    '/participations/me': { status: 200, body: pageOf([]) },
    '/notifications/unread-count': { status: 200, body: { count: 0 } },
    '/favorites/counts': {
      status: 200,
      body: {
        opportunity: opportunity.length,
        talent: talent.length,
        organization: organization.length,
      },
    },
    '/favorites': ({ url }) => {
      const targetType = url.searchParams.get('targetType');
      if (targetType === 'talent') return { status: 200, body: pageOf(talent) };
      if (targetType === 'organization') return { status: 200, body: pageOf(organization) };
      return { status: 200, body: pageOf(opportunity) };
    },
    '/favorites/opportunities*': ({ method }) => {
      if (method === 'DELETE') {
        // The page refetches after invalidation; dropping the row here proves
        // the in-place unsave actually removes it from the list.
        opportunity.shift();
        return { status: 204 };
      }
      return { status: 201, body: { favorited: true } };
    },
    '/favorites/talents*': () => ({ status: 204 }),
    '/favorites/organizations*': () => ({ status: 204 }),
  };
}

test('lists saved opportunities and unsaves in place', async ({ page }) => {
  const captured: Captured[] = [];
  const opportunity = [publishedItem, closedItem];
  await mockFavoritesApi(page, baseHandlers({ opportunity }), captured);
  await page.goto('/en/volunteer/favorites');

  await expect(page.getByTestId('volunteer-favorites')).toBeVisible();
  await expect(page.getByTestId('favorites-row')).toHaveCount(2);
  await expect(page.getByText('Beach cleanup')).toBeVisible();
  await expect(page.getByText('Desert cleanup')).toBeVisible();
  // Closed opportunities keep their row but lose the detail link.
  await expect(page.getByRole('link', { name: 'Desert cleanup' })).toHaveCount(0);

  await page.getByTestId('favorites-unsave').first().click();
  await expect
    .poll(() => captured.find((c) => c.path.includes('/favorites/opportunities/') && c.method === 'DELETE'))
    .toBeTruthy();
  await expect(page.getByText('Beach cleanup')).toHaveCount(0);
  await expect(page.getByTestId('favorites-row')).toHaveCount(1);
});

test('organization tab shows the empty state and discovery action', async ({ page }) => {
  const captured: Captured[] = [];
  await mockFavoritesApi(page, baseHandlers({ organization: [] }), captured);
  await page.goto('/en/volunteer/favorites');

  await page.getByTestId('favorites-tab-organization').click();
  await expect(page.getByTestId('favorites-empty-organization')).toBeVisible();
  await expect(page.getByText(en.emptyOrganizationsTitle)).toBeVisible();
  const action = page.getByRole('link', { name: en.emptyOrganizationsAction });
  await expect(action).toHaveAttribute('href', '/en/opportunities');
});

test('talent rows render the username, never fullName', async ({ page }) => {
  const captured: Captured[] = [];
  await mockFavoritesApi(page, baseHandlers(), captured);
  await page.goto('/en/volunteer/favorites');

  await page.getByTestId('favorites-tab-talent').click();
  await expect(page.getByTestId('favorites-list-talent')).toBeVisible();
  await expect(page.getByText('@amineb')).toBeVisible();
  await expect(page.getByText('Amine Benali')).toHaveCount(0);
});
