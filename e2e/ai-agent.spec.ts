import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../src/messages/ai-agent/en.json';
import ar from '../src/messages/ai-agent/ar.json';

type Locale = 'en' | 'ar';
type Role = 'volunteer' | 'organization' | 'admin' | 'guest';

const catalogs = { en, ar } as const;

const USERS: Record<Exclude<Role, 'guest'>, Record<string, unknown>> = {
  volunteer: {
    id: '64f0000000000000000000v1',
    email: 'vol@example.com',
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    role: 'volunteer',
    status: 'active',
  },
  organization: {
    id: '64f0000000000000000000o1',
    email: 'org@example.com',
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    role: 'organization',
    status: 'active',
  },
  admin: {
    id: '64f0000000000000000000ad',
    email: 'admin@example.com',
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    role: 'admin',
    status: 'active',
  },
};

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  'access-control-max-age': '600',
};

const STATUS = {
  enabled: true,
  mode: 'normal',
  knowledge: { files: 4, chunks: 42 },
  limits: { messageChars: 2000, historyMessages: 4, historyChars: 2400 },
};

const ANSWER = {
  en: 'You can help at the community food drive.',
  ar: 'يمكنك المساعدة في حملة الطعام المجتمعية.',
} as const;

const ANSWER_MARKUP = {
  en: 'You can help at the [community food drive](/en/opportunities/food-drive).',
  ar: 'يمكنك المساعدة في [حملة الطعام المجتمعية](/ar/opportunities/food-drive).',
} as const;

const CARD_TITLE = {
  en: 'Community food drive',
  ar: 'حملة الطعام المجتمعية',
} as const;

const ARABIC_PROMPT = 'كيف يمكنني التطوع؟';

function sseBody(
  events: Array<{ event: string; data: unknown }>,
): string {
  return events
    .map(
      (frame) =>
        `event: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`,
    )
    .join('');
}

function successStream(locale: Locale): string {
  return sseBody([
    {
      event: 'meta',
      data: { conversationId: 'conv-1', locale, mode: 'normal' },
    },
    { event: 'status', data: { state: 'searching' } },
    { event: 'token', data: { delta: ANSWER_MARKUP[locale] } },
    {
      event: 'cards',
      data: {
        cards: [
          {
            kind: 'opportunity',
            slug: 'food-drive',
            title: CARD_TITLE[locale],
            href: `/${locale}/opportunities/food-drive`,
          },
        ],
      },
    },
    { event: 'done', data: { finishReason: 'stop' } },
  ]);
}

function errorStream(code: string, retryAfterSeconds?: number): string {
  return sseBody([
    {
      event: 'error',
      data: {
        code,
        message: 'safe placeholder',
        ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
      },
    },
  ]);
}

interface MockOptions {
  role?: Role;
  status?: 'online' | 'offline' | 'cold' | 'exhausted';
  chat?: 'success' | 'error' | 'quota' | 'delayed';
  locale?: Locale;
}

interface MockResult {
  statusCalls(): number;
  chatBodies: Array<Record<string, unknown>>;
}

function corsHeaders(
  contentType?: string,
): Record<string, string> {
  return {
    ...CORS_HEADERS,
    ...(contentType !== undefined ? { 'content-type': contentType } : {}),
  };
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    headers: corsHeaders('application/json'),
    body: JSON.stringify(body),
  });
}

function sse(route: Route, body: string) {
  return route.fulfill({
    status: 200,
    headers: corsHeaders('text/event-stream; charset=utf-8'),
    body,
  });
}

async function mockApi(
  page: Page,
  options: MockOptions = {},
): Promise<MockResult> {
  const role = options.role ?? 'guest';
  const statusMode = options.status ?? 'online';
  const chatMode = options.chat ?? 'success';
  const locale = options.locale ?? 'en';

  let statusCalls = 0;
  let chatCalls = 0;
  const chatBodies: Array<Record<string, unknown>> = [];

  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }

    const path = new URL(request.url()).pathname;

    if (path.endsWith('/auth/me')) {
      if (role === 'guest') {
        return json(
          route,
          { code: 'UNAUTHORIZED', message: 'not signed in' },
          401,
        );
      }
      return json(route, USERS[role]);
    }

    if (path.endsWith('/ai-agent/status')) {
      statusCalls += 1;
      if (statusMode === 'offline') {
        return json(
          route,
          { code: 'AI_AGENT_DISABLED', message: 'offline' },
          503,
        );
      }
      if (statusMode === 'cold') {
        // Let the client's 10s timeout fire before the server wakes up.
        await new Promise((resolve) => setTimeout(resolve, 11_000));
      }
      return json(route, {
        ...STATUS,
        ...(statusMode === 'exhausted' ? { mode: 'exhausted' } : {}),
      });
    }

    if (path.endsWith('/ai-agent/chat')) {
      chatCalls += 1;
      const body = request.postDataJSON() as Record<string, unknown>;
      chatBodies.push(body);

      if (chatMode === 'quota') {
        return sse(
          route,
          errorStream('AI_AGENT_QUOTA_EXHAUSTED', 90),
        );
      }

      if (chatMode === 'error') {
        if (chatCalls === 1) {
          return sse(
            route,
            errorStream('AI_AGENT_STREAM_INTERRUPTED'),
          );
        }
        return sse(route, successStream(locale));
      }

      if (chatMode === 'delayed') {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        try {
          return await sse(route, successStream(locale));
        } catch {
          // The user stopped the request and the route may already be gone.
          return undefined;
        }
      }

      return sse(route, successStream(locale));
    }

    return json(route, {}, 404);
  });

  return {
    statusCalls: () => statusCalls,
    chatBodies,
  };
}

function launcher(page: Page, locale: Locale = 'en') {
  return page.getByRole('button', {
    name: catalogs[locale].launcher.open,
  });
}

async function openPanel(page: Page, locale: Locale = 'en') {
  await launcher(page, locale).click();
  const panel = page.getByTestId('ai-agent-panel');
  await expect(panel).toBeVisible();
  return panel;
}

async function sendMessage(
  page: Page,
  text: string,
  locale: Locale = 'en',
) {
  await page.getByTestId('ai-agent-input').fill(text);
  await page
    .getByRole('button', { name: catalogs[locale].composer.send })
    .click();
}

test.describe('launcher availability', () => {
  for (const fixture of [
    { role: 'guest' as const, path: '/en' },
    { role: 'volunteer' as const, path: '/en/volunteer/dashboard' },
    { role: 'organization' as const, path: '/en/org/dashboard' },
    { role: 'admin' as const, path: '/en/admin/dashboard' },
  ]) {
    test(`launcher is present for ${fixture.role}`, async ({ page }) => {
      await mockApi(page, { role: fixture.role });
      await page.goto(fixture.path);

      const button = launcher(page);
      await expect(button).toBeVisible({ timeout: 15_000 });
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await expect(button).toHaveAttribute(
        'aria-controls',
        'ai-agent-panel',
      );
    });
  }
});

test.describe('assistant panel', () => {
  test('checks status on mount/open, chats, renders safe entity links, and closes', async ({
    page,
  }) => {
    const mock = await mockApi(page);
    await page.goto('/en');

    const button = launcher(page);
    await expect(button).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => mock.statusCalls()).toBe(1);

    // Status is not polled while the panel stays closed.
    await page.waitForTimeout(1_200);
    expect(mock.statusCalls()).toBe(1);

    const panel = await openPanel(page);
    await expect.poll(() => mock.statusCalls()).toBe(2);
    await expect(
      panel.getByText(catalogs.en.status.online),
    ).toBeVisible();

    await sendMessage(page, 'Where can I volunteer?');
    await expect(panel.getByText(ANSWER.en)).toBeVisible();

    const opportunity = panel.getByRole('link', {
      name: /Community food drive/,
    });
    await expect(opportunity).toHaveAttribute(
      'href',
      '/en/opportunities/food-drive',
    );

    await expect(panel.getByTestId('ai-agent-cards')).toBeVisible();
    await expect(panel.getByText(CARD_TITLE.en)).toBeVisible();
    await expect(
      panel.getByRole('link', { name: /View opportunity/ }),
    ).toHaveAttribute('href', '/en/opportunities/food-drive');

    expect(mock.chatBodies[0]).toMatchObject({
      message: 'Where can I volunteer?',
      locale: 'en',
    });

    await panel
      .getByRole('button', { name: catalogs.en.panel.close })
      .click();
    await expect(panel).toHaveCount(0);
    await expect(button).toBeFocused();

    await openPanel(page);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('ai-agent-panel')).toHaveCount(0);
  });

  test('keeps Arabic RTL copy, direction, and the ar chat locale', async ({
    page,
  }) => {
    const mock = await mockApi(page, { locale: 'ar' });
    await page.goto('/ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    const panel = await openPanel(page, 'ar');
    await expect(
      panel.getByRole('heading', { name: catalogs.ar.panel.title }),
    ).toBeVisible();
    await expect(panel.getByText(catalogs.ar.status.online)).toBeVisible();

    await sendMessage(page, ARABIC_PROMPT, 'ar');
    await expect(panel.getByText(ANSWER.ar)).toBeVisible();

    const answer = panel.getByText(ANSWER.ar);
    await expect(answer).toHaveAttribute('dir', 'auto');
    await expect(
      panel.getByRole('link', { name: /حملة الطعام المجتمعية/ }),
    ).toHaveAttribute('href', '/ar/opportunities/food-drive');

    await expect(panel.getByTestId('ai-agent-cards')).toBeVisible();
    await expect(panel.getByText(CARD_TITLE.ar)).toBeVisible();
    await expect(
      panel.getByRole('link', { name: /عرض الفرصة/ }),
    ).toHaveAttribute('href', '/ar/opportunities/food-drive');
    expect(mock.chatBodies[0]).toMatchObject({
      message: ARABIC_PROMPT,
      locale: 'ar',
    });
  });

  test('recovers with retry after a stream error', async ({ page }) => {
    const mock = await mockApi(page, { chat: 'error' });
    await page.goto('/en');
    const panel = await openPanel(page);

    await sendMessage(page, 'Try this question');
    await expect(
      panel.getByText(catalogs.en.message.errorTitle),
    ).toBeVisible();
    await expect(
      panel.getByText(catalogs.en.errors.interrupted),
    ).toBeVisible();

    await panel
      .getByRole('button', { name: catalogs.en.message.retry })
      .click();
    await expect(panel.getByText(ANSWER.en)).toBeVisible();
    await expect(
      panel.getByText(catalogs.en.message.errorTitle),
    ).toHaveCount(0);
    expect(mock.chatBodies).toHaveLength(2);
    expect(mock.chatBodies[1]?.message).toBe('Try this question');
  });

  test('blocks on a quota error and rechecks status', async ({ page }) => {
    await mockApi(page, { chat: 'quota' });
    await page.goto('/en');
    const panel = await openPanel(page);

    await sendMessage(page, 'One more question');
    await expect(
      panel.getByText(catalogs.en.banners.quota.title),
    ).toBeVisible();
    await expect(
      panel.getByText('The limit resets in 2 minutes.'),
    ).toBeVisible();
    const input = page.getByTestId('ai-agent-input');
    await expect(input).toBeDisabled();

    await panel
      .getByRole('button', { name: catalogs.en.banners.retry })
      .click();
    await expect(input).toBeEnabled();
    await expect(
      panel.getByText(catalogs.en.banners.quota.title),
    ).toHaveCount(0);
  });

  test('stops a streaming answer', async ({ page }) => {
    await mockApi(page, { chat: 'delayed' });
    await page.goto('/en');
    const panel = await openPanel(page);

    await sendMessage(page, 'A slow question');
    await page
      .getByRole('button', { name: catalogs.en.composer.stop })
      .click();

    await expect(
      panel.getByText(catalogs.en.message.stopped, { exact: true }),
    ).toBeVisible();
    await expect(
      panel.getByRole('button', { name: catalogs.en.message.retry }),
    ).toBeVisible();
    await expect(page.getByTestId('ai-agent-input')).toBeEnabled();
  });

  test('shows the offline banner when status fails', async ({ page }) => {
    await mockApi(page, { status: 'offline' });
    await page.goto('/en');
    const panel = await openPanel(page);

    await expect(
      panel.getByText(catalogs.en.banners.offline.title),
    ).toBeVisible();
    await expect(page.getByTestId('ai-agent-input')).toBeDisabled();
  });

  test('turns a status timeout into waking, never offline', async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await mockApi(page, { status: 'cold' });
    await page.goto('/en');

    const panel = await openPanel(page);
    await expect(
      panel.getByText(catalogs.en.banners.waking.title),
    ).toBeVisible();

    const retry = panel.getByRole('button', {
      name: catalogs.en.banners.retry,
    });
    await expect(retry).toBeDisabled();
    await expect(retry).toBeEnabled({ timeout: 12_000 });
    await expect(
      panel.getByText(catalogs.en.banners.waking.title),
    ).toBeVisible();
    await expect(
      panel.getByText(catalogs.en.banners.offline.title),
    ).toHaveCount(0);
  });
});

test.describe('drag persistence', () => {
  test('drags to the logical start edge and restores the position', async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto('/en');

    const button = launcher(page);
    await expect(button).toBeVisible({ timeout: 15_000 });

    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;

    await page.mouse.move(
      box.x + box.width / 2,
      box.y + box.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(36, 260, { steps: 8 });
    await page.mouse.up();

    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem(
            'basmatak.aiAgent.launcherPosition',
          ),
        ),
      )
      .toContain('"edge":"start"');
    await expect(page.getByTestId('ai-agent-panel')).toHaveCount(0);
    await expect
      .poll(() =>
        button.evaluate(
          (element) => (element as HTMLElement).style.insetInlineStart,
        ),
      )
      .toBe('16px');

    await page.reload();
    await expect(button).toBeVisible();
    await expect
      .poll(() =>
        button.evaluate(
          (element) => (element as HTMLElement).style.insetInlineStart,
        ),
      )
      .toBe('16px');
  });
});

test.describe('mobile sheet', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('is modal, traps focus, locks scroll, and closes with Escape', async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto('/en');
    const panel = await openPanel(page);

    await expect(panel).toHaveAttribute('aria-modal', 'true');
    await page.waitForTimeout(300);
    const box = await panel.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(389);
    expect(box?.height).toBeGreaterThanOrEqual(799);
    expect(
      await page.evaluate(() => document.body.style.overflow),
    ).toBe('hidden');

    const close = panel.getByRole('button', {
      name: catalogs.en.panel.close,
    });
    const input = page.getByTestId('ai-agent-input');
    await expect(close).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(input).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    expect(
      await page.evaluate(() => document.body.style.overflow),
    ).toBe('');
  });
});
