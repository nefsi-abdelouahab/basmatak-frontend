import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/org-opportunities/en.json';
import ar from '../src/messages/org-opportunities/ar.json';

type Locale = 'en' | 'ar';
const catalogs = { en, ar } as const;

const orgUser = {
  id: '64f000000000000000000001',
  email: 'org@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'organization',
  status: 'active',
};

const draftOpp = {
  _id: '64f0000000000000000000c1',
  title: 'Cleanup day',
  description: 'Help clean the park',
  categoryId: '64f0000000000000000000c0',
  status: 'draft',
  registryId: '000123',
  mode: 'onsite',
  durationMinutes: 120,
  prerequisites: ['Gloves'],
  startDate: '2026-10-01T00:00:00.000Z',
  endDate: '2026-10-05T00:00:00.000Z',
  applicationDeadline: '2026-09-28T00:00:00.000Z',
  location: { wilayaId: '16', municipalityId: '1601' },
  coverMediaId: null,
  positions: [
    { _id: '64f0000000000000000000d1', title: 'Helper', requiredCount: 3, filledCount: 0, deliverables: ['Collect bags'] },
  ],
  applicationCount: 2,
  participantCount: 1,
};

const publishedOpp = {
  _id: '64f0000000000000000000c2',
  title: 'Food drive',
  description: 'Distribute meals',
  categoryId: '64f0000000000000000000c0',
  status: 'published',
  registryId: '000124',
  mode: 'hybrid',
  durationMinutes: 90,
  prerequisites: [],
  startDate: '2026-11-01T00:00:00.000Z',
  endDate: '2026-11-03T00:00:00.000Z',
  applicationDeadline: '2026-10-28T00:00:00.000Z',
  location: { wilayaId: '31', municipalityId: '3101' },
  coverMediaId: null,
  positions: [
    { _id: '64f0000000000000000000d2', title: 'Driver', requiredCount: 2, filledCount: 1, deliverables: [] },
  ],
  applicationCount: 5,
  participantCount: 3,
};

const categories = [{ _id: '64f0000000000000000000c0', nameFr: 'Santé', nameAr: 'الصحة' }];

const wilayas = [{ code: '16', nameFr: 'Alger', nameAr: 'الجزائر' }];

const municipalities = [{ code: '1601', nameFr: 'Alger Centre', nameAr: 'الجزائر الوسطى' }];

interface Captured {
  url: string;
  method: string;
}

const pageEnvelope = (items: unknown[]) => ({
  items,
  nextCursor: null,
  limit: 20,
  total: items.length,
  page: 1,
  pages: 1,
});

async function mockApi(
  page: Page,
  captured: Captured[],
  overrides?: {
    authMeStatus?: number;
    verificationStatus?: string;
    gateLocked?: boolean;
    publishStatus?: number;
    listStatus?: number;
  },
) {
  const store = new Map<string, Record<string, unknown>>();
  store.set(draftOpp._id, { ...draftOpp });
  store.set(publishedOpp._id, { ...publishedOpp });
  const deleted = new Set<string>();

  await page.route('https://cdn.example/**', async (route: Route) => {
    captured.push({ url: route.request().url(), method: route.request().method() });
    if (route.request().method() === 'PUT') return route.fulfill({ status: 200, body: '' });
    return route.fulfill({ status: 404, body: '' });
  });

  await page.route('**/api/v1/**', async (route: Route) => {
    const url = route.request().url();
    const parsed = new URL(url);
    const path = parsed.pathname;
    captured.push({ url, method: route.request().method() });

    if (path.endsWith('/auth/me')) {
      if (overrides?.authMeStatus && overrides.authMeStatus !== 200) {
        return route.fulfill({ status: overrides.authMeStatus, body: '{}' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(orgUser) });
    }
    if (path.endsWith('/organizations/me/publish-gate')) {
      const locked = overrides?.gateLocked ?? false;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          locked,
          pendingCount: locked ? 3 : 0,
          threshold: 3,
          pendingOpportunities: [],
        }),
      });
    }
    if (path.endsWith('/organizations/me') && route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          verificationStatus: overrides?.verificationStatus ?? 'verified',
          status: 'active',
        }),
      });
    }
    if (path === '/api/v1/organizations/me/opportunities' && route.request().method() === 'GET') {
      if (overrides?.listStatus && overrides.listStatus !== 200) {
        return route.fulfill({ status: overrides.listStatus, body: '{}' });
      }
      let rows = [...store.values()].filter((r) => !deleted.has(r._id as string));
      const q = parsed.searchParams.get('q');
      const sort = parsed.searchParams.get('sort');
      if (q) rows = rows.filter((r) => String(r.title).toLowerCase().includes(q.toLowerCase()));
      if (sort === 'oldest') rows = [...rows].reverse();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pageEnvelope(rows)),
      });
    }
    if (path === '/api/v1/organizations/me/opportunities' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const created = {
        _id: '64f0000000000000000000c9',
        status: 'draft',
        registryId: '000129',
        positions: [],
        applicationCount: 0,
        participantCount: 0,
        ...body,
      };
      store.set(created._id as string, created);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) });
    }
    const ownDetail = path.match(/\/organizations\/me\/opportunities\/([a-f0-9]{24})$/);
    if (ownDetail && route.request().method() === 'GET') {
      const row = store.get(ownDetail[1]);
      if (!row || deleted.has(ownDetail[1])) return route.fulfill({ status: 404, body: '{}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row) });
    }
    const duplicate = path.match(/\/organizations\/me\/opportunities\/([a-f0-9]{24})\/duplicate$/);
    if (duplicate && route.request().method() === 'POST') {
      const source = store.get(duplicate[1]);
      if (!source) return route.fulfill({ status: 404, body: '{}' });
      const copy = {
        ...(source as object),
        _id: '64f0000000000000000000d9',
        status: 'draft',
        registryId: '000130',
      };
      store.set(copy._id as string, copy as Record<string, unknown>);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(copy) });
    }
    const oppPatch = path.match(/\/opportunities\/([a-f0-9]{24})$/);
    if (oppPatch && route.request().method() === 'PATCH') {
      const row = store.get(oppPatch[1]);
      if (!row) return route.fulfill({ status: 404, body: '{}' });
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const next = { ...row, ...body };
      store.set(oppPatch[1], next);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(next) });
    }
    if (oppPatch && route.request().method() === 'DELETE') {
      deleted.add(oppPatch[1]);
      return route.fulfill({ status: 204, body: '' });
    }
    const lifecycle = path.match(/\/opportunities\/([a-f0-9]{24})\/(publish|close|cancel|complete)$/);
    if (lifecycle && route.request().method() === 'POST') {
      if (overrides?.publishStatus && overrides.publishStatus !== 200) {
        const code =
          overrides.publishStatus === 409
            ? 'PUBLISH_GATE_LOCKED'
            : overrides.publishStatus === 403
              ? 'PUBLISHING_DISABLED'
              : 'UNKNOWN_ERROR';
        return route.fulfill({
          status: overrides.publishStatus,
          contentType: 'application/json',
          body: JSON.stringify({ statusCode: overrides.publishStatus, code, message: code }),
        });
      }
      const row = store.get(lifecycle[1]);
      if (!row) return route.fulfill({ status: 404, body: '{}' });
      const toStatus =
        lifecycle[2] === 'publish'
          ? 'published'
          : lifecycle[2] === 'close'
            ? 'closed'
            : lifecycle[2] === 'cancel'
              ? 'cancelled'
              : 'completed';
      const next = { ...row, status: toStatus };
      store.set(lifecycle[1], next);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(next) });
    }
    const posCreate = path.match(/\/opportunities\/([a-f0-9]{24})\/positions$/);
    if (posCreate && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const position = { _id: '64f0000000000000000000e1', filledCount: 0, ...body };
      const row = store.get(posCreate[1]);
      if (row) {
        const next = { ...row, positions: [...((row.positions as unknown[]) ?? []), position] };
        store.set(posCreate[1], next);
      }
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(position) });
    }
    const posPatch = path.match(/\/opportunities\/([a-f0-9]{24})\/positions\/([a-f0-9]{24})$/);
    if (posPatch && route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ _id: posPatch[2], ...body }),
      });
    }
    if (posPatch && route.request().method() === 'DELETE') {
      const row = store.get(posPatch[1]);
      if (row) {
        const next = {
          ...row,
          positions: ((row.positions as { _id: string }[]) ?? []).filter((p) => p._id !== posPatch[2]),
        };
        store.set(posPatch[1], next);
      }
      return route.fulfill({ status: 204, body: '' });
    }
    if (path.endsWith('/skill-categories')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(categories),
      });
    }
    if (path.endsWith('/locations/wilayas')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wilayas),
      });
    }
    if (/\/locations\/wilayas\/[^/]+\/municipalities$/.test(path)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(municipalities),
      });
    }
    if (path.endsWith('/media/uploads')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mediaId: '64f0000000000000000000f1', uploadUrl: 'https://cdn.example/up' }),
      });
    }
    if (/\/media\/[a-f0-9]{24}\/confirm$/.test(path)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });
    // The create-publish flow is the longest in this file (12 fields +
    // cover 2-step upload + position + create + navigate + publish); loaded
    // shared dev servers need a ceiling above the 30s default.
    test.setTimeout(120000);

    for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
      test(`list renders rows, refs, counts, RTL (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/org/opportunities`);
        await expect(page.getByTestId('org-opportunities')).toBeVisible();
        await expect(
          page.getByTestId('org-opportunities').getByRole('heading', { level: 1 }),
        ).toHaveText(catalogs[locale].list.title);
        await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
        await expect(page.getByTestId('opportunity-row')).toHaveCount(2);
        await expect(page.getByTestId('org-opportunities-count')).toContainText('2');
        await expect(page.getByText('OPP-000123')).toBeVisible();
        await expect(page.getByTestId('create-opportunity-link')).toBeVisible();
      });

      test(`search + sort hit the real query params (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/org/opportunities`);
        await page.locator('#opp-search').fill('food');
        await page.getByTestId('opp-search-apply').click();
        await expect(page.getByTestId('opportunity-row')).toHaveCount(1);
        const listCalls = captured.filter((c) => c.url.includes('/organizations/me/opportunities?') || c.url.includes('/organizations/me/opportunities%3F') || /\/organizations\/me\/opportunities\?/.test(c.url));
        expect(listCalls.length).toBeGreaterThan(0);
        await page.locator('#opp-sort').selectOption('oldest');
        const sortCalls = captured.filter((c) => c.url.includes('sort=oldest'));
        expect(sortCalls.length).toBeGreaterThan(0);
      });

      test(`duplicate creates an independent draft (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/org/opportunities`);
        await page.getByTestId(`duplicate-opp-${draftOpp._id}`).click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/org/opportunities/64f0000000000000000000d9`));
        await expect(page.getByTestId('opp-editor')).toBeVisible();
        expect(
          captured.some((c) => c.url.endsWith(`/organizations/me/opportunities/${draftOpp._id}/duplicate`)),
        ).toBe(true);
      });

      test(`delete-draft confirms then removes the row (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/org/opportunities`);
        await page.getByTestId(`delete-opp-${draftOpp._id}`).click();
        await page.getByTestId(`delete-opp-confirm-${draftOpp._id}`).click();
        await expect(page.getByTestId('opp-notice')).toContainText(catalogs[locale].list.deleted);
        await expect(page.getByTestId('opportunity-row')).toHaveCount(1);
        expect(
          captured.some((c) => c.url.endsWith(`/opportunities/${draftOpp._id}`) && c.method === 'DELETE'),
        ).toBe(true);
      });

      test(`create with all v2 fields then publish (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/org/opportunities/new`);
        await expect(page.getByTestId('opp-editor')).toBeVisible();
        await page.locator('#opp-title').fill('Ramadan food distribution');
        await page.locator('#opp-description').fill('Help distribute meal boxes in Algiers');
        await page.locator('#opp-category').selectOption('64f0000000000000000000c0');
        await page.locator('#opp-mode').selectOption('hybrid');
        await page.locator('#opp-start').fill('2026-10-01');
        await page.locator('#opp-end').fill('2026-10-05');
        await page.locator('#opp-duration').fill('120');
        await page.locator('#opp-prerequisites').fill('Bike\nGloves');
        await page.locator('#opp-deadline').fill('2026-09-28');
        await page.locator('#opp-wilaya').selectOption('16');
        await expect(page.locator('#opp-municipality option').nth(1)).toBeAttached();
        await page.locator('#opp-municipality').selectOption('1601');
        await page.locator('#opp-cover').setInputFiles({
          name: 'cover.png',
          mimeType: 'image/png',
          buffer: Buffer.from('fake-png-bytes'),
        });
        await expect(page.getByTestId('cover-success')).toBeVisible();
        await page.getByTestId('position-add').click();
        await page.locator('#position-title').fill('Distributor');
        await page.locator('#position-seats').fill('3');
        await page.getByTestId('position-save').click();
        await expect(page.getByTestId('position-row')).toHaveCount(1);
        await page.getByTestId('editor-submit').click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/org/opportunities/64f0000000000000000000c9`), {
          timeout: 20000,
        });
        const createCall = captured.find(
          (c) => c.url.endsWith('/organizations/me/opportunities') && c.method === 'POST',
        );
        expect(createCall).toBeTruthy();
        await expect(page.getByTestId('lifecycle-publish')).toBeVisible();
        await page.getByTestId('lifecycle-publish').click();
        await page.getByTestId('lifecycle-confirm-confirm').click();
        await expect(page.getByTestId('lifecycle-success')).toContainText(
          catalogs[locale].editor.published,
          { timeout: 20000 },
        );
      });

      test(`pending org sees publish locked (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured, { verificationStatus: 'pending', gateLocked: true });
        await page.goto(`/${locale}/org/opportunities/${draftOpp._id}`);
        await expect(page.getByTestId('opp-editor')).toBeVisible();
        await expect(page.getByTestId('lifecycle-publish')).toHaveCount(0);
        await expect(page.getByTestId('publish-locked-unverified')).toBeVisible();
      });

      test(`published opp offers close and locks mode fields (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/org/opportunities/${publishedOpp._id}`);
        await expect(page.getByTestId('opp-editor')).toBeVisible();
        await expect(page.getByTestId('lifecycle-close')).toBeVisible();
        await expect(page.locator('#opp-mode')).toBeDisabled();
        await expect(page.getByTestId('locked-hint-mode')).toBeVisible();
        await page.getByTestId('position-add').click();
        await page.locator('#position-title').fill('Extra hands');
        await page.locator('#position-seats').fill('2');
        await page.getByTestId('position-save').click();
        await expect(page.getByTestId('position-row')).toHaveCount(2);
        await page.getByTestId('lifecycle-close').click();
        await page.getByTestId('lifecycle-confirm-confirm').click();
        await expect(page.getByTestId('lifecycle-success')).toContainText(
          catalogs[locale].editor.closed,
        );
      });

      test(`empty and error states render (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured);
        await page.goto(`/${locale}/org/opportunities`);
        await page.locator('#opp-search').fill('zzz-no-match');
        await page.getByTestId('opp-search-apply').click();
        await expect(page.getByText(catalogs[locale].list.empty)).toBeVisible();
        await page.goto(`/${locale}/org/opportunities/${draftOpp._id}`);
        await expect(page.getByTestId('opp-editor')).toBeVisible();
      });

      test(`list error state renders (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, captured, { listStatus: 500 });
        await page.goto(`/${locale}/org/opportunities`);
        await expect(page.getByTestId('org-opportunities-error')).toBeVisible();
      });
    }

    test('no PDF, perks, or applications affordances (en)', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, captured);
      await page.goto('/en/org/opportunities');
      await expect(page.getByTestId('org-opportunities')).toBeVisible();
      await expect(page.getByText(/report.*pdf|download.*pdf/i)).toHaveCount(0);
      await page.goto('/en/org/opportunities/new');
      await expect(page.getByTestId('opp-editor')).toBeVisible();
      await expect(page.getByText(/perk|what you receive|logistics|accommodation/i)).toHaveCount(0);
      await expect(page.getByText(/applicant|application inbox/i)).toHaveCount(0);
    });

    test('guest opportunities visit redirects to login', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, captured, { authMeStatus: 401 });
      await page.goto('/en/org/opportunities');
      await expect(page).toHaveURL(/\/en\/login\?next=/);
    });
  });
}
