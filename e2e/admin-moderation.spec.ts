import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/admin-moderation/en.json';
import ar from '../src/messages/admin-moderation/ar.json';

type Locale = 'en' | 'ar';
const catalogs = { en, ar } as const;

const adminUser = {
  id: '64f0000000000000000000a1',
  email: 'admin@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'admin',
  status: 'active',
};

const volunteerUser = { ...adminUser, role: 'volunteer', email: 'vol@example.com' };

interface ReportRow {
  _id: string;
  status: string;
  targetType: string;
  targetId: string;
  reason: string;
  title?: string;
  priority: string;
  reporter?: { username: string };
  target?: { title: string };
}

const reportOpp: ReportRow = {
  _id: '64f0000000000000000000r1',
  status: 'open',
  targetType: 'opportunity',
  targetId: '64f0000000000000000000o1',
  reason: 'Spam listing',
  title: 'Cleanup day report',
  priority: 'high',
  reporter: { username: 'reporter-one' },
  target: { title: 'Cleanup day' },
};

const reportReview: ReportRow = {
  _id: '64f0000000000000000000r2',
  status: 'in_review',
  targetType: 'review',
  targetId: '64f0000000000000000000v1',
  reason: 'Abusive text',
  priority: 'normal',
  reporter: { username: 'reporter-two' },
  target: { title: 'Great work' },
};

const settingsRows = () => [
  { key: 'publishGate.maxPendingOpportunities', value: 3 },
  { key: 'platform.name', value: 'Basmatak' },
  { key: 'platform.summary', value: 'Civic network' },
  { key: 'platform.contactEmail', value: 'contact@example.com' },
  { key: 'locale.defaultLanguage', value: 'en' },
  { key: 'locale.defaultTimezone', value: 'Africa/Algiers' },
  { key: 'locale.dateFormat', value: 'YYYY-MM-DD' },
  { key: 'auth.adminSessionDurationDays', value: 30 },
  { key: 'moderation.requireVerifiedEmail', value: true },
  { key: 'moderation.suspendOnReport', value: false },
  { key: 'ops.registrationEnabled', value: true },
  { key: 'ops.publishingEnabled', value: true },
  { key: 'maintenance.enabled', value: false },
  { key: 'maintenance.message', value: '' },
  { key: 'notifications.digest.enabled', value: false },
  { key: 'notifications.digest.intervalDays', value: 7 },
];

interface Captured {
  path: string;
  method: string;
  body: unknown;
  query: string;
}

interface MockState {
  reports: ReportRow[];
  resolutionByReport: Record<string, string>;
  settings: { key: string; value: unknown }[];
  maintenance: { enabled: boolean; message: string };
  meRole: 'admin' | 'volunteer';
  meStatus: number;
}

function freshState(): MockState {
  return {
    reports: [reportOpp, reportReview].map((r) => ({ ...r })),
    resolutionByReport: {},
    settings: settingsRows(),
    maintenance: { enabled: false, message: '' },
    meRole: 'admin',
    meStatus: 200,
  };
}

async function mockApi(page: Page, state: MockState, captured: Captured[]) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    let rawBody: unknown;
    try {
      rawBody = route.request().postDataJSON();
    } catch {
      rawBody = undefined;
    }
    const push = () => captured.push({ path, method, body: rawBody, query: url.search });

    if (path.endsWith('/auth/me')) {
      push();
      if (state.meStatus !== 200) return route.fulfill({ status: state.meStatus, body: '{}' });
      const me = state.meRole === 'admin' ? adminUser : volunteerUser;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(me) });
    }
    if (path.endsWith('/system/status')) {
      push();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          version: '1.0.0',
          maintenance: state.maintenance.enabled,
          message: state.maintenance.message,
        }),
      });
    }
    if (path.endsWith('/admin/settings') && method === 'GET') {
      push();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.settings) });
    }
    if (path.includes('/admin/settings/') && method === 'PUT') {
      push();
      const key = decodeURIComponent(path.split('/admin/settings/')[1] ?? '');
      const value = (rawBody as { value?: unknown })?.value;
      const row = state.settings.find((s) => s.key === key);
      if (row) row.value = value;
      else state.settings.push({ key, value });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ key, value }) });
    }
    if (path.endsWith('/admin/ops/maintenance') && method === 'POST') {
      push();
      const body = (rawBody as { enabled?: boolean; message?: string }) ?? {};
      state.maintenance.enabled = body.enabled === true;
      if (typeof body.message === 'string') state.maintenance.message = body.message;
      const row = state.settings.find((s) => s.key === 'maintenance.enabled');
      if (row) row.value = state.maintenance.enabled;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.maintenance),
      });
    }
    if (path.endsWith('/admin/status-histories') && method === 'GET') {
      push();
      const entityType = url.searchParams.get('entityType');
      const entityId = url.searchParams.get('entityId');
      if (entityType === 'reports' && entityId && state.resolutionByReport[entityId]) {
        const report = state.reports.find((r) => r._id === entityId);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { from: 'open', to: 'resolved', reason: state.resolutionByReport[entityId], createdAt: '2026-09-27T00:00:00.000Z' },
            ...(report ? [] : []),
          ]),
        });
      }
      if (entityId && Object.values(state.resolutionByReport).length > 0) {
        const reasons = Object.values(state.resolutionByReport);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            reasons.map((reason) => ({ from: 'published', to: 'closed', reason })),
          ),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    }
    if (path.includes('/admin/reports/') && path.endsWith('/assign') && method === 'PATCH') {
      push();
      const id = path.split('/admin/reports/')[1]?.split('/')[0] ?? '';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...(state.reports.find((r) => r._id === id) ?? {}), assignedAdminId: (rawBody as { assignedAdminId?: string })?.assignedAdminId }),
      });
    }
    if (/\/admin\/reports\/[^/]+$/.test(path) && method === 'PATCH') {
      push();
      const id = path.split('/admin/reports/')[1] ?? '';
      const body = (rawBody as { status?: string; resolution?: string; action?: { type?: string } }) ?? {};
      if (body.action && !body.resolution) {
        return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ statusCode: 400, code: 'BAD_REQUEST', message: 'Resolution required' }) });
      }
      const report = state.reports.find((r) => r._id === id);
      if (!report || body.status === report.status) {
        return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ statusCode: 409, code: 'INVALID_STATUS_TRANSITION', message: 'Conflict' }) });
      }
      report.status = body.status ?? report.status;
      if (body.resolution) {
        (report as ReportRow & { resolution?: string }).resolution = body.resolution;
        state.resolutionByReport[id] = body.resolution;
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(report) });
    }
    if (path.endsWith('/admin/reports') && method === 'GET') {
      push();
      if (url.search.includes('format=csv')) {
        return route.fulfill({
          status: 200,
          headers: { 'content-disposition': 'attachment; filename="admin-reports.csv"', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-disposition' },
          contentType: 'text/csv',
          body: 'id,status\n1,open\n',
        });
      }
      const status = url.searchParams.get('status');
      const targetType = url.searchParams.get('targetType');
      const items = state.reports.filter(
        (r) => (!status || r.status === status) && (!targetType || r.targetType === targetType),
      );
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items, nextCursor: null, limit: 20, total: items.length, page: 1, pages: 1 }),
      });
    }
    if (path.includes('/admin/users/') && path.endsWith('/notice') && method === 'POST') {
      push();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ delivered: true }) });
    }
    if (path.includes('/admin/reviews/') && path.endsWith('/hide') && method === 'PATCH') {
      push();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'hidden' }) });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
      test(`reports triage renders enriched rows translated (${locale})`, async ({ page }) => {
        test.slow();
        const state = freshState();
        const captured: Captured[] = [];
        await mockApi(page, state, captured);
        await page.goto(`/${locale}/admin/reports`);
        await expect(page.getByTestId('admin-reports')).toBeVisible();
        await expect(page.getByTestId('admin-reports').getByRole('heading', { level: 1 })).toHaveText(
          catalogs[locale].reports.title,
        );
        await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
        await expect(page.getByTestId('admin-reports-filters')).toBeVisible();
        await expect(page.getByTestId('admin-reports-count')).toContainText('2');
        await expect(page.getByTestId('admin-report-card')).toHaveCount(2);
        const first = page.getByTestId('admin-report-card').first();
        await expect(first).toContainText('reporter-one');
        await expect(first).toContainText('Cleanup day');
        // Forbidden sanction vocabulary appears nowhere on the route.
        const bodyText = ((await page.getByTestId('admin-reports').innerText()) ?? '').toLowerCase();
        expect(bodyText).not.toContain('statutory sanction');
        expect(bodyText).not.toContain('100% compliance');
        expect(bodyText).not.toContain('contact secretariat');
      });

      test(`settings table lists stored keys translated (${locale})`, async ({ page }) => {
        test.slow();
        const state = freshState();
        const captured: Captured[] = [];
        await mockApi(page, state, captured);
        await page.goto(`/${locale}/admin/settings`);
        await expect(page.getByTestId('admin-settings')).toBeVisible();
        await expect(page.getByTestId('admin-settings').getByRole('heading', { level: 1 })).toHaveText(
          catalogs[locale].settings.title,
        );
        await expect(page.getByTestId('admin-settings-count')).toContainText('16');
        await expect(page.locator('[data-testid^="admin-setting-row-"]')).toHaveCount(16);
        await expect(page.getByTestId('admin-maintenance')).toBeVisible();
        const bodyText = ((await page.getByTestId('admin-settings').innerText()) ?? '').toLowerCase();
        expect(bodyText).not.toContain('statutory sanction');
        expect(bodyText).not.toContain('100% compliance');
        expect(bodyText).not.toContain('contact secretariat');
      });
    }

    test('status filter refetches with the status param', async ({ page }) => {
      const state = freshState();
      const captured: Captured[] = [];
      await mockApi(page, state, captured);
      await page.goto('/en/admin/reports');
      await expect(page.getByTestId('admin-report-card')).toHaveCount(2);
      await page.locator('#admin-reports-status').selectOption('open');
      await expect
        .poll(() =>
          captured.find((c) => c.path.endsWith('/admin/reports') && c.query.includes('status=open')),
        )
        .toBeTruthy();
    });

    test('target-type filter refetches with the targetType param', async ({ page }) => {
      const state = freshState();
      const captured: Captured[] = [];
      await mockApi(page, state, captured);
      await page.goto('/en/admin/reports');
      await expect(page.getByTestId('admin-report-card')).toHaveCount(2);
      await page.locator('#admin-reports-target').selectOption('review');
      await expect
        .poll(() =>
          captured.find((c) => c.path.endsWith('/admin/reports') && c.query.includes('targetType=review')),
        )
        .toBeTruthy();
    });

    test('CSV exports as a file without navigation', async ({ page }) => {
      const state = freshState();
      const captured: Captured[] = [];
      await mockApi(page, state, captured);
      await page.goto('/en/admin/reports');
      const before = page.url();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('admin-reports-csv').click(),
      ]);
      expect(download.suggestedFilename()).toBe('admin-reports.csv');
      expect(page.url()).toBe(before);
    });

    test('assign posts the assigned admin id', async ({ page }) => {
      const state = freshState();
      const captured: Captured[] = [];
      await mockApi(page, state, captured);
      await page.goto('/en/admin/reports');
      await page.getByTestId('admin-report-toggle-64f0000000000000000000r1').click();
      await page.locator('#admin-assign-64f0000000000000000000r1').fill('64f0000000000000000000a1');
      await page.getByTestId('admin-assign-apply-64f0000000000000000000r1').click();
      await expect(page.getByTestId('admin-assign-done-64f0000000000000000000r1')).toBeVisible();
      const call = captured.find((c) => c.path.endsWith('/assign') && c.method === 'PATCH');
      expect(call?.body).toEqual({ assignedAdminId: '64f0000000000000000000a1' });
    });

    test('resolve-with-action is atomic and asserts the consequence via re-read', async ({ page }) => {
      const state = freshState();
      const captured: Captured[] = [];
      await mockApi(page, state, captured);
      await page.goto('/en/admin/reports');
      await page.getByTestId('admin-report-toggle-64f0000000000000000000r1').click();
      await page.locator('#admin-resolve-resolution-64f0000000000000000000r1').fill('Confirmed after review');
      await page.locator('#admin-resolve-action-64f0000000000000000000r1').selectOption('unpublish_opportunity');
      await page.getByTestId('admin-resolve-apply-64f0000000000000000000r1').click();
      // Consequence asserted via re-read — the confirmed banner only
      // appears after the report + histories re-reads match the decision.
      await expect(page.getByTestId('admin-resolve-confirmed-64f0000000000000000000r1')).toBeVisible();
      const patch = captured.find(
        (c) => c.path.endsWith('/admin/reports/64f0000000000000000000r1') && c.method === 'PATCH',
      );
      expect(patch?.body).toEqual({
        status: 'resolved',
        resolution: 'Confirmed after review',
        action: { type: 'unpublish_opportunity' },
      });
      expect(
        captured.find(
          (c) =>
            c.path.endsWith('/admin/status-histories') &&
            c.query.includes('entityType=reports') &&
            c.query.includes('entityId=64f0000000000000000000r1'),
        ),
      ).toBeTruthy();
    });

    test('incompatible action is blocked with no request', async ({ page }) => {
      const state = freshState();
      const captured: Captured[] = [];
      await mockApi(page, state, captured);
      await page.goto('/en/admin/reports');
      await page.getByTestId('admin-report-toggle-64f0000000000000000000r1').click();
      await page.locator('#admin-resolve-action-64f0000000000000000000r1').selectOption('suspend_target');
      await expect(page.getByTestId('admin-resolve-incompatible-64f0000000000000000000r1')).toBeVisible();
      await expect(page.getByTestId('admin-resolve-apply-64f0000000000000000000r1')).toBeDisabled();
      expect(
        captured.find((c) => c.path.includes('/admin/reports/64f0000000000000000000r1') && c.method === 'PATCH'),
      ).toBeUndefined();
    });

    test('action without a resolution stays disabled', async ({ page }) => {
      const state = freshState();
      const captured: Captured[] = [];
      await mockApi(page, state, captured);
      await page.goto('/en/admin/reports');
      await page.getByTestId('admin-report-toggle-64f0000000000000000000r1').click();
      await page.locator('#admin-resolve-action-64f0000000000000000000r1').selectOption('close_opportunity');
      await expect(page.getByTestId('admin-resolve-apply-64f0000000000000000000r1')).toBeDisabled();
      expect(
        captured.find((c) => c.path.includes('/admin/reports/64f0000000000000000000r1') && c.method === 'PATCH'),
      ).toBeUndefined();
    });

    test('standalone notice posts the message', async ({ page }) => {
      const state = freshState();
      const captured: Captured[] = [];
      await mockApi(page, state, captured);
      await page.goto('/en/admin/reports');
      await page.getByTestId('admin-report-toggle-64f0000000000000000000r1').click();
      await page.locator('#admin-notice-user-64f0000000000000000000r1').fill('64f0000000000000000000u9');
      await page.locator('#admin-notice-message-64f0000000000000000000r1').fill('Hello');
      await page.getByTestId('admin-notice-send-64f0000000000000000000r1').click();
      await expect(page.getByTestId('admin-notice-done-64f0000000000000000000r1')).toBeVisible();
      const call = captured.find((c) => c.path.endsWith('/notice') && c.method === 'POST');
      expect(call?.body).toEqual({ message: 'Hello' });
    });

    test('review-hide patches the reported review', async ({ page }) => {
      const state = freshState();
      const captured: Captured[] = [];
      await mockApi(page, state, captured);
      await page.goto('/en/admin/reports');
      await page.getByTestId('admin-report-toggle-64f0000000000000000000r2').click();
      await page.getByTestId('admin-hide-64f0000000000000000000r2').click();
      await expect(page.getByTestId('admin-hide-done-64f0000000000000000000r2')).toBeVisible();
      expect(
        captured.find((c) => c.path.endsWith('/hide') && c.method === 'PATCH'),
      ).toBeTruthy();
    });

    test('non-admin sees the 403 state on both routes', async ({ page }) => {
      const state = freshState();
      state.meRole = 'volunteer';
      const captured: Captured[] = [];
      await mockApi(page, state, captured);
      await page.goto('/en/admin/reports');
      await expect(page.getByTestId('admin-moderation-forbidden')).toBeVisible({ timeout: 20000 });
      await page.goto('/en/admin/settings');
      await expect(page.getByTestId('admin-moderation-forbidden')).toBeVisible({ timeout: 20000 });
      expect(captured.find((c) => c.path.endsWith('/admin/reports'))).toBeUndefined();
      expect(captured.find((c) => c.path.endsWith('/admin/settings'))).toBeUndefined();
    });

    test('guest is redirected to login', async ({ page }) => {
      const state = freshState();
      state.meStatus = 401;
      const captured: Captured[] = [];
      await mockApi(page, state, captured);
      await page.goto('/en/admin/reports');
      await expect.poll(() => page.url(), { timeout: 30000 }).toContain('/login');
    });

    test('valid setting edit persists and re-reads', async ({ page }) => {
      const state = freshState();
      const captured: Captured[] = [];
      await mockApi(page, state, captured);
      await page.goto('/en/admin/settings');
      await expect(page.locator('[data-testid^="admin-setting-row-"]')).toHaveCount(16);
      await page.locator('input[id="admin-setting-input-publishGate.maxPendingOpportunities"]').fill('1');
      await page.getByTestId('admin-setting-save-publishGate.maxPendingOpportunities').click();
      await expect(page.getByTestId('admin-setting-saved-publishGate.maxPendingOpportunities')).toBeVisible();
      const call = captured.find(
        (c) => c.path.endsWith('/admin/settings/publishGate.maxPendingOpportunities') && c.method === 'PUT',
      );
      expect(call?.body).toEqual({ value: 1 });
    });

    test('wrong-shaped setting value is blocked with no request', async ({ page }) => {
      const state = freshState();
      const captured: Captured[] = [];
      await mockApi(page, state, captured);
      await page.goto('/en/admin/settings');
      await page.locator('input[id="admin-setting-input-publishGate.maxPendingOpportunities"]').fill('');
      await page.getByTestId('admin-setting-save-publishGate.maxPendingOpportunities').click();
      await expect(page.getByTestId('admin-setting-invalid-publishGate.maxPendingOpportunities')).toBeVisible();
      expect(
        captured.find(
          (c) => c.path.endsWith('/admin/settings/publishGate.maxPendingOpportunities') && c.method === 'PUT',
        ),
      ).toBeUndefined();
    });

    test('maintenance toggle enforces and the status re-read reflects it', async ({ page }) => {
      const state = freshState();
      const captured: Captured[] = [];
      await mockApi(page, state, captured);
      await page.goto('/en/admin/settings');
      await page.locator('#admin-maintenance-enabled').selectOption('true');
      await page.locator('#admin-maintenance-message').fill('Upgrading search');
      await page.getByTestId('admin-maintenance-apply').click();
      await expect(page.getByTestId('admin-maintenance-saved')).toBeVisible();
      // Enforcement spot-check: the status re-read reports maintenance on
      // with the stored message while the endpoint stays reachable.
      await expect(page.getByTestId('admin-maintenance-enforced')).toContainText(en.settings.maintenanceOn);
      await expect(page.getByTestId('admin-maintenance-enforced')).toContainText(en.settings.enforcedOn);
      await expect(page.getByTestId('admin-maintenance-enforced')).toContainText('Upgrading search');
      const toggle = captured.find((c) => c.path.endsWith('/admin/ops/maintenance') && c.method === 'POST');
      expect(toggle?.body).toEqual({ enabled: true, message: 'Upgrading search' });
      expect(captured.find((c) => c.path.endsWith('/system/status'))).toBeTruthy();
    });

    test('over-long maintenance message is blocked with no request', async ({ page }) => {
      const state = freshState();
      const captured: Captured[] = [];
      await mockApi(page, state, captured);
      await page.goto('/en/admin/settings');
      await page.locator('#admin-maintenance-message').fill('x'.repeat(501));
      await expect(page.getByTestId('admin-maintenance-apply')).toBeDisabled();
      expect(
        captured.find((c) => c.path.endsWith('/admin/ops/maintenance') && c.method === 'POST'),
      ).toBeUndefined();
    });
  });
}
