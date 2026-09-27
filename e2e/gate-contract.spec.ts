import { expect, test, type Page, type Route } from '@playwright/test';
import submitEn from '../src/messages/submit-contribution/en.json';
import { expectLoginRedirect } from './login-redirect';

// F19 gate check (6) — contract spot-checks, behavioral half (the static half
// lives in src/gate/contract-spotchecks.test.ts).
// registryId display-only, consent gate, 2-step progress, guest redirects,
// streamed downloads, and the neutral surface on representative screens.
// Full flow matrices live in the owning F-series specs.

const ID = '64f000000000000000000001';
const PID = '64f000000000000000000001';
const SID = '64f00000000000000000000a';
const MID = '64f0000000000000000000b1';

const guestAuth = {
  '/auth/me': { status: 401, body: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Expired' } },
};

const orgUser = {
  id: '64f000000000000000000002',
  email: 'org@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'organization',
  status: 'active',
};

const org = {
  _id: '64f0000000000000000000aa',
  registryId: 'a1b2c3',
  verificationStatus: 'verified',
  nameFr: 'Org A',
  nameAr: 'منظمة أ',
  coverMediaId: null,
  location: { wilayaId: 'Alger', municipalityId: 'Bab Ezzouar', address: 'Rue 12' },
  foundedYear: 2018,
};

const orgStats = {
  opportunitiesActive: 3,
  opportunitiesCompleted: 7,
  applicationsPending: 4,
  applicationsUnderReview: 2,
  participantsActive: 12,
  participantsCompleted: 30,
  verifiedHours: 180,
  decisionsLast30d: 9,
};

const positionOpen = {
  _id: '64f0000000000000000000a1',
  title: 'Lead Event Photographer',
  requiredCount: 2,
  filledCount: 1,
  applicationCount: 3,
  assigned: [{ volunteerId: 'v1', fullName: 'Amine Benali', username: 'amineb' }],
  skillNames: [{ skillId: 's1', nameFr: 'Photo', nameAr: 'تصوير' }],
};

const publicDetail = {
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

const volunteerUser = {
  id: '64f000000000000000000003',
  email: 'v@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'volunteer',
  status: 'active',
};

function draftOf(overrides: Record<string, unknown> = {}) {
  return {
    id: SID,
    participationId: PID,
    title: 'Well cleanup',
    description: 'Cleaned the well',
    evidence: [MID],
    consentConfirmed: false,
    status: 'draft',
    rejectionReason: null,
    ...overrides,
  };
}

interface Captured {
  path: string;
  method: string;
  body: unknown;
}

type Handler = { status: number; body?: unknown } | ((body: unknown) => { status: number; body?: unknown });

async function mockApi(page: Page, handlers: Record<string, Handler>, captured: Captured[]) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/attestation')) {
      captured.push({ path: url.pathname, method: route.request().method(), body: undefined });
      return route.fulfill({
        status: 200,
        headers: {
          'content-disposition': 'attachment; filename="attestation.pdf"',
          'access-control-allow-origin': '*',
          'access-control-expose-headers': 'content-disposition',
        },
        contentType: 'application/pdf',
        body: Buffer.from([37, 80, 68, 70]),
      });
    }
    if (url.search.includes('format=csv')) {
      captured.push({ path: url.pathname, method: route.request().method(), body: undefined });
      return route.fulfill({
        status: 200,
        headers: {
          'content-disposition': 'attachment; filename="org-experiences.csv"',
          'access-control-allow-origin': '*',
          'access-control-expose-headers': 'content-disposition',
        },
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
    captured.push({ path: url.pathname, method: route.request().method(), body: rawBody });
    const handler = handlers[key] as Handler;
    const { status, body } = typeof handler === 'function' ? handler(rawBody) : handler;
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: body === undefined ? '' : JSON.stringify(body),
    });
  });
  await page.route('**/cdn.example/**', async (route: Route) => {
    captured.push({ path: 'PUT-bytes', method: 'PUT', body: undefined });
    return route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*' },
      body: '',
    });
  });
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });
    test.setTimeout(120000);

    test('registryId renders display-only on the org dashboard', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(
        page,
        {
          '/auth/me': { status: 200, body: orgUser },
          '/organizations/me': { status: 200, body: org },
          '/organizations/me/stats': { status: 200, body: orgStats },
        },
        captured,
      );
      await page.goto('/en/org/dashboard');
      await expect(page.getByTestId('org-code')).toContainText('ORG-a1b2c3');
      await expect(page.locator('a[href*="a1b2c3"]')).toHaveCount(0);
    });

    test('guest apply on the public opportunity redirects to login with next', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(
        page,
        {
          ...guestAuth,
          '/opportunities/cultural-heritage-festival': { status: 200, body: publicDetail },
          '/organizations/timimoun-cultural/opportunities': {
            status: 200,
            body: { items: [], nextCursor: null, limit: 6, total: 0, page: 1, pages: 1 },
          },
        },
        captured,
      );
      await page.goto('/en/opportunities/cultural-heritage-festival');
      await expect(page.getByTestId('public-opp-details')).toBeVisible();
      await expect(page.getByTestId('detail-ref')).toContainText('OPP-000123');
      await page.getByTestId('apply-cta').first().click();
      await expectLoginRedirect(page, 'en', '/opportunities/cultural-heritage-festival');
      expect(
        captured.find((c) => c.path.includes('/positions/') && c.method === 'POST'),
      ).toBeUndefined();
    });

    test('submit stays blocked without consent, then submits with it', async ({ page }) => {
      const captured: Captured[] = [];
      let state = draftOf();
      await mockApi(
        page,
        {
          '/auth/me': { status: 200, body: volunteerUser },
          '/submissions/me': () => ({ status: 200, body: [state] }),
          [`/submissions/${SID}`]: (body) => {
            if (body && typeof body === 'object') state = { ...state, ...(body as object) };
            return { status: 200, body: state };
          },
          [`/submissions/${SID}/submit`]: () => {
            state = { ...state, status: 'submitted' };
            return { status: 200, body: state };
          },
        },
        captured,
      );
      await page.goto(`/en/volunteer/tasks/${PID}/submit`);
      await expect(page.getByTestId('submit-contribution')).toBeVisible({ timeout: 30000 });
      await expect(page.getByTestId('submit-button')).toBeDisabled();
      await page.getByLabel(submitEn.consent.label).check();
      await expect(page.getByTestId('submit-button')).toBeEnabled();
      await page.getByTestId('submit-button').click();
      await expect
        .poll(() => captured.find((c) => c.path.endsWith(`/submissions/${SID}/submit`)))
        .toBeTruthy();
      const submitCall = captured.find((c) => c.path.endsWith(`/submissions/${SID}/submit`));
      expect(submitCall?.body).toMatchObject({ consentConfirmed: true });
    });

    test('evidence upload follows create → PUT bytes → confirm, then patches', async ({ page }) => {
      const captured: Captured[] = [];
      let state = draftOf({ description: '', evidence: [] });
      await mockApi(
        page,
        {
          '/auth/me': { status: 200, body: volunteerUser },
          '/submissions/me': () => ({ status: 200, body: [state] }),
          [`/submissions/${SID}`]: (body) => {
            if (body && typeof body === 'object') state = { ...state, ...(body as object) };
            return { status: 200, body: state };
          },
          '/media/uploads': { status: 200, body: { mediaId: MID, uploadUrl: 'https://cdn.example/up' } },
          [`/media/${MID}/confirm`]: { status: 200 },
        },
        captured,
      );
      await page.goto(`/en/volunteer/tasks/${PID}/submit`);
      await expect(page.getByTestId('submit-contribution')).toBeVisible({ timeout: 30000 });
      await page.locator('input[type="file"]').setInputFiles({
        name: 'photo.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from([0, 1, 2]),
      });
      await expect
        .poll(() => captured.find((c) => c.path.endsWith('/media/uploads') && c.method === 'POST'))
        .toBeTruthy();
      await expect.poll(() => captured.find((c) => c.path === 'PUT-bytes')).toBeTruthy();
      await expect
        .poll(() => captured.find((c) => c.path.endsWith(`/media/${MID}/confirm`)))
        .toBeTruthy();
      await expect
        .poll(() => captured.find((c) => c.path.endsWith(`/submissions/${SID}`) && c.method === 'PATCH'))
        .toBeTruthy();
      const patch = captured.find((c) => c.path.endsWith(`/submissions/${SID}`) && c.method === 'PATCH');
      expect(patch?.body).toMatchObject({ evidence: [MID] });
    });

    test('CSV export downloads as an attachment without navigation', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(
        page,
        {
          '/auth/me': { status: 200, body: orgUser },
          '/organizations/me/experiences': {
            status: 200,
            body: { items: [], nextCursor: null, limit: 20, total: 0, page: 1, pages: 1 },
          },
          '/organizations/me/reviews': {
            status: 200,
            body: { items: [], nextCursor: null, limit: 20, total: 0, page: 1, pages: 1 },
          },
        },
        captured,
      );
      await page.goto('/en/org/experiences');
      await expect(page.getByTestId('org-records')).toBeVisible();
      const before = page.url();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('org-records-csv').click(),
      ]);
      expect(download.suggestedFilename()).toBe('org-experiences.csv');
      expect(page.url()).toBe(before);
    });

    test('representative screens carry no forbidden affordances or copy', async ({ page }) => {
      const captured: Captured[] = [];
      await mockApi(
        page,
        {
          ...guestAuth,
          '/opportunities/cultural-heritage-festival': { status: 200, body: publicDetail },
          '/organizations/timimoun-cultural/opportunities': {
            status: 200,
            body: { items: [], nextCursor: null, limit: 6, total: 0, page: 1, pages: 1 },
          },
        },
        captured,
      );
      await page.goto('/en/opportunities/cultural-heritage-festival');
      const body = await page.getByTestId('public-opp-details').innerText();
      for (const term of [
        'Message coordinator',
        'National Ledger',
        'perks',
        'logistics',
        'ranking',
        '500 MB',
        'Accredited',
      ]) {
        expect(body, `forbidden copy: ${term}`).not.toContain(term);
      }
      await expect(page.locator('audio')).toHaveCount(0);
    });
  });
}
