import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/submit-contribution/en.json';
import ar from '../src/messages/submit-contribution/ar.json';

type Locale = 'en' | 'ar';
const catalogs = { en, ar } as const;

const PID = '64f000000000000000000001';
const SID = '64f00000000000000000000a';
const MID = '64f0000000000000000000b1';

const user = {
  id: '64f000000000000000000002',
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
    description: '',
    evidence: [],
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
  await page.route('**/cdn.example/**', async (route: Route) => {
    captured.push({ path: 'PUT-bytes', method: 'PUT', body: undefined });
    return route.fulfill({
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: '',
    });
  });
}

function sessionHandlers() {
  return { '/auth/me': { status: 200, body: user } };
}

// First paint on a loaded dev server can exceed the 5s expect default;
// wait for the route root before interacting.
async function gotoReady(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByTestId('submit-contribution')).toBeVisible({ timeout: 30000 });
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });
    // Loaded shared dev servers are slow; keep per-test ceiling above it.
    test.setTimeout(120000);

    for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
      test(`new draft composer renders translated (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        await mockApi(page, { ...sessionHandlers(), '/submissions/me': { status: 200, body: [] } }, captured);
        await page.goto(`/${locale}/volunteer/tasks/${PID}/submit`);
        // Loaded dev servers under parallel load need a longer first paint.
        await expect(page.getByTestId('submit-contribution')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('submit-contribution').getByRole('heading', { level: 1 })).toHaveText(
          catalogs[locale].page.title,
        );
        await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
        await expect(page.getByTestId('new-draft')).toBeVisible();
        await expect(page.getByTestId('submit-contribution')).not.toContainText('Message coordinator');
      });

      test(`draft renders status, consent gate, and evidence (${locale})`, async ({ page }) => {
        const captured: Captured[] = [];
        const draft = draftOf();
        await mockApi(
          page,
          {
            ...sessionHandlers(),
            '/submissions/me': { status: 200, body: [draft] },
            [`/submissions/${SID}`]: { status: 200, body: draft },
          },
          captured,
        );
        await page.goto(`/${locale}/volunteer/tasks/${PID}/submit`);
        await expect(page.getByTestId('submit-status')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('status-value')).toHaveText(catalogs[locale].status.draft);
        await expect(page.getByTestId('evidence-section')).toBeVisible();
        await expect(page.getByTestId('evidence-empty')).toBeVisible();
        await expect(page.getByLabel(catalogs[locale].consent.label)).toBeVisible();
        await expect(page.getByText(catalogs[locale].consent.helper)).toBeVisible();
        await expect(page.getByRole('button', { name: catalogs[locale].submit.cta })).toBeVisible();
        await expect(page.getByTestId('submit-contribution')).not.toContainText('Message coordinator');
        // No 500MB / audio / zip copy anywhere.
        await expect(page.getByTestId('submit-contribution')).not.toContainText(/500\s?MB/i);
      });
    }

    test('wrong file type rejected before any upload', async ({ page }) => {
      const captured: Captured[] = [];
      const draft = draftOf();
      await mockApi(
        page,
        {
          ...sessionHandlers(),
          '/submissions/me': { status: 200, body: [draft] },
          [`/submissions/${SID}`]: { status: 200, body: draft },
        },
        captured,
      );
      await gotoReady(page, `/en/volunteer/tasks/${PID}/submit`);
      await page.locator('input[type="file"]').setInputFiles({
        name: 'clip.mp4',
        mimeType: 'video/mp4',
        buffer: Buffer.from([0, 1, 2]),
      });
      await expect(page.getByTestId('file-error')).toHaveText(en.evidence.typeError);
      expect(captured.find((c) => c.path.endsWith('/media/uploads'))).toBeUndefined();
    });

    test('oversize pdf rejected before any upload', async ({ page }) => {
      const captured: Captured[] = [];
      const draft = draftOf();
      await mockApi(
        page,
        {
          ...sessionHandlers(),
          '/submissions/me': { status: 200, body: [draft] },
          [`/submissions/${SID}`]: { status: 200, body: draft },
        },
        captured,
      );
      await gotoReady(page, `/en/volunteer/tasks/${PID}/submit`);
      await page.locator('input[type="file"]').setInputFiles({
        name: 'big.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.alloc(6 * 1024 * 1024),
      });
      await expect(page.getByTestId('file-error')).toHaveText(en.evidence.sizeError);
      expect(captured.find((c) => c.path.endsWith('/media/uploads'))).toBeUndefined();
    });

    test('file upload runs 2-step flow with progress then patches evidence', async ({ page }) => {
      const captured: Captured[] = [];
      let state = draftOf();
      await mockApi(
        page,
        {
          ...sessionHandlers(),
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
      await gotoReady(page, `/en/volunteer/tasks/${PID}/submit`);
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
      await expect.poll(() => captured.find((c) => c.path.endsWith(`/submissions/${SID}`) && c.method === 'PATCH')).toBeTruthy();
      const patch = captured.find((c) => c.path.endsWith(`/submissions/${SID}`) && c.method === 'PATCH');
      expect(patch?.body).toMatchObject({ evidence: [MID] });
      await expect(page.getByTestId('evidence-item')).toHaveCount(1);
    });

    test('allowlisted video link accepted, other host rejected', async ({ page }) => {
      const captured: Captured[] = [];
      let state = draftOf();
      await mockApi(
        page,
        {
          ...sessionHandlers(),
          '/submissions/me': () => ({ status: 200, body: [state] }),
          [`/submissions/${SID}`]: (body) => {
            if (body && typeof body === 'object') state = { ...state, ...(body as object) };
            return { status: 200, body: state };
          },
          '/media/links': { status: 200, body: { mediaId: MID, url: 'https://youtu.be/abc' } },
        },
        captured,
      );
      await gotoReady(page, `/en/volunteer/tasks/${PID}/submit`);
      await page.getByLabel(en.evidence.linkLabel).fill('https://vimeo.com/123');
      await page.getByTestId('link-add').click();
      await expect(page.getByTestId('link-error')).toHaveText(en.evidence.linkHostError);
      expect(captured.find((c) => c.path.endsWith('/media/links'))).toBeUndefined();
      await page.getByLabel(en.evidence.linkLabel).fill('https://youtu.be/abc');
      await page.getByTestId('link-add').click();
      await expect
        .poll(() => captured.find((c) => c.path.endsWith('/media/links') && c.method === 'POST'))
        .toBeTruthy();
      await expect(page.getByTestId('evidence-item')).toHaveCount(1);
    });

    test('submit blocked without consent when imagery present', async ({ page }) => {
      const captured: Captured[] = [];
      const draft = draftOf({ description: 'Cleaned the well', evidence: [MID] });
      await mockApi(
        page,
        {
          ...sessionHandlers(),
          '/submissions/me': { status: 200, body: [draft] },
          [`/submissions/${SID}`]: { status: 200, body: draft },
        },
        captured,
      );
      await gotoReady(page, `/en/volunteer/tasks/${PID}/submit`);
      await expect(page.getByTestId('submit-button')).toBeDisabled();
      expect(
        captured.find((c) => c.path.endsWith(`/submissions/${SID}/submit`)),
      ).toBeUndefined();
    });

    test('draft consents then submits end to end', async ({ page }) => {
      const captured: Captured[] = [];
      let state = draftOf({ description: 'Cleaned the well', evidence: [MID] });
      await mockApi(
        page,
        {
          ...sessionHandlers(),
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
      await gotoReady(page, `/en/volunteer/tasks/${PID}/submit`);
      await page.getByLabel(en.consent.label).check();
      await expect(page.getByTestId('submit-button')).toBeEnabled();
      await page.getByTestId('submit-button').click();
      await expect
        .poll(() => captured.find((c) => c.path.endsWith(`/submissions/${SID}/submit`)))
        .toBeTruthy();
      const submitCall = captured.find((c) => c.path.endsWith(`/submissions/${SID}/submit`));
      expect(submitCall?.body).toMatchObject({ consentConfirmed: true });
      await expect(page.getByTestId('submit-done')).toBeVisible();
    });

    test('rejected shows reason and resubmits', async ({ page }) => {
      const captured: Captured[] = [];
      let state = draftOf({
        description: 'First try',
        evidence: [MID],
        consentConfirmed: true,
        status: 'rejected',
        rejectionReason: 'Add a wider photo.',
      });
      await mockApi(
        page,
        {
          ...sessionHandlers(),
          '/submissions/me': () => ({ status: 200, body: [state] }),
          [`/submissions/${SID}`]: (body) => {
            if (body && typeof body === 'object') {
              state = { ...state, ...(body as object), status: 'draft' };
            }
            return { status: 200, body: state };
          },
          [`/submissions/${SID}/submit`]: () => {
            state = { ...state, status: 'submitted' };
            return { status: 200, body: state };
          },
        },
        captured,
      );
      await gotoReady(page, `/en/volunteer/tasks/${PID}/submit`);
      await expect(page.getByTestId('status-value')).toHaveText(en.status.rejected);
      await expect(page.getByTestId('rejection-reason')).toHaveText('Add a wider photo.');
      await expect(page.getByRole('button', { name: en.submit.resubmitCta })).toBeVisible();
      await page.getByTestId('draft-description').fill('First try, wider photo attached');
      await page.getByLabel(en.consent.label).check();
      await page.getByTestId('submit-button').click();
      await expect
        .poll(() => captured.find((c) => c.path.endsWith(`/submissions/${SID}/submit`)))
        .toBeTruthy();
      await expect(page.getByTestId('submit-done')).toBeVisible();
    });
  });
}
