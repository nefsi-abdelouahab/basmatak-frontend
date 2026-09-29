import { expect, test, type Page, type Route } from '@playwright/test';
import authAr from '../src/messages/auth/ar.json';
import authEn from '../src/messages/auth/en.json';

type Locale = 'en' | 'ar';
const catalogs = { en: authEn, ar: authAr } as const;

const verifiedVolunteer = {
  id: '64f000000000000000000001',
  email: 'vol@example.com',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  role: 'volunteer',
  status: 'active',
};

const unverifiedVolunteer = { ...verifiedVolunteer, emailVerifiedAt: null };

const verifiedOrg = {
  ...verifiedVolunteer,
  email: 'org@example.com',
  role: 'organization',
};

function tokensFor(user: unknown) {
  return { accessToken: 'a', refreshToken: 'r', user };
}

async function mockAuth(
  page: Page,
  handlers: Record<string, { status: number; body?: unknown }>,
) {
  await page.route('**/api/v1/auth/**', async (route: Route) => {
    const url = route.request().url();
    const path = new URL(url).pathname;
    const key = Object.keys(handlers).find((k) => path.endsWith(k));
    if (!key) return route.fulfill({ status: 404, body: '{}' });
    const { status, body } = handlers[key];
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: body === undefined ? '' : JSON.stringify(body),
    });
  });
}

async function loginAs(
  page: Page,
  user: unknown,
  opts?: { next?: string; meUser?: unknown },
) {
  await mockAuth(page, {
    '/auth/login': { status: 200, body: tokensFor(user) },
    '/auth/me': { status: 200, body: opts?.meUser ?? user },
  });
  await page.goto(opts?.next ? `/en/login?next=${encodeURIComponent(opts.next)}` : '/en/login');
  await page.getByLabel(authEn.login.emailLabel).fill('vol@example.com');
  await page.getByLabel(authEn.login.passwordLabel, { exact: true }).fill('s3cret-pass');
  await page.getByRole('button', { name: authEn.login.submit }).click();
}

for (const width of [1440, 1100, 390]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const locale of ['en', 'ar'] as const satisfies Locale[]) {
      test(`login renders, translated, no role selector (${locale})`, async ({ page }) => {
        await page.goto(`/${locale}/login`);
        await expect(page.getByTestId('auth-login')).toBeVisible();
        await expect(
          page.getByTestId('auth-login').getByRole('heading', { level: 1 }),
        ).toHaveText(catalogs[locale].login.title);
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          locale === 'ar' ? 'rtl' : 'ltr',
        );
        await expect(page.getByRole('combobox')).toHaveCount(0);
        await expect(page.getByRole('radio')).toHaveCount(0);
        await expect(page.getByRole('link', { name: catalogs[locale].login.forgot })).toHaveAttribute(
          'href',
          `/${locale}/forgot-password`,
        );
        await expect(
          page.getByRole('link', { name: catalogs[locale].login.createAccount }),
        ).toHaveAttribute('href', `/${locale}/create-account`);
      });

      test(`create-account tabs switch role and side image (${locale})`, async ({ page }) => {
        await page.goto(`/${locale}/create-account`);
        await expect(page.getByTestId('auth-create-account')).toBeVisible();
        const volunteerTab = page.getByTestId('auth-type-volunteer');
        const orgTab = page.getByTestId('auth-type-organization');
        await expect(volunteerTab).toHaveAttribute('aria-pressed', 'true');
        await expect(orgTab).toHaveAttribute('aria-pressed', 'false');
        await expect(page.getByRole('button', { name: catalogs[locale].registerVolunteer.submit }))
          .toBeVisible();
        await expect(page.locator('aside img').first()).toHaveAttribute('srcset', /auth-vol/);

        await orgTab.click();
        await expect(orgTab).toHaveAttribute('aria-pressed', 'true');
        await expect(
          page.getByRole('button', { name: catalogs[locale].registerOrganization.submit }),
        ).toBeVisible();
        await expect(page.locator('aside img').first()).toHaveAttribute('srcset', /auth-org/);
      });

      test(`create-account preselects the organization tab from ?type= (${locale})`, async ({
        page,
      }) => {
        await page.goto(`/${locale}/create-account?type=organization`);
        await expect(page.getByTestId('auth-type-organization')).toHaveAttribute(
          'aria-pressed',
          'true',
        );
        await expect(
          page.getByRole('button', { name: catalogs[locale].registerOrganization.submit }),
        ).toBeVisible();
      });
    }

    test('invalid credentials show inline error', async ({ page }) => {
      await mockAuth(page, {
        '/auth/login': {
          status: 401,
          body: { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid' },
        },
      });
      await page.goto('/en/login');
      await page.getByLabel(authEn.login.emailLabel).fill('vol@example.com');
      await page.getByLabel(authEn.login.passwordLabel, { exact: true }).fill('wrong-pass');
      await page.getByRole('button', { name: authEn.login.submit }).click();
      await expect(page.getByTestId('auth-error')).toHaveText(
        authEn.login.invalidCredentials,
      );
    });

    test('unverified login lands on the verify gate with resend CTA', async ({ page }) => {
      await loginAs(page, unverifiedVolunteer);
      await expect(page).toHaveURL(/\/en\/verify-email\?status=unverified/);
      await expect(page.getByTestId('auth-unverified-gate')).toBeVisible();
    });

    test('organization login redirects to the org dashboard', async ({ page }) => {
      await loginAs(page, verifiedOrg);
      await expect(page).toHaveURL(/\/en\/org\/dashboard/);
    });

    test('guest-continue next param survives login', async ({ page }) => {
      await loginAs(page, verifiedVolunteer, { next: '/en/opportunities' });
      await expect(page).toHaveURL(/\/en\/opportunities/);
    });

    test('volunteer registration shows the verification notice', async ({ page }) => {
      await mockAuth(page, {
        '/auth/register/volunteer': { status: 201, body: tokensFor(unverifiedVolunteer) },
      });
      await page.goto('/en/create-account');
      await page.getByLabel(authEn.registerVolunteer.emailLabel).fill('new@example.com');
      await page.getByLabel(authEn.registerVolunteer.passwordLabel, { exact: true }).fill('s3cret-pass');
      await page.getByRole('button', { name: authEn.registerVolunteer.submit }).click();
      await expect(page.getByTestId('auth-success')).toContainText(
        authEn.registerVolunteer.successTitle,
      );
    });

    test('organization registration shows pending copy', async ({ page }) => {
      await mockAuth(page, {
        '/auth/register/organization': { status: 201, body: tokensFor(unverifiedVolunteer) },
      });
      await page.goto('/en/create-account?type=organization');
      await page.getByLabel(authEn.registerOrganization.emailLabel).fill('org@example.com');
      await page.getByLabel(authEn.registerOrganization.passwordLabel, { exact: true }).fill('s3cret-pass');
      await page
        .getByRole('button', { name: authEn.registerOrganization.submit })
        .click();
      await expect(page.getByTestId('auth-success')).toContainText(
        authEn.registerOrganization.pendingTitle,
      );
    });

    test('password visibility toggle reveals the password', async ({ page }) => {
      await page.goto('/en/login');
      const password = page.getByLabel(authEn.login.passwordLabel, { exact: true });
      await expect(password).toHaveAttribute('type', 'password');
      await page.getByRole('button', { name: authEn.shared.showPassword }).click();
      await expect(password).toHaveAttribute('type', 'text');
    });

    test('forgot password shows neutral success copy', async ({ page }) => {
      await mockAuth(page, { '/auth/forgot-password': { status: 204 } });
      await page.goto('/en/forgot-password');
      await page.getByLabel(authEn.forgotPassword.emailLabel).fill('ghost@example.com');
      await page.getByRole('button', { name: authEn.forgotPassword.submit }).click();
      await expect(page.getByTestId('auth-success')).toContainText(
        authEn.forgotPassword.successTitle,
      );
    });

    test('expired reset token shows the expired state', async ({ page }) => {
      await mockAuth(page, {
        '/auth/reset-password': {
          status: 400,
          body: { statusCode: 400, code: 'INVALID_RESET_TOKEN', message: 'Expired' },
        },
      });
      await page.goto('/en/reset-password?token=stale');
      await page.getByLabel(authEn.resetPassword.newPasswordLabel, { exact: true }).fill('new-s3cret-pass');
      await page.getByLabel(authEn.resetPassword.confirmPasswordLabel, { exact: true }).fill('new-s3cret-pass');
      await page.getByRole('button', { name: authEn.resetPassword.submit }).click();
      await expect(page.getByTestId('auth-reset-expired')).toContainText(
        authEn.resetPassword.expiredTitle,
      );
    });

    test('mismatched reset confirmation blocks the request', async ({ page }) => {
      await mockAuth(page, {
        '/auth/reset-password': { status: 204 },
      });
      await page.goto('/en/reset-password?token=good');
      await page.getByLabel(authEn.resetPassword.newPasswordLabel, { exact: true }).fill('new-s3cret-pass');
      await page.getByLabel(authEn.resetPassword.confirmPasswordLabel, { exact: true }).fill('other-s3cret-pass');
      await page.getByRole('button', { name: authEn.resetPassword.submit }).click();
      await expect(page.getByText(authEn.resetPassword.mismatch)).toBeVisible();
      // No redirect: the request never leaves the form.
      await expect(page).toHaveURL(/\/en\/reset-password\?token=good/);
    });

    test('reset success redirects to sign in with a notice', async ({ page }) => {
      await mockAuth(page, {
        '/auth/reset-password': { status: 204 },
      });
      await page.goto('/en/reset-password?token=good');
      await page.getByLabel(authEn.resetPassword.newPasswordLabel, { exact: true }).fill('new-s3cret-pass');
      await page.getByLabel(authEn.resetPassword.confirmPasswordLabel, { exact: true }).fill('new-s3cret-pass');
      await page.getByRole('button', { name: authEn.resetPassword.submit }).click();
      await expect(page).toHaveURL(/\/en\/login\?status=password-reset/);
      await expect(page.getByText(authEn.login.passwordResetOk)).toBeVisible();
    });

    test('verify-email token success links to sign in', async ({ page }) => {
      await mockAuth(page, { '/auth/verify-email': { status: 204 } });
      await page.goto('/en/verify-email?token=good');
      await expect(page.getByTestId('auth-success')).toContainText(
        authEn.verifyEmail.successTitle,
      );
      await expect(
        page.getByRole('link', { name: authEn.verifyEmail.signInCta }),
      ).toHaveAttribute('href', '/en/login');
    });

    test('throttled resend surfaces the 429 state', async ({ page }) => {
      await mockAuth(page, {
        '/auth/resend-verification': {
          status: 429,
          body: { statusCode: 429, code: 'RATE_LIMITED', message: 'Slow down' },
        },
      });
      await page.goto('/en/verify-email');
      await page.getByRole('button', { name: authEn.verifyEmail.requestNew }).click();
      await expect(page.getByTestId('auth-error')).toHaveText(
        authEn.verifyEmail.rateLimited,
      );
    });
  });
}
