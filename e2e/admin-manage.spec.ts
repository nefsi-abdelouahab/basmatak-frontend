import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/admin-manage/en.json';
import ar from '../src/messages/admin-manage/ar.json';
import { expectLoginRedirect } from './login-redirect';

type Locale = 'en' | 'ar';
const catalogs = { en, ar } as const;

const admin = {
  id: '64f000000000000000000001',
  email: 'admin@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'admin',
  status: 'active',
};

const nonAdmin = { ...admin, role: 'volunteer' };

const volunteerRow = {
  id: '64f0000000000000000000a1',
  userId: '64f0000000000000000000b1',
  username: 'amina',
  email: 'amina@example.com',
  firstName: 'Amina',
  lastName: 'Benali',
  registryId: 'VOL-000001',
  status: 'active',
  skillNames: ['First aid'],
  wilayaName: 'Alger',
  lastActivityAt: '2026-09-01T00:00:00.000Z',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
};

const volunteersPage = {
  items: [volunteerRow],
  nextCursor: null,
  limit: 20,
  total: 1,
  page: 1,
  pages: 1,
};

const volunteerExperiences = {
  items: [
    {
      id: '64f0000000000000000000c1',
      registryId: 'EXP-000001',
      title: 'Beach cleanup',
      description: null,
      skills: [],
      duration: 180,
      organization: { id: 'o1', slug: 'el-amel', nameFr: 'Association El-Amel', nameAr: null },
      verifiedAt: '2026-09-05T12:00:00.000Z',
      verificationCode: 'ABCDEFGH',
      publicVisibility: 'public',
      review: null,
    },
  ],
  nextCursor: null,
  limit: 20,
  total: 1,
  page: 1,
  pages: 1,
};

const orgRow = {
  id: '64f0000000000000000000d1',
  slug: 'el-amel',
  nameFr: 'Association El-Amel',
  registryId: 'ORG-000001',
  status: 'active',
  verificationStatus: 'pending',
};

const orgsPage = {
  items: [orgRow],
  nextCursor: null,
  limit: 20,
  total: 1,
  page: 1,
  pages: 1,
};

const verificationRow = {
  id: '64f0000000000000000000e1',
  status: 'pending',
  assignedAdminId: null,
  submittedAt: '2026-09-02T00:00:00.000Z',
  organization: {
    id: '64f0000000000000000000d1',
    slug: 'el-amel',
    nameFr: 'Association El-Amel',
    verificationStatus: 'pending',
  },
};

const verificationsPage = {
  items: [verificationRow],
  nextCursor: null,
  limit: 20,
  total: 1,
  page: 1,
  pages: 1,
};

const latestDossier = {
  id: '64f0000000000000000000e1',
  status: 'pending',
  documents: ['64f0000000000000000000f1'],
};

const oppRow = {
  id: '64f0000000000000000000011',
  title: 'Beach cleanup drive',
  slug: 'beach-cleanup-drive',
  registryId: 'OPP-000001',
  status: 'published',
  organizationId: '64f0000000000000000000d1',
  positions: [{ capacity: 10, filled: 4 }],
  applicationCount: 6,
  wilayaName: 'Alger',
  assignedNames: ['Amina Benali'],
};

const oppsPage = {
  items: [oppRow],
  nextCursor: null,
  limit: 20,
  total: 1,
  page: 1,
  pages: 1,
};

const histories = [
  { from: 'active', to: 'suspended', reason: 'policy breach', notes: 'see report 7' },
];

const oppVerificationStatus = {
  items: [
    {
      participantId: '64f0000000000000000000p1',
      volunteerName: 'Amina Benali',
      username: 'amina',
      volunteerRegistryId: 'VOL-000001',
      positionTitle: 'Sweeper',
      participationStatus: 'completed',
      submissionStatus: 'approved',
      submissionTitle: 'Festival coverage',
      verificationCode: 'ABCDEFGH',
      experienceRegistryId: 'EXP-000001',
      verifiedAt: '2026-09-05T12:00:00.000Z',
    },
  ],
};

const analyticsOverview = {
  totals: {
    users: { current: 10, previous: 8, deltaPercent: 25 },
    organizations: { current: 3, previous: 3, deltaPercent: 0 },
    opportunities: { current: 5, previous: 4, deltaPercent: 25 },
    applications: { current: 20, previous: 10, deltaPercent: 100 },
    submissions: { current: 6, previous: 2, deltaPercent: 200 },
  },
  activeParticipants: 4,
  perStatus: {
    users: { active: 10 },
    organizations: { byStatus: { active: 3 }, byVerificationStatus: { verified: 2 } },
    opportunities: { published: 3, in_progress: 1, completed: 1 },
    applications: { pending: 2, under_review: 1 },
    submissions: { approved: 2 },
  },
  verificationReady: { total: 1, byOrganization: [] },
  gateFreezes: 0,
  medianDecisionHours: null,
};

const openOppReports = {
  items: [],
  nextCursor: null,
  limit: 1,
  total: 2,
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

const CSV_NAMES: Array<[string, string]> = [
  ['/admin/volunteers', 'admin-volunteers.csv'],
  ['/admin/organizations', 'admin-organizations.csv'],
  ['/admin/opportunities', 'admin-opportunities.csv'],
];

async function mockApi(page: Page, handlers: Record<string, Handler>, captured: Captured[]) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.search.includes('format=csv')) {
      captured.push({ path: url.pathname, method: route.request().method(), body: undefined, query: url.search });
      const name = CSV_NAMES.find(([suffix]) => url.pathname.endsWith(suffix))?.[1] ?? 'export.csv';
      return route.fulfill({
        status: 200,
        headers: { 'content-disposition': `attachment; filename="${name}"`, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-disposition' },
        contentType: 'text/csv',
        body: 'id,status\n1,active\n',
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
    '/auth/me': { status: 200, body: admin },
    '/admin/volunteers': { status: 200, body: volunteersPage },
    '/admin/volunteers/64f0000000000000000000a1/experiences': { status: 200, body: volunteerExperiences },
    '/admin/users/64f0000000000000000000b1': {
      status: 200,
      body: { id: '64f0000000000000000000b1', email: 'amina@example.com', role: 'volunteer', status: 'active' },
    },
    '/admin/users/64f0000000000000000000b1/status': (body) => ({
      status: 200,
      body: { id: '64f0000000000000000000b1', status: (body as { status: string }).status },
    }),
    '/admin/users/64f0000000000000000000b1/notice': { status: 200, body: { ok: true } },
    '/admin/status-histories': { status: 200, body: histories },
    '/admin/organizations': { status: 200, body: orgsPage },
    '/admin/organizations/64f0000000000000000000d1/status': (body) => ({
      status: 200,
      body: { id: '64f0000000000000000000d1', status: (body as { status: string }).status },
    }),
    '/admin/organizations/verifications': { status: 200, body: verificationsPage },
    '/admin/organizations/verifications/64f0000000000000000000e1/assign': (body) => ({
      status: 200,
      body: { id: '64f0000000000000000000e1', assignedAdminId: (body as { assignedAdminId: string }).assignedAdminId },
    }),
    '/admin/organizations/64f0000000000000000000d1/verification/latest': { status: 200, body: latestDossier },
    '/media/64f0000000000000000000f1': {
      status: 200,
      body: { media: { id: '64f0000000000000000000f1' }, url: 'https://cdn.example/x.pdf' },
    },
    '/admin/organizations/64f0000000000000000000d1/verification/approve': {
      status: 200,
      body: { id: '64f0000000000000000000e1', status: 'verified' },
    },
    '/admin/organizations/64f0000000000000000000d1/verification/reject': {
      status: 200,
      body: { id: '64f0000000000000000000e1', status: 'rejected' },
    },
    '/admin/opportunities': { status: 200, body: oppsPage },
    '/admin/opportunities/64f0000000000000000000011/status': (body) => ({
      status: 200,
      body: { id: '64f0000000000000000000011', status: (body as { status: string }).status },
    }),
    '/admin/opportunities/64f0000000000000000000011/verification-status': {
      status: 200,
      body: oppVerificationStatus,
    },
    '/admin/analytics/overview': { status: 200, body: analyticsOverview },
    '/admin/reports': { status: 200, body: openOppReports },
    '/skill-categories': { status: 200, body: [] },
    '/skills': { status: 200, body: [] },
  };
}

const BANNED_COPY = ['legal review', 'flagged', 'request info', 'law 12-06', 'seal', 'incomplete'];

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
      test(`volunteers table renders translated with totals (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, baseHandlers(), captured);
        await page.goto(`/${locale}/admin/volunteers`);
        await expect(page.getByTestId('admin-volunteers')).toBeVisible();
        await expect(
          page.getByTestId('admin-volunteers').getByRole('heading', { level: 1 }),
        ).toHaveText(catalogs[locale].volunteers.title);
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          locale === 'ar' ? 'rtl' : 'ltr',
        );
        await expect(page.getByTestId('admin-volunteers-filters')).toBeVisible();
        await expect(page.getByTestId('admin-volunteers-count')).toContainText('1');
        const bodyText = (await page.getByTestId('admin-volunteers').innerText()).toLowerCase();
        for (const banned of BANNED_COPY) expect(bodyText).not.toContain(banned);
      });

      test(`organizations, verifications, opportunities render translated (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, baseHandlers(), captured);
        await page.goto(`/${locale}/admin/organizations`);
        await expect(
          page.getByTestId('admin-organizations').getByRole('heading', { level: 1 }),
        ).toHaveText(catalogs[locale].organizations.title);
        await page.goto(`/${locale}/admin/verifications`);
        await expect(
          page.getByTestId('admin-verifications').getByRole('heading', { level: 1 }),
        ).toHaveText(catalogs[locale].verifications.title);
        await page.goto(`/${locale}/admin/opportunities`);
        await expect(
          page.getByTestId('admin-opportunities').getByRole('heading', { level: 1 }),
        ).toHaveText(catalogs[locale].opportunities.title);
      });
    }

    test('volunteer search filter refetches with the q param', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/admin/volunteers');
      await expect(page.getByTestId('admin-volunteers-count')).toBeVisible();
      await page.locator('#admin-volunteers-q').fill('amina');
      await expect
        .poll(() =>
          captured.find(
            (c) => c.path.endsWith('/admin/volunteers') && c.query.includes('q=amina'),
          ),
        )
        .toBeTruthy();
    });

    test('volunteer CSV exports as a file without navigation', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/admin/volunteers');
      const before = page.url();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('admin-volunteers-csv').click(),
      ]);
      expect(download.suggestedFilename()).toBe('admin-volunteers.csv');
      expect(page.url()).toBe(before);
    });

    test('volunteer suspend-with-reason posts status-PATCH and shows history', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/admin/volunteers');
      await page.getByTestId('admin-volunteer-open-64f0000000000000000000a1').click();
      await expect(page.getByTestId('admin-volunteer-detail')).toBeVisible();
      await expect(page.getByTestId('admin-volunteer-engagement')).toContainText('EXP-000001');
      await page.getByTestId('admin-volunteer-status-open').click();
      await page.locator('#admin-volunteer-reason').fill('policy breach');
      await page.locator('#admin-volunteer-notes').fill('see report 7');
      await page.getByTestId('admin-volunteer-status-confirm').click();
      await expect
        .poll(() =>
          captured.find(
            (c) => c.path.endsWith('/admin/users/64f0000000000000000000b1/status') && c.method === 'PATCH',
          ),
        )
        .toBeTruthy();
      const patch = captured.find((c) => c.path.endsWith('/status') && c.method === 'PATCH');
      expect((patch?.body as { status: string }).status).toBe('suspended');
      expect((patch?.body as { reason: string }).reason).toBe('policy breach');
      await page.getByTestId('admin-volunteer-history-toggle').click();
      await expect(page.getByTestId('admin-volunteer-history-row').first()).toContainText('policy breach');
    });

    test('volunteer notice requires a message then posts', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/admin/volunteers');
      await page.getByTestId('admin-volunteer-open-64f0000000000000000000a1').click();
      await page.getByTestId('admin-volunteer-notice-open').click();
      await expect(page.getByTestId('admin-volunteer-notice-confirm')).toBeDisabled();
      await page.locator('#admin-volunteer-notice-message').fill('Please update your profile');
      await page.getByTestId('admin-volunteer-notice-confirm').click();
      await expect
        .poll(() =>
          captured.find(
            (c) => c.path.endsWith('/admin/users/64f0000000000000000000b1/notice') && c.method === 'POST',
          ),
        )
        .toBeTruthy();
    });

    test('organization suspend-with-reason posts status-PATCH and shows history', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/admin/organizations');
      await page.getByTestId('admin-organization-open-64f0000000000000000000d1').click();
      await page.getByTestId('admin-organization-status-open').click();
      await page.locator('#admin-organization-reason').fill('policy breach');
      await page.getByTestId('admin-organization-status-confirm').click();
      await expect
        .poll(() =>
          captured.find(
            (c) => c.path.endsWith('/admin/organizations/64f0000000000000000000d1/status') && c.method === 'PATCH',
          ),
        )
        .toBeTruthy();
      await page.getByTestId('admin-organization-history-toggle').click();
      await expect(page.getByTestId('admin-organization-history-row').first()).toContainText('policy breach');
    });

    test('organization CSV exports as a file without navigation', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/admin/organizations');
      const before = page.url();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('admin-organizations-csv').click(),
      ]);
      expect(download.suggestedFilename()).toBe('admin-organizations.csv');
      expect(page.url()).toBe(before);
    });

    test('verification triage assigns, approves, and rejects with reason', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/admin/verifications');
      await expect(page.getByTestId('admin-verifications-count')).toContainText('1');
      await page.getByTestId('admin-verification-open-64f0000000000000000000e1').click();
      await expect(page.getByTestId('admin-verification-dossier')).toBeVisible();
      await expect(page.getByTestId('admin-verification-document-64f0000000000000000000f1')).toBeVisible();
      await page.getByTestId('admin-verification-assign-open').click();
      await page.locator('#admin-verification-assign-admin').fill('64f000000000000000000001');
      await page.getByTestId('admin-verification-assign-confirm').click();
      await expect
        .poll(() =>
          captured.find(
            (c) => c.path.endsWith('/verifications/64f0000000000000000000e1/assign') && c.method === 'PATCH',
          ),
        )
        .toBeTruthy();
      await page.getByTestId('admin-verification-reject-open').click();
      await expect(page.getByTestId('admin-verification-reject-confirm')).toBeDisabled();
      await page.locator('#admin-verification-reject-reason').fill('Missing statute scan');
      await page.getByTestId('admin-verification-reject-confirm').click();
      const rejected = await expect
        .poll(() =>
          captured.find(
            (c) => c.path.endsWith('/verification/reject') && c.method === 'POST',
          ),
        )
        .toBeTruthy();
      void rejected;
      const post = captured.find((c) => c.path.endsWith('/verification/reject'));
      expect((post?.body as { rejectionReason: string }).rejectionReason).toBe('Missing statute scan');
      await page.getByTestId('admin-verification-approve-open').click();
      await page.getByTestId('admin-verification-approve-confirm').click();
      await expect
        .poll(() =>
          captured.find(
            (c) => c.path.endsWith('/verification/approve') && c.method === 'POST',
          ),
        )
        .toBeTruthy();
    });

    test('opportunity force-close uses status-PATCH and shows history', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/admin/opportunities');
      await expect(page.getByTestId('admin-opportunities-count')).toContainText('1');
      await expect(page.getByTestId('admin-opportunities-stat-flagged')).toContainText('2');
      await page.getByTestId('admin-opportunity-open-64f0000000000000000000011').click();
      await expect(page.getByTestId('admin-opportunity-detail')).toContainText('OPP-000001');
      await expect(page.getByTestId('admin-opportunity-detail')).toContainText('ABCDEFGH');
      await expect(page.getByTestId('admin-opportunity-detail')).toContainText('VOL-000001');
      await page.getByTestId('admin-opportunity-force-close-open').click();
      await page.locator('#admin-opportunity-reason').fill('abusive content');
      await page.getByTestId('admin-opportunity-force-close-confirm').click();
      await expect
        .poll(() =>
          captured.find(
            (c) => c.path.endsWith('/admin/opportunities/64f0000000000000000000011/status') && c.method === 'PATCH',
          ),
        )
        .toBeTruthy();
      expect(captured.find((c) => c.method === 'POST' && c.path.includes('/close'))).toBeUndefined();
      const patch = captured.find((c) => c.path.endsWith('/status') && c.method === 'PATCH');
      expect((patch?.body as { status: string }).status).toBe('closed');
      await page.getByTestId('admin-opportunity-history-toggle').click();
      await expect(page.getByTestId('admin-opportunity-history-row').first()).toContainText('policy breach');
    });

    test('opportunity CSV exports as a file without navigation', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(page, baseHandlers(), captured);
      await page.goto('/en/admin/opportunities');
      const before = page.url();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('admin-opportunities-csv').click(),
      ]);
      expect(download.suggestedFilename()).toBe('admin-opportunities.csv');
      expect(page.url()).toBe(before);
    });

    test('non-admin sees 403 on every admin route', async ({ page }) => {
      const captured: Captured[] = [];
      const handlers = baseHandlers();
      handlers['/auth/me'] = { status: 200, body: nonAdmin };
      await mockApi(page, handlers, captured);
      for (const route of ['volunteers', 'organizations', 'verifications', 'opportunities']) {
        await page.goto(`/en/admin/${route}`);
        await expect(page.getByTestId('admin-forbidden')).toBeVisible();
        expect(await page.getByTestId(`admin-${route}`).count()).toBe(0);
      }
    });

    test('guest redirects to login from admin routes', async ({ page }) => {
      const captured: Captured[] = [];
      const handlers = baseHandlers();
      handlers['/auth/me'] = { status: 401, body: { statusCode: 401, code: 'UNAUTHORIZED', message: 'x' } };
      await mockApi(page, handlers, captured);
      await page.goto('/en/admin/volunteers');
      await expectLoginRedirect(page, 'en', '/admin/volunteers');
    });
  });
}
