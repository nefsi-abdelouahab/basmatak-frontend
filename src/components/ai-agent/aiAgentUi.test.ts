import { describe, expect, it } from 'vitest';
import type {
  AiAgentError,
  AiAgentStatusResponse,
} from '@/lib/api/aiAgent';
import {
  AI_AGENT_LAUNCHER_SIZE,
  AI_AGENT_LAUNCHER_SIZE_SMALL,
  AiAgentStatusTimeoutError,
  availabilityFor,
  clampLauncherInset,
  clampLauncherY,
  clampLauncherYAboveNav,
  defaultLauncherY,
  detectTextDirection,
  errorMessageKey,
  isQuotaExhaustedError,
  launcherBottomMargin,
  launcherInsetFromRect,
  launcherSizeFor,
  nearestLauncherEdge,
  parseChatContent,
  parseLauncherPosition,
  retryAfterDescriptor,
  safeChatHref,
  safeSourceHref,
  serializeLauncherPosition,
  stripChatLocalePrefix,
  withTimeout,
} from './aiAgentUi';

function status(
  overrides: Partial<AiAgentStatusResponse> = {},
): AiAgentStatusResponse {
  return {
    enabled: true,
    mode: 'normal',
    knowledge: { files: 1, chunks: 2 },
    limits: { messageChars: 2000, historyMessages: 6, historyChars: 4000 },
    ...overrides,
  };
}

function quotaError(): AiAgentError {
  return {
    code: 'AI_AGENT_QUOTA_EXHAUSTED',
  } as AiAgentError;
}

describe('aiAgentUi availability', () => {
  it('maps usable modes to online', () => {
    expect(availabilityFor(status(), 'ready')).toBe('online');
    expect(availabilityFor(status({ mode: 'conservative' }), 'ready')).toBe(
      'online',
    );
  });

  it('maps degraded and exhausted modes to limited', () => {
    for (const mode of [
      'knowledge_only',
      'retrieval_only',
      'exhausted',
    ] as const) {
      expect(availabilityFor(status({ mode }), 'ready')).toBe('limited');
    }
  });

  it('maps disabled, missing, and failed status to offline', () => {
    expect(availabilityFor(status({ enabled: false }), 'ready')).toBe(
      'offline',
    );
    expect(availabilityFor(null, 'ready')).toBe('offline');
    expect(availabilityFor(status(), 'offline')).toBe('offline');
  });

  it('maps loading and timed-out status to waking', () => {
    expect(availabilityFor(null, 'loading')).toBe('waking');
    expect(availabilityFor(status(), 'waking')).toBe('waking');
  });
});

describe('aiAgentUi error copy', () => {
  it('maps known safe error codes', () => {
    expect(errorMessageKey('AI_AGENT_QUOTA_EXHAUSTED')).toBe('quota');
    expect(errorMessageKey('RATE_LIMITED')).toBe('rateLimited');
    expect(errorMessageKey('NETWORK_ERROR')).toBe('network');
    expect(errorMessageKey('AI_AGENT_INTERNAL_ERROR')).toBe('internal');
  });

  it('falls back to generic for unknown or missing codes', () => {
    expect(errorMessageKey('SOMETHING_NEW')).toBe('generic');
    expect(errorMessageKey(undefined)).toBe('generic');
  });

  it('detects only quota exhaustion as a blocking quota error', () => {
    expect(isQuotaExhaustedError(quotaError())).toBe(true);
    expect(
      isQuotaExhaustedError({ code: 'RATE_LIMITED' } as AiAgentError),
    ).toBe(false);
    expect(isQuotaExhaustedError(null)).toBe(false);
  });
});

describe('aiAgentUi retry-after duration', () => {
  it('rejects missing and non-positive values', () => {
    expect(retryAfterDescriptor(undefined)).toBeNull();
    expect(retryAfterDescriptor(0)).toBeNull();
    expect(retryAfterDescriptor(Number.NaN)).toBeNull();
    expect(retryAfterDescriptor(-5)).toBeNull();
  });

  it('uses seconds below a minute', () => {
    expect(retryAfterDescriptor(0.4)).toEqual({ unit: 'seconds', count: 1 });
    expect(retryAfterDescriptor(30)).toEqual({ unit: 'seconds', count: 30 });
    expect(retryAfterDescriptor(58.2)).toEqual({ unit: 'seconds', count: 59 });
    expect(retryAfterDescriptor(59.2)).toEqual({ unit: 'minutes', count: 1 });
  });

  it('rounds up to minutes and hours', () => {
    expect(retryAfterDescriptor(60)).toEqual({ unit: 'minutes', count: 1 });
    expect(retryAfterDescriptor(61)).toEqual({ unit: 'minutes', count: 2 });
    expect(retryAfterDescriptor(3600)).toEqual({ unit: 'hours', count: 1 });
    expect(retryAfterDescriptor(3601)).toEqual({ unit: 'hours', count: 2 });
  });
});

describe('aiAgentUi source paths', () => {
  it('accepts only public internal source routes', () => {
    expect(safeSourceHref('/opportunities')).toBe('/opportunities');
    expect(safeSourceHref('/opportunities/food-drive')).toBe(
      '/opportunities/food-drive',
    );
    expect(safeSourceHref('/orgs/helping-org')).toBe('/orgs/helping-org');
    expect(safeSourceHref('/talents')).toBe('/talents');
    expect(safeSourceHref('/opportunities/food-drive?from=ai')).toBe(
      '/opportunities/food-drive',
    );
  });

  it('rejects unsafe schemes and non-public paths', () => {
    for (const value of [
      '/orgs',
      '/orgs/',
      '/admin',
      '/volunteers/me',
      'javascript:alert(1)',
      'data:text/html,hi',
      '//evil.example/path',
      'https://evil.example/opportunities',
      '\\\\orgs\\\\bad',
      '',
      '   ',
    ]) {
      expect(safeSourceHref(value), value).toBeNull();
    }
    expect(safeSourceHref(undefined)).toBeNull();
  });
});

describe('aiAgentUi chat links', () => {
  it('prefixes public internal links with the current locale', () => {
    expect(safeChatHref('/opportunities/food-drive', 'en')).toBe(
      '/en/opportunities/food-drive',
    );
    expect(safeChatHref('/ar/orgs/helping-org', 'en')).toBe(
      '/en/orgs/helping-org',
    );
    expect(safeChatHref('/volunteers/sara', 'ar')).toBe(
      '/ar/volunteers/sara',
    );
    expect(safeChatHref('/talents', 'en')).toBe('/en/talents');
    expect(safeChatHref('/opportunities', 'ar')).toBe('/ar/opportunities');
  });

  it('collapses repeated locale prefixes into one', () => {
    expect(safeChatHref('/en/en/opportunities/food-drive', 'en')).toBe(
      '/en/opportunities/food-drive',
    );
    expect(safeChatHref('/ar/en/opportunities/food-drive', 'ar')).toBe(
      '/ar/opportunities/food-drive',
    );
    expect(safeChatHref('/en/ar/en/orgs/helping-org', 'en')).toBe(
      '/en/orgs/helping-org',
    );
  });

  it('strips the origin from absolute same-site links', () => {
    expect(
      safeChatHref(
        'http://localhost:3000/en/en/opportunities/food-drive',
        'en',
      ),
    ).toBe('/en/opportunities/food-drive');
    expect(
      safeChatHref(
        'https://basmatak.com/ar/opportunities/food-drive',
        'ar',
      ),
    ).toBe('/ar/opportunities/food-drive');
  });

  it('removes a locale prefix before handing a path to next-intl Link', () => {
    expect(stripChatLocalePrefix('/en/opportunities/food-drive')).toBe(
      '/opportunities/food-drive',
    );
    expect(
      stripChatLocalePrefix('/en/en/opportunities/food-drive'),
    ).toBe('/opportunities/food-drive');
    expect(stripChatLocalePrefix('/ar/talents')).toBe('/talents');
    expect(stripChatLocalePrefix('/')).toBe('/');
  });

  it('rejects external, private, and malformed chat links', () => {
    for (const value of [
      '/orgs',
      '/volunteers/me',
      '/volunteers/settings',
      '/admin',
      'javascript:alert(1)',
      'data:text/html,hi',
      '//evil.example/path',
      'https://evil.example/admin',
      'ftp://evil.example/opportunities',
      '\\\\orgs\\\\bad',
      '/opportunities/../admin',
      '/opportunities/%2e%2e/admin',
      '',
      '   ',
    ]) {
      expect(safeChatHref(value, 'en'), value).toBeNull();
    }
    expect(safeChatHref(undefined, 'en')).toBeNull();
  });

  it('parses Markdown into safe text and app-router link segments', () => {
    expect(
      parseChatContent(
        'See [Beach cleanup](/opportunities/beach-cleanup).',
        'en',
      ),
    ).toEqual([
      { type: 'text', text: 'See ' },
      {
        type: 'link',
        text: 'Beach cleanup',
        href: '/en/opportunities/beach-cleanup',
        kind: 'entity',
      },
      { type: 'text', text: '.' },
    ]);
  });

  it('marks only entity routes as card links', () => {
    expect(
      parseChatContent(
        '[All talents](/talents) and [Food drive](/orgs/helping-org).',
        'en',
      ),
    ).toEqual([
      {
        type: 'link',
        text: 'All talents',
        href: '/en/talents',
        kind: 'inline',
      },
      { type: 'text', text: ' and ' },
      {
        type: 'link',
        text: 'Food drive',
        href: '/en/orgs/helping-org',
        kind: 'entity',
      },
      { type: 'text', text: '.' },
    ]);
  });

  it('turns external and unsafe links into plain text', () => {
    const external = parseChatContent(
      'Visit [example](https://evil.example).',
      'en',
    );
    expect(external).toEqual([
      { type: 'text', text: 'Visit ' },
      { type: 'text', text: 'example' },
      { type: 'text', text: '.' },
    ]);

    const unsafe = parseChatContent(
      'Open [this](javascript:alert(1)).',
      'en',
    );
    expect(unsafe).toEqual([
      { type: 'text', text: 'Open ' },
      { type: 'text', text: 'this' },
      { type: 'text', text: '.' },
    ]);
  });
});

describe('aiAgentUi message direction', () => {
  it('detects Arabic script independently of the UI locale', () => {
    expect(detectTextDirection('مرحبا كيف أساعد؟')).toBe('rtl');
    expect(detectTextDirection('English only')).toBe('ltr');
    expect(detectTextDirection('English with عربي')).toBe('rtl');
    expect(detectTextDirection('')).toBe('ltr');
  });
});

describe('aiAgentUi status timeout', () => {
  it('resolves a fast status request', async () => {
    await expect(withTimeout(Promise.resolve('ready'), 50)).resolves.toBe(
      'ready',
    );
  });

  it('rejects a slow status request with a typed timeout', async () => {
    const slow = new Promise<string>((resolve) => {
      setTimeout(() => resolve('late'), 30);
    });
    await expect(withTimeout(slow, 5)).rejects.toBeInstanceOf(
      AiAgentStatusTimeoutError,
    );
  });

  it('leaves the operation untouched when no timeout is requested', async () => {
    await expect(withTimeout(Promise.resolve(7), 0)).resolves.toBe(7);
  });
});

describe('aiAgentUi launcher geometry', () => {
  it('uses a 52 px launcher on small screens and 56 px above', () => {
    expect(launcherSizeFor(390)).toBe(AI_AGENT_LAUNCHER_SIZE_SMALL);
    expect(launcherSizeFor(639)).toBe(AI_AGENT_LAUNCHER_SIZE_SMALL);
    expect(launcherSizeFor(640)).toBe(AI_AGENT_LAUNCHER_SIZE);
  });

  it('clamps vertical positions inside the safe viewport', () => {
    expect(clampLauncherY(0, 800, 56)).toBe(16);
    expect(clampLauncherY(799, 800, 56)).toBe(728);
    expect(clampLauncherY(200, 800, 56)).toBe(200);
    expect(defaultLauncherY(800, 56)).toBe(720);
  });

  it('reserves the bottom navigation below the lg breakpoint', () => {
    expect(launcherBottomMargin(390)).toBe(96);
    expect(launcherBottomMargin(1023)).toBe(96);
    expect(launcherBottomMargin(1024)).toBe(24);
    expect(launcherBottomMargin(1440)).toBe(24);

    expect(defaultLauncherY(800, 52, 390)).toBe(652);
    expect(defaultLauncherY(800, 56, 1280)).toBe(720);
    expect(clampLauncherYAboveNav(799, 800, 52, 390)).toBe(652);
    expect(clampLauncherYAboveNav(799, 800, 56, 1280)).toBe(728);
  });

  it('clamps horizontal insets on both edges', () => {
    expect(clampLauncherInset(0, 390, 52)).toBe(16);
    expect(clampLauncherInset(400, 390, 52)).toBe(322);
    expect(clampLauncherInset(100, 390, 52)).toBe(100);
  });

  it('maps the nearest physical edge to a logical edge', () => {
    expect(nearestLauncherEdge(50, 390, false)).toBe('start');
    expect(nearestLauncherEdge(300, 390, false)).toBe('end');
    expect(nearestLauncherEdge(50, 390, true)).toBe('end');
    expect(nearestLauncherEdge(300, 390, true)).toBe('start');
  });

  it('measures the inline-start inset in both directions', () => {
    expect(
      launcherInsetFromRect({ left: 20, right: 72 }, 390, false),
    ).toBe(20);
    expect(
      launcherInsetFromRect({ left: 318, right: 370 }, 390, true),
    ).toBe(20);
  });
});

describe('aiAgentUi launcher persistence', () => {
  const viewport = { width: 390, height: 800 };

  it('round-trips a valid position', () => {
    const raw = serializeLauncherPosition({ edge: 'start', y: 120.4 });
    expect(raw).toContain('"version":1');
    expect(parseLauncherPosition(raw, viewport)).toEqual({
      edge: 'start',
      y: 120,
    });
  });

  it('clamps a partially visible stored position', () => {
    const raw = JSON.stringify({ version: 1, edge: 'end', y: -10 });
    expect(parseLauncherPosition(raw, viewport)).toEqual({
      edge: 'end',
      y: 16,
    });
  });

  it('resets fully off-screen or malformed positions', () => {
    for (const raw of [
      JSON.stringify({ version: 1, edge: 'end', y: 9999 }),
      JSON.stringify({ version: 1, edge: 'end', y: -100 }),
      JSON.stringify({ version: 2, edge: 'end', y: 100 }),
      JSON.stringify({ version: 1, edge: 'left', y: 100 }),
      JSON.stringify({ version: 1, edge: 'end', y: Number.NaN }),
      'not-json',
      '[]',
      '{}',
      null,
    ]) {
      expect(parseLauncherPosition(raw, viewport), String(raw)).toBeNull();
    }
  });
});
