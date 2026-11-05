import { describe, expect, it, vi } from 'vitest';
import {
  AI_AGENT_HISTORY_CHARS,
  AI_AGENT_MESSAGE_CHARS,
  AiAgentError,
  getAiAgentStatus,
  normalizeAiAgentLocale,
  streamChat,
  type AiAgentChatRequest,
  type AiAgentCardsEvent,
  type AiAgentLiveEvent,
  type AiAgentMetaEvent,
  type AiAgentSourcesEvent,
  type AiAgentStatusResponse,
  type AiAgentUsage,
} from './aiAgent';

const meta: AiAgentMetaEvent = {
  conversationId: '11111111-1111-4111-8111-111111111111',
  locale: 'en',
  mode: 'normal',
};

const sources: AiAgentSourcesEvent = {
  knowledge: [
    {
      id: 'K1',
      title: 'About Basmatak',
      source: 'knowledge/about.md',
      heading: 'Mission',
    },
  ],
  data: [
    {
      id: 'T1-1',
      citationId: 'T1',
      type: 'opportunity',
      title: 'Volunteer opportunity',
      path: '/opportunities/abc',
    },
  ],
};

const cards: AiAgentCardsEvent = {
  cards: [
    {
      kind: 'opportunity',
      slug: 'beach-cleanup',
      title: 'Beach cleanup',
      organizationName: { ar: 'الأرض الخضراء', fr: 'Green Earth' },
      openPositions: 2,
      href: '/en/opportunities/beach-cleanup',
    },
    {
      kind: 'stats',
      publishedOpportunities: 11,
      verifiedOrganizations: 4,
      activeSkills: 9,
      wilayas: 58,
      municipalities: 1541,
    },
  ],
};

const usage: AiAgentUsage = {
  inputTokens: 100,
  outputTokens: 50,
  totalTokens: 150,
  estimated: false,
};

const statusFixture: AiAgentStatusResponse = {
  enabled: true,
  mode: 'normal',
  knowledge: { files: 8, chunks: 64 },
  limits: {
    messageChars: 2000,
    historyMessages: 6,
    historyChars: 4000,
  },
};

function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sseResponse(
  chunks: Array<string | Uint8Array>,
  headers: HeadersInit = { 'Content-Type': 'text/event-stream; charset=utf-8' },
): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(
          typeof chunk === 'string' ? encoder.encode(chunk) : chunk,
        );
      }
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers });
}

function abortableSseResponse(
  chunks: Array<string | Uint8Array>,
  signal: AbortSignal,
): Response {
  const encoder = new TextEncoder();
  let onAbort: (() => void) | undefined;

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(
          typeof chunk === 'string' ? encoder.encode(chunk) : chunk,
        );
      }
      onAbort = () => {
        try {
          controller.error(new DOMException('Aborted', 'AbortError'));
        } catch {
          // The consumer may already have cancelled the stream.
        }
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    },
    cancel() {
      if (onAbort !== undefined) signal.removeEventListener('abort', onAbort);
    },
  });

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
  });
}

function mockFetch(
  handler: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response>,
): { fetchImpl: typeof fetch; mock: ReturnType<typeof vi.fn> } {
  const mock = vi.fn(handler);
  return { fetchImpl: mock as unknown as typeof fetch, mock };
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected promise to reject');
}

describe('getAiAgentStatus', () => {
  it('fetches and parses the public status shape', async () => {
    const get = vi.fn(async () => ({ data: statusFixture }));
    const status = await getAiAgentStatus(
      { get } as unknown as Parameters<typeof getAiAgentStatus>[0],
    );

    expect(get).toHaveBeenCalledWith('/ai-agent/status');
    expect(status).toEqual(statusFixture);
  });
});

describe('streamChat request', () => {
  it('sends POST, SSE headers, and JSON without an Authorization header', async () => {
    const { fetchImpl, mock } = mockFetch(async () =>
      sseResponse([frame('done', { finishReason: 'stop' })]),
    );

    await streamChat(
      { message: 'What is Basmatak?', locale: 'en' },
      { fetchImpl, baseURL: 'http://localhost:3000/api/v1/' },
    );

    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0] ?? [];
    expect(url).toBe('http://localhost:3000/api/v1/ai-agent/chat');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    });
    expect(init?.headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(String(init?.body))).toEqual({
      message: 'What is Basmatak?',
      locale: 'en',
    });
  });

  it('includes history when it is present', async () => {
    const { fetchImpl, mock } = mockFetch(async () =>
      sseResponse([frame('done', { finishReason: 'stop' })]),
    );
    const history = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi' },
    ];

    await streamChat(
      { message: 'Follow-up', locale: 'ar', history },
      { fetchImpl, baseURL: 'http://test.local/api/v1' },
    );

    const [, init] = mock.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      message: 'Follow-up',
      locale: 'ar',
      history,
    });
  });
});

describe('streamChat success', () => {
  it('streams meta, status, sources, tokens, and done in order', async () => {
    const events: AiAgentLiveEvent[] = [];
    const { fetchImpl } = mockFetch(async () =>
      sseResponse([
        frame('meta', meta),
        frame('status', { state: 'searching' }),
        frame('status', { state: 'tool', tool: 'opportunity_search' }),
        frame('sources', sources),
        frame('token', { delta: 'Hello ' }),
        frame('token', { delta: '[K1]' }),
        frame('done', { finishReason: 'stop', usage }),
      ]),
    );

    const result = await streamChat(
      { message: 'What is Basmatak?', locale: 'en' },
      { fetchImpl, onEvent: (event) => events.push(event) },
    );

    expect(result).toEqual({
      text: 'Hello [K1]',
      meta,
      sources,
      done: { finishReason: 'stop', usage },
      aborted: false,
    });
    expect(events.map((event) => event.event)).toEqual([
      'meta',
      'status',
      'status',
      'sources',
      'token',
      'token',
    ]);
    expect(events[0]).toEqual({ event: 'meta', data: meta });
    expect(events[3]).toEqual({ event: 'sources', data: sources });
  });

  it('parses one cards event after tokens and exposes it on the result', async () => {
    const events: AiAgentLiveEvent[] = [];
    const { fetchImpl } = mockFetch(async () =>
      sseResponse([
        frame('meta', meta),
        frame('status', { state: 'answering' }),
        frame('token', { delta: 'See [Beach cleanup]' }),
        frame('cards', cards),
        frame('done', { finishReason: 'stop' }),
      ]),
    );

    const result = await streamChat(
      { message: 'Show me opportunities', locale: 'en' },
      { fetchImpl, onEvent: (event) => events.push(event) },
    );

    expect(result.text).toBe('See [Beach cleanup]');
    expect(result.cards).toEqual(cards);
    expect(events.map((event) => event.event)).toEqual([
      'meta',
      'status',
      'token',
      'cards',
    ]);
    expect(events[3]).toEqual({ event: 'cards', data: cards });
  });

  it('ignores invalid cards payloads and more than six cards', async () => {
    const sevenCards = {
      cards: Array.from({ length: 7 }, (_, index) => ({
        kind: 'opportunity',
        slug: `opportunity-${index + 1}`,
        title: `Opportunity ${index + 1}`,
        href: `/en/opportunities/opportunity-${index + 1}`,
      })),
    };
    const { fetchImpl } = mockFetch(async () =>
      sseResponse([
        frame('cards', sevenCards),
        frame('cards', {
          cards: [{ kind: 'unknown', title: 'Nope' }],
        }),
        frame('token', { delta: 'ok' }),
        frame('done', { finishReason: 'stop' }),
      ]),
    );

    const result = await streamChat(
      { message: 'Cards', locale: 'en' },
      { fetchImpl },
    );

    expect(result.text).toBe('ok');
    expect(result.cards).toBeUndefined();
  });

  it('parses split CRLF frames through the streaming transport', async () => {
    const stream = [
      frame('meta', meta).replace(/\n/g, '\r\n'),
      frame('token', { delta: 'A' }).replace(/\n/g, '\r\n'),
      frame('token', { delta: 'B' }).replace(/\n/g, '\r\n'),
      frame('done', { finishReason: 'stop' }).replace(/\n/g, '\r\n'),
    ].join('');
    const firstCr = stream.indexOf('\r');
    const chunks = [
      stream.slice(0, firstCr + 1),
      stream.slice(firstCr + 1, Math.floor(stream.length / 2)),
      stream.slice(Math.floor(stream.length / 2)),
    ];
    const { fetchImpl } = mockFetch(async () => sseResponse(chunks));

    const result = await streamChat(
      { message: 'Split', locale: 'en' },
      { fetchImpl },
    );

    expect(result.text).toBe('AB');
    expect(result.meta).toEqual(meta);
    expect(result.done).toEqual({ finishReason: 'stop' });
  });

  it('ignores malformed JSON, unknown events, and invalid known payloads', async () => {
    const events: AiAgentLiveEvent[] = [];
    const { fetchImpl } = mockFetch(async () =>
      sseResponse([
        'event: token\ndata: not-json\n\n',
        frame('mystery', { anything: true }),
        frame('status', { state: 'not-a-real-state' }),
        'event: token\ndata: {"delta":42}\n\n',
        frame('token', { delta: 'ok' }),
        frame('done', { finishReason: 'stop' }),
      ]),
    );

    const result = await streamChat(
      { message: 'Malformed', locale: 'en' },
      { fetchImpl, onEvent: (event) => events.push(event) },
    );

    expect(result.text).toBe('ok');
    expect(result.done).toEqual({ finishReason: 'stop' });
    expect(events).toEqual([{ event: 'token', data: { delta: 'ok' } }]);
  });

  it('does not call onEvent for done or error', async () => {
    const events: AiAgentLiveEvent[] = [];
    const { fetchImpl } = mockFetch(async () =>
      sseResponse([frame('done', { finishReason: 'stop' })]),
    );

    await streamChat(
      { message: 'Done', locale: 'en' },
      { fetchImpl, onEvent: (event) => events.push(event) },
    );

    expect(events).toEqual([]);
  });

  it('keeps finishReason length for the hook to mark truncated', async () => {
    const { fetchImpl } = mockFetch(async () =>
      sseResponse([frame('done', { finishReason: 'length' })]),
    );

    const result = await streamChat(
      { message: 'Length', locale: 'en' },
      { fetchImpl },
    );

    expect(result.done).toEqual({ finishReason: 'length' });
  });
});

describe('streamChat errors', () => {
  it('maps a pre-stream 429 envelope and keeps details.retryAfterSeconds authoritative', async () => {
    const rawProviderMessage =
      'Gemini provider failed with API key AIzaFAKEKEY and a stack trace';
    const { fetchImpl } = mockFetch(async () =>
      new Response(
        JSON.stringify({
          statusCode: 429,
          code: 'RATE_LIMITED',
          message: rawProviderMessage,
          details: { reason: 'ip_minute', retryAfterSeconds: 30 },
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '99',
          },
        },
      ),
    );

    const error = await rejectionOf(
      streamChat(
        { message: 'Hello', locale: 'en' },
        { fetchImpl },
      ),
    );

    expect(error).toBeInstanceOf(AiAgentError);
    const agentError = error as AiAgentError;
    expect(agentError.code).toBe('RATE_LIMITED');
    expect(agentError.statusCode).toBe(429);
    expect(agentError.retryAfterSeconds).toBe(30);
    expect(agentError.message).not.toContain('Gemini');
    expect(agentError.message).not.toContain('AIza');
    expect(agentError.userMessage).not.toContain('Gemini');
    expect(agentError.userMessage).not.toContain('AIza');
  });

  it('falls back to Retry-After when details do not carry a retry hint', async () => {
    const { fetchImpl } = mockFetch(async () =>
      new Response(
        JSON.stringify({ statusCode: 429, code: 'AI_AGENT_BUSY' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '12',
          },
        },
      ),
    );

    const error = (await rejectionOf(
      streamChat({ message: 'Hello', locale: 'en' }, { fetchImpl }),
    )) as AiAgentError;

    expect(error.code).toBe('AI_AGENT_BUSY');
    expect(error.retryAfterSeconds).toBe(12);
  });

  it('maps the 503 kill switch to safe copy', async () => {
    const { fetchImpl } = mockFetch(async () =>
      new Response(
        JSON.stringify({
          statusCode: 503,
          code: 'AI_AGENT_DISABLED',
          message: 'Gemini API key AIzaFAKEKEY is disabled',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const error = (await rejectionOf(
      streamChat({ message: 'Hello', locale: 'en' }, { fetchImpl }),
    )) as AiAgentError;

    expect(error.code).toBe('AI_AGENT_DISABLED');
    expect(error.message).toContain('Basma');
    expect(error.message).toMatch(/temporarily unavailable/i);
    expect(error.message).not.toContain('Gemini');
    expect(error.message).not.toContain('AIza');
  });

  it('throws an in-stream error immediately with partial state', async () => {
    const events: AiAgentLiveEvent[] = [];
    const { fetchImpl } = mockFetch(async () =>
      sseResponse([
        frame('meta', meta),
        frame('sources', sources),
        frame('token', { delta: 'Partial answer' }),
        frame('error', {
          code: 'AI_AGENT_QUOTA_EXHAUSTED',
          message: 'Gemini API key AIzaFAKEKEY quota detail',
          retryAfterSeconds: 30,
        }),
      ]),
    );

    const error = (await rejectionOf(
      streamChat(
        { message: 'Hello', locale: 'en' },
        { fetchImpl, onEvent: (event) => events.push(event) },
      ),
    )) as AiAgentError;

    expect(error).toBeInstanceOf(AiAgentError);
    expect(error.code).toBe('AI_AGENT_QUOTA_EXHAUSTED');
    expect(error.statusCode).toBe(200);
    expect(error.retryAfterSeconds).toBe(30);
    expect(error.partialText).toBe('Partial answer');
    expect(error.meta).toEqual(meta);
    expect(error.sources).toEqual(sources);
    expect(error.message).not.toContain('Gemini');
    expect(error.message).not.toContain('AIza');
    expect(events.map((event) => event.event)).toEqual([
      'meta',
      'sources',
      'token',
    ]);
  });

  it('treats a malformed error frame as an interrupted stream', async () => {
    const { fetchImpl } = mockFetch(async () =>
      sseResponse([
        frame('token', { delta: 'Partial' }),
        'event: error\ndata: not-json\n\n',
      ]),
    );

    const error = (await rejectionOf(
      streamChat({ message: 'Hello', locale: 'en' }, { fetchImpl }),
    )) as AiAgentError;

    expect(error.code).toBe('AI_AGENT_STREAM_INTERRUPTED');
    expect(error.partialText).toBe('Partial');
  });

  it('turns EOF without done into an interrupted-stream error', async () => {
    const { fetchImpl } = mockFetch(async () =>
      sseResponse([
        frame('meta', meta),
        frame('token', { delta: 'Partial answer' }),
      ]),
    );

    const error = (await rejectionOf(
      streamChat({ message: 'Hello', locale: 'en' }, { fetchImpl }),
    )) as AiAgentError;

    expect(error.code).toBe('AI_AGENT_STREAM_INTERRUPTED');
    expect(error.partialText).toBe('Partial answer');
    expect(error.meta).toEqual(meta);
  });

  it('maps network failures without exposing the raw error', async () => {
    const { fetchImpl } = mockFetch(async () => {
      throw new Error('Gemini API key AIzaFAKEKEY could not connect');
    });

    const error = (await rejectionOf(
      streamChat({ message: 'Hello', locale: 'en' }, { fetchImpl }),
    )) as AiAgentError;

    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).not.toContain('Gemini');
    expect(error.message).not.toContain('AIza');
  });

  it('rejects a non-SSE content type safely', async () => {
    const { fetchImpl } = mockFetch(async () =>
      new Response('not a stream', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const error = (await rejectionOf(
      streamChat({ message: 'Hello', locale: 'en' }, { fetchImpl }),
    )) as AiAgentError;

    expect(error.code).toBe('AI_AGENT_INVALID_RESPONSE');
    expect(error.message).not.toContain('not a stream');
  });
});

describe('streamChat abort', () => {
  it('resolves with partial text when aborted mid-stream', async () => {
    const controller = new AbortController();
    let tokenSeenResolve: (() => void) | undefined;
    const tokenSeen = new Promise<void>((resolve) => {
      tokenSeenResolve = resolve;
    });
    const { fetchImpl } = mockFetch(async (_input, init) =>
      abortableSseResponse(
        [frame('meta', meta), frame('token', { delta: 'Partial' })],
        init?.signal as AbortSignal,
      ),
    );

    const promise = streamChat(
      { message: 'Hello', locale: 'en' },
      {
        fetchImpl,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.event === 'token') tokenSeenResolve?.();
        },
      },
    );

    await tokenSeen;
    controller.abort();
    const result = await promise;

    expect(result).toEqual({
      text: 'Partial',
      meta,
      aborted: true,
    });
  });

  it('does not fetch when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const { fetchImpl, mock } = mockFetch(async () =>
      sseResponse([frame('done', { finishReason: 'stop' })]),
    );

    await expect(
      streamChat(
        { message: 'Hello', locale: 'en' },
        { fetchImpl, signal: controller.signal },
      ),
    ).resolves.toEqual({ text: '', aborted: true });
    expect(mock).not.toHaveBeenCalled();
  });
});

describe('streamChat client validation', () => {
  it.each([
    ['blank message', { message: '   ', locale: 'en' }],
    [
      'message over the character cap',
      { message: 'a'.repeat(AI_AGENT_MESSAGE_CHARS + 1), locale: 'en' },
    ],
    [
      'too many history messages',
      {
        message: 'Hello',
        locale: 'en',
        history: Array.from({ length: 7 }, () => ({
          role: 'user',
          content: 'x',
        })),
      },
    ],
    [
      'history over the character cap',
      {
        message: 'Hello',
        locale: 'en',
        history: Array.from({ length: 4 }, () => ({
          role: 'assistant',
          content: 'x'.repeat(AI_AGENT_HISTORY_CHARS / 4 + 1),
        })),
      },
    ],
    [
      'empty history content',
      {
        message: 'Hello',
        locale: 'en',
        history: [{ role: 'user', content: '' }],
      },
    ],
    [
      'invalid history role',
      {
        message: 'Hello',
        locale: 'en',
        history: [{ role: 'system', content: 'x' }],
      },
    ],
    ['invalid locale', { message: 'Hello', locale: 'fr' }],
  ])('rejects %s without calling fetch', async (_label, input) => {
    const { fetchImpl, mock } = mockFetch(async () =>
      sseResponse([frame('done', { finishReason: 'stop' })]),
    );

    const error = (await rejectionOf(
      streamChat(input as unknown as AiAgentChatRequest, { fetchImpl }),
    )) as AiAgentError;

    expect(error).toBeInstanceOf(AiAgentError);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toMatch(/message length/i);
    expect(mock).not.toHaveBeenCalled();
  });
});

describe('normalizeAiAgentLocale', () => {
  it('keeps Arabic, normalizes French to English, and defaults unknown values', () => {
    expect(normalizeAiAgentLocale('ar')).toBe('ar');
    expect(normalizeAiAgentLocale('en')).toBe('en');
    expect(normalizeAiAgentLocale('fr')).toBe('en');
    expect(normalizeAiAgentLocale('de')).toBe('en');
    expect(normalizeAiAgentLocale(undefined)).toBe('en');
  });
});
