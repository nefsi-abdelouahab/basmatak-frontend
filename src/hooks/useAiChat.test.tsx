// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AiAgentError,
  streamChat,
  type AiAgentChatRequest,
  type AiAgentDoneEvent,
  type AiAgentMetaEvent,
  type AiAgentMode,
  type AiAgentSourcesEvent,
  type AiAgentStreamOptions,
  type AiAgentStreamResult,
  type AiAgentUsage,
} from '../lib/api/aiAgent';
import {
  notifyAuthCleared,
  notifySessionExpired,
} from '../lib/auth/storage';
import {
  AI_AGENT_ICON_SRC,
  AI_AGENT_STORAGE_KEY,
  aiChatReducer,
  buildRequestHistory,
  initialAiChatState,
  loadAiChatHistory,
  persistAiChatMessages,
  useAiChat,
  type AiChatAction,
  type AiChatMessage,
  type AiChatState,
  type AiChatStorage,
} from './useAiChat';

vi.mock('../lib/api/aiAgent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api/aiAgent')>();
  return { ...actual, streamChat: vi.fn() };
});

const streamChatMock = vi.mocked(streamChat);

const metaFixture: AiAgentMetaEvent = {
  conversationId: '11111111-1111-4111-8111-111111111111',
  locale: 'en',
  mode: 'normal',
};

const sourcesFixture: AiAgentSourcesEvent = {
  knowledge: [
    {
      id: 'K1',
      title: 'About Basmatak',
      source: 'knowledge/about.md',
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

const usageFixture: AiAgentUsage = {
  inputTokens: 100,
  outputTokens: 50,
  totalTokens: 150,
  estimated: false,
};

function successImplementation(options: {
  mode?: AiAgentMode;
  truncated?: boolean;
  content?: string;
} = {}): (
  input: AiAgentChatRequest,
  streamOptions?: AiAgentStreamOptions,
) => Promise<AiAgentStreamResult> {
  return async (_input, streamOptions) => {
    const mode = options.mode ?? 'normal';
    const content = options.content ?? 'Hello';
    const meta = { ...metaFixture, mode };
    const done: AiAgentDoneEvent = {
      finishReason: options.truncated === true ? 'length' : 'stop',
      ...(options.truncated === true ? { truncated: true } : {}),
      usage: usageFixture,
    };

    streamOptions?.onEvent?.({ event: 'meta', data: meta });
    streamOptions?.onEvent?.({ event: 'status', data: { state: 'thinking' } });
    streamOptions?.onEvent?.({ event: 'sources', data: sourcesFixture });
    if (content !== '') {
      streamOptions?.onEvent?.({ event: 'token', data: { delta: content } });
    }

    return {
      text: content,
      meta,
      sources: sourcesFixture,
      done,
      aborted: false,
    };
  };
}

class MemoryStorage implements AiChatStorage {
  private readonly values = new Map<string, string>();

  constructor(initial?: Record<string, string>) {
    for (const [key, value] of Object.entries(initial ?? {})) {
      this.values.set(key, value);
    }
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

let messageCounter = 0;

function makeMessage(
  overrides: Partial<AiChatMessage> &
    Pick<AiChatMessage, 'role' | 'content'>,
): AiChatMessage {
  messageCounter += 1;
  return {
    ...overrides,
    id: overrides.id ?? `message-${messageCounter}`,
    role: overrides.role,
    content: overrides.content,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    status: overrides.status ?? 'complete',
  };
}

function persistedPayload(messages: AiChatMessage[]): string {
  return JSON.stringify({
    version: 1,
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      ...(message.sources !== undefined ? { sources: message.sources } : {}),
      ...(message.mode !== undefined ? { mode: message.mode } : {}),
      ...(message.truncated !== undefined
        ? { truncated: message.truncated }
        : {}),
    })),
  });
}

function stateWith(overrides: Partial<AiChatState>): AiChatState {
  return { ...initialAiChatState, ...overrides };
}

function storedPayloadMessages(storage: MemoryStorage): unknown[] {
  const raw = storage.getItem(AI_AGENT_STORAGE_KEY);
  if (raw === null) return [];
  const parsed = JSON.parse(raw) as { messages?: unknown[] };
  return parsed.messages ?? [];
}

beforeEach(() => {
  messageCounter = 0;
  streamChatMock.mockReset();
});

afterEach(() => {
  cleanup();
  streamChatMock.mockReset();
});

describe('useAiChat successful turns', () => {
  it('accumulates tokens, sources, mode, usage, and idle state', async () => {
    streamChatMock.mockImplementation(successImplementation());
    const storage = new MemoryStorage();
    const { result } = renderHook(() => useAiChat({ storage, locale: 'en' }));

    let accepted: boolean | undefined;
    await act(async () => {
      accepted = await result.current.send('What is Basmatak?');
    });

    expect(accepted).toBe(true);
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({
      role: 'user',
      content: 'What is Basmatak?',
      status: 'complete',
    });
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Hello',
      status: 'complete',
      mode: 'normal',
      sources: sourcesFixture,
      truncated: false,
    });
    expect(result.current.connection).toBe('idle');
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.status).toBeNull();
    expect(result.current.sources).toEqual(sourcesFixture);
    expect(result.current.mode).toBe('normal');
    expect(result.current.truncated).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.conversationId).toBe(metaFixture.conversationId);
    expect(result.current.lastUsage).toEqual(usageFixture);
    expect(result.current.canSend).toBe(true);
    expect(result.current.canRetry).toBe(false);
    expect(result.current.canContinue).toBe(false);
    expect(result.current.limits).toEqual({
      messageChars: 2000,
      historyMessages: 6,
      historyChars: 4000,
    });

    await waitFor(() => {
      expect(storedPayloadMessages(storage)).toHaveLength(2);
    });
    const raw = storage.getItem(AI_AGENT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const payload = JSON.parse(raw ?? '{}') as {
      version: number;
      messages: Array<Record<string, unknown>>;
    };
    expect(payload.version).toBe(1);
    expect(payload.messages.map((message) => message.status)).toEqual([
      undefined,
      undefined,
    ]);
    expect(payload.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Hello',
      sources: sourcesFixture,
      mode: 'normal',
      truncated: false,
    });
  });

  it('exposes retrieval_only and truncated answers for continuation', async () => {
    streamChatMock.mockImplementation(
      successImplementation({ mode: 'retrieval_only', truncated: true }),
    );
    const { result } = renderHook(() =>
      useAiChat({ storage: new MemoryStorage(), locale: 'en' }),
    );

    await act(async () => {
      await result.current.send('Find something');
    });

    expect(result.current.mode).toBe('retrieval_only');
    expect(result.current.truncated).toBe(true);
    expect(result.current.messages[1]).toMatchObject({
      status: 'complete',
      mode: 'retrieval_only',
      truncated: true,
    });
    expect(result.current.canContinue).toBe(true);
    expect(result.current.canRetry).toBe(false);
  });

  it('normalizes French to en and keeps Arabic as ar', async () => {
    streamChatMock.mockImplementation(successImplementation());

    const french = renderHook(() =>
      useAiChat({ storage: new MemoryStorage(), locale: 'fr' }),
    );
    await act(async () => {
      await french.result.current.send('Bonjour');
    });
    french.unmount();

    const arabic = renderHook(() =>
      useAiChat({ storage: new MemoryStorage(), locale: 'ar' }),
    );
    await act(async () => {
      await arabic.result.current.send('مرحبا');
    });

    expect(streamChatMock.mock.calls[0]?.[0].locale).toBe('en');
    expect(streamChatMock.mock.calls[1]?.[0].locale).toBe('ar');
  });
});

describe('useAiChat errors, abort, retry, and continue', () => {
  it('keeps partial content, stores the safe error, and enables retry', async () => {
    streamChatMock.mockImplementation(async (_input, streamOptions) => {
      streamOptions?.onEvent?.({ event: 'token', data: { delta: 'Partial' } });
      throw new AiAgentError('AI_AGENT_TIMEOUT');
    });
    const { result } = renderHook(() =>
      useAiChat({ storage: new MemoryStorage(), locale: 'en' }),
    );

    await act(async () => {
      await result.current.send('Hi');
    });

    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Partial',
      status: 'error',
    });
    expect(result.current.error).toBeInstanceOf(AiAgentError);
    expect(result.current.error?.code).toBe('AI_AGENT_TIMEOUT');
    expect(result.current.connection).toBe('idle');
    expect(result.current.canRetry).toBe(true);
  });

  it('aborts with partial content, clears the error, and never persists the aborted assistant', async () => {
    let sendPromise: Promise<boolean> | undefined;
    streamChatMock.mockImplementation((_input, streamOptions) => {
      streamOptions?.onEvent?.({ event: 'token', data: { delta: 'Partial' } });
      return new Promise<AiAgentStreamResult>((_resolve, reject) => {
        streamOptions?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });
    const storage = new MemoryStorage();
    const { result } = renderHook(() => useAiChat({ storage, locale: 'en' }));

    await act(async () => {
      sendPromise = result.current.send('Hi');
      await Promise.resolve();
    });
    expect(result.current.messages[1]?.content).toBe('Partial');

    act(() => {
      result.current.abort();
    });
    await act(async () => {
      await sendPromise;
    });

    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Partial',
      status: 'aborted',
    });
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBeNull();
    expect(result.current.connection).toBe('idle');
    expect(result.current.canRetry).toBe(true);

    await waitFor(() => {
      expect(storedPayloadMessages(storage)).toHaveLength(1);
    });
    const persisted = storedPayloadMessages(storage) as Array<{
      role: string;
      status?: string;
    }>;
    expect(persisted[0]?.role).toBe('user');
    expect(persisted[0]?.status).toBeUndefined();
  });

  it('retries the same user message without duplicating it', async () => {
    streamChatMock
      .mockImplementationOnce(async (_input, streamOptions) => {
        streamOptions?.onEvent?.({
          event: 'token',
          data: { delta: 'Partial' },
        });
        throw new AiAgentError('AI_AGENT_PROVIDER_UNAVAILABLE');
      })
      .mockImplementationOnce(successImplementation());
    const { result } = renderHook(() =>
      useAiChat({ storage: new MemoryStorage(), locale: 'en' }),
    );

    await act(async () => {
      await result.current.send('Hi');
    });
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]?.content).toBe('Hi');
    expect(result.current.messages[1]?.status).toBe('error');

    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages.filter((message) => message.role === 'user')).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({
      role: 'user',
      content: 'Hi',
    });
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Hello',
      status: 'complete',
    });
    expect(streamChatMock).toHaveBeenCalledTimes(2);
    expect(streamChatMock.mock.calls[1]?.[0]).toMatchObject({
      message: 'Hi',
      locale: 'en',
    });
    expect(streamChatMock.mock.calls[1]?.[0].history).toBeUndefined();
  });

  it('continues a truncated answer with the partial assistant in history', async () => {
    streamChatMock
      .mockImplementationOnce(
        successImplementation({
          mode: 'retrieval_only',
          truncated: true,
          content: 'Partial answer',
        }),
      )
      .mockImplementationOnce(successImplementation({ content: 'Continued' }));
    const { result } = renderHook(() =>
      useAiChat({ storage: new MemoryStorage(), locale: 'en' }),
    );

    await act(async () => {
      await result.current.send('Question');
    });
    const oldAssistantId = result.current.messages[1]?.id;
    expect(result.current.canContinue).toBe(true);

    await act(async () => {
      await result.current.continueChat();
    });

    expect(result.current.messages).toHaveLength(4);
    expect(result.current.messages[1]).toMatchObject({
      id: oldAssistantId,
      role: 'assistant',
      content: 'Partial answer',
      status: 'complete',
      truncated: true,
    });
    expect(result.current.messages[2]).toMatchObject({
      role: 'user',
      content: 'Continue.',
    });
    expect(result.current.messages[3]).toMatchObject({
      role: 'assistant',
      content: 'Continued',
      status: 'complete',
    });
    expect(streamChatMock.mock.calls[1]?.[0]).toMatchObject({
      message: 'Continue.',
      locale: 'en',
      history: [
        { role: 'user', content: 'Question' },
        { role: 'assistant', content: 'Partial answer' },
      ],
    });
  });
});

describe('useAiChat request history limits', () => {
  it('never sends more than six messages or 4,000 characters', async () => {
    const stored = Array.from({ length: 8 }, (_, index) =>
      makeMessage({
        id: `stored-${index}`,
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `${index}`.padEnd(700, 'x'),
      }),
    );
    const storage = new MemoryStorage({
      [AI_AGENT_STORAGE_KEY]: persistedPayload(stored),
    });
    streamChatMock.mockImplementation(successImplementation());
    const { result } = renderHook(() => useAiChat({ storage, locale: 'en' }));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(8);
    });
    await act(async () => {
      await result.current.send('Now');
    });

    const request = streamChatMock.mock.calls[0]?.[0];
    expect(request).toBeDefined();
    expect(request?.history?.length ?? 0).toBeLessThanOrEqual(6);
    const historyChars =
      request?.history?.reduce((total, message) => total + message.content.length, 0) ?? 0;
    expect(historyChars).toBeLessThanOrEqual(4000);
    expect(request?.history?.some((message) => message.content === 'Now')).toBe(false);
    expect(request).not.toHaveProperty('conversationId');
  });
});

describe('buildRequestHistory', () => {
  it('drops trailing user messages without a completed assistant answer', () => {
    const messages = [
      makeMessage({ role: 'user', content: 'First' }),
      makeMessage({ role: 'assistant', content: 'Answer' }),
      makeMessage({ role: 'user', content: 'Unanswered' }),
    ];

    expect(buildRequestHistory(messages)).toEqual([
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Answer' },
    ]);
  });

  it('excludes streaming, error, and aborted assistants', () => {
    const messages = [
      makeMessage({ role: 'user', content: 'First' }),
      makeMessage({ role: 'assistant', content: 'Answer' }),
      makeMessage({ role: 'user', content: 'Second' }),
      makeMessage({
        role: 'assistant',
        content: 'Failed',
        status: 'error',
      }),
      makeMessage({ role: 'assistant', content: '', status: 'streaming' }),
      makeMessage({ role: 'assistant', content: 'Stopped', status: 'aborted' }),
    ];

    expect(buildRequestHistory(messages)).toEqual([
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Answer' },
    ]);
  });

  it('keeps the newest messages, oldest first, up to the message cap', () => {
    const messages = Array.from({ length: 8 }, (_, index) =>
      makeMessage({
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `m${index}`,
      }),
    );

    const history = buildRequestHistory(messages);
    expect(history).toHaveLength(6);
    expect(history.map((message) => message.content)).toEqual([
      'm2',
      'm3',
      'm4',
      'm5',
      'm6',
      'm7',
    ]);
  });

  it('drops oldest messages first when the character cap is exceeded', () => {
    const messages = [
      makeMessage({ role: 'user', content: 'a'.repeat(1000) }),
      makeMessage({ role: 'assistant', content: 'b'.repeat(2000) }),
      makeMessage({ role: 'user', content: 'c'.repeat(1500) }),
      makeMessage({ role: 'assistant', content: 'd'.repeat(500) }),
    ];

    const history = buildRequestHistory(messages);
    expect(history.map((message) => message.content.length)).toEqual([
      2000, 1500, 500,
    ]);
    expect(history[0]?.content.startsWith('b')).toBe(true);
    expect(
      history.reduce((total, message) => total + message.content.length, 0),
    ).toBe(4000);
  });

  it('keeps the tail of a single remaining message over the character cap', () => {
    const messages = [
      makeMessage({ role: 'user', content: 'Question' }),
      makeMessage({ role: 'assistant', content: 'a'.repeat(5000) }),
    ];

    const history = buildRequestHistory(messages);
    expect(history).toHaveLength(1);
    expect(history[0]?.role).toBe('assistant');
    expect(history[0]?.content.length).toBe(4000);
    expect(history[0]?.content).toBe('a'.repeat(5000).slice(-4000));
  });

  it('respects custom limits and ignores empty completed content', () => {
    const messages = [
      makeMessage({ role: 'user', content: '' }),
      makeMessage({ role: 'user', content: 'one' }),
      makeMessage({ role: 'assistant', content: 'two' }),
      makeMessage({ role: 'user', content: 'three' }),
      makeMessage({ role: 'assistant', content: 'four' }),
    ];

    expect(
      buildRequestHistory(messages, { maxMessages: 2, maxChars: 100 }),
    ).toEqual([
      { role: 'user', content: 'three' },
      { role: 'assistant', content: 'four' },
    ]);
  });
});

describe('useAiChat persistence', () => {
  it('persists only completed messages', () => {
    const storage = new MemoryStorage();
    const messages = [
      makeMessage({ role: 'user', content: 'Keep me' }),
      makeMessage({ role: 'assistant', content: 'Streaming', status: 'streaming' }),
      makeMessage({ role: 'assistant', content: 'Failed', status: 'error' }),
      makeMessage({ role: 'assistant', content: 'Stopped', status: 'aborted' }),
      makeMessage({ role: 'assistant', content: 'Keep answer' }),
    ];

    persistAiChatMessages(messages, storage);

    const persisted = storedPayloadMessages(storage) as Array<{
      role: string;
      content: string;
    }>;
    expect(persisted.map((message) => message.content)).toEqual([
      'Keep me',
      'Keep answer',
    ]);
  });

  it('caps persistence at 30 messages and drops the oldest', () => {
    const storage = new MemoryStorage();
    const messages = Array.from({ length: 35 }, (_, index) =>
      makeMessage({
        id: `cap-${index}`,
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `message ${index}`,
      }),
    );

    persistAiChatMessages(messages, storage);

    const persisted = storedPayloadMessages(storage) as Array<{ id: string }>;
    expect(persisted).toHaveLength(30);
    expect(persisted[0]?.id).toBe('cap-5');
    expect(persisted[29]?.id).toBe('cap-34');
  });

  it('removes the key when no completed messages remain', () => {
    const storage = new MemoryStorage({
      [AI_AGENT_STORAGE_KEY]: persistedPayload([
        makeMessage({ role: 'user', content: 'Old' }),
      ]),
    });

    persistAiChatMessages(
      [makeMessage({ role: 'assistant', content: 'Failed', status: 'error' })],
      storage,
    );

    expect(storage.getItem(AI_AGENT_STORAGE_KEY)).toBeNull();
  });

  it('clears messages and the storage key on new chat', async () => {
    streamChatMock.mockImplementation(successImplementation());
    const storage = new MemoryStorage();
    const { result } = renderHook(() => useAiChat({ storage, locale: 'en' }));

    await act(async () => {
      await result.current.send('Hi');
    });
    await waitFor(() => {
      expect(storage.getItem(AI_AGENT_STORAGE_KEY)).not.toBeNull();
    });

    act(() => {
      result.current.newChat();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.sources).toBeNull();
    expect(result.current.mode).toBeNull();
    expect(result.current.truncated).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBeNull();
    expect(result.current.conversationId).toBeNull();
    expect(result.current.lastUsage).toBeNull();
    expect(storage.getItem(AI_AGENT_STORAGE_KEY)).toBeNull();
  });

  it('clears messages and the storage key when auth is cleared', async () => {
    streamChatMock.mockImplementation(successImplementation());
    const storage = new MemoryStorage();
    const { result } = renderHook(() => useAiChat({ storage, locale: 'en' }));

    await act(async () => {
      await result.current.send('Hi');
    });
    await waitFor(() => {
      expect(storage.getItem(AI_AGENT_STORAGE_KEY)).not.toBeNull();
    });

    act(() => {
      notifyAuthCleared();
    });

    expect(result.current.messages).toEqual([]);
    expect(storage.getItem(AI_AGENT_STORAGE_KEY)).toBeNull();
  });

  it('clears messages and the storage key when the session expires', async () => {
    streamChatMock.mockImplementation(successImplementation());
    const storage = new MemoryStorage();
    const { result } = renderHook(() => useAiChat({ storage, locale: 'en' }));

    await act(async () => {
      await result.current.send('Hi');
    });
    await waitFor(() => {
      expect(storage.getItem(AI_AGENT_STORAGE_KEY)).not.toBeNull();
    });

    act(() => {
      notifySessionExpired();
    });

    expect(result.current.messages).toEqual([]);
    expect(storage.getItem(AI_AGENT_STORAGE_KEY)).toBeNull();
  });

  it('ignores corrupt stored JSON and removes the key', async () => {
    const storage = new MemoryStorage({
      [AI_AGENT_STORAGE_KEY]: '{not valid json',
    });
    const { result } = renderHook(() => useAiChat({ storage, locale: 'en' }));

    await waitFor(() => {
      expect(storage.getItem(AI_AGENT_STORAGE_KEY)).toBeNull();
    });
    expect(result.current.messages).toEqual([]);
  });

  it('ignores invalid stored payloads and removes the key', async () => {
    const storage = new MemoryStorage({
      [AI_AGENT_STORAGE_KEY]: JSON.stringify({ version: 2, messages: [] }),
    });
    const { result } = renderHook(() => useAiChat({ storage, locale: 'en' }));

    await waitFor(() => {
      expect(storage.getItem(AI_AGENT_STORAGE_KEY)).toBeNull();
    });
    expect(result.current.messages).toEqual([]);
  });

  it('hydrates valid stored messages as complete', async () => {
    const stored = [
      makeMessage({ role: 'user', content: 'Stored question' }),
      makeMessage({
        role: 'assistant',
        content: 'Stored answer',
        status: 'streaming',
        sources: sourcesFixture,
        mode: 'normal',
        truncated: true,
      }),
    ];
    const storage = new MemoryStorage({
      [AI_AGENT_STORAGE_KEY]: persistedPayload(stored),
    });
    const { result } = renderHook(() => useAiChat({ storage, locale: 'en' }));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(result.current.messages.map((message) => message.status)).toEqual([
      'complete',
      'complete',
    ]);
    expect(result.current.messages[1]).toMatchObject({
      content: 'Stored answer',
      sources: sourcesFixture,
      mode: 'normal',
      truncated: true,
    });
  });

  it('exposes the Basmatak logo as Basma icon asset', () => {
    expect(AI_AGENT_ICON_SRC).toBe('/logo.png');
  });
});

describe('loadAiChatHistory', () => {
  it('returns an empty list when storage is unavailable', () => {
    expect(loadAiChatHistory(null)).toEqual([]);
  });

  it('caps loaded history at the newest 30 messages', () => {
    const stored = Array.from({ length: 35 }, (_, index) =>
      makeMessage({
        id: `load-${index}`,
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `message ${index}`,
      }),
    );
    const storage = new MemoryStorage({
      [AI_AGENT_STORAGE_KEY]: persistedPayload(stored),
    });

    const loaded = loadAiChatHistory(storage);
    expect(loaded).toHaveLength(30);
    expect(loaded[0]?.id).toBe('load-5');
    expect(loaded.every((message) => message.status === 'complete')).toBe(true);
  });
});

describe('useAiChat unmount cleanup', () => {
  it('aborts an in-flight stream on unmount', async () => {
    let capturedSignal: AbortSignal | undefined;
    streamChatMock.mockImplementation((_input, streamOptions) => {
      capturedSignal = streamOptions?.signal;
      streamOptions?.onEvent?.({ event: 'token', data: { delta: 'Partial' } });
      return new Promise<AiAgentStreamResult>((_resolve, reject) => {
        streamOptions?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });
    const { result, unmount } = renderHook(() =>
      useAiChat({ storage: new MemoryStorage(), locale: 'en' }),
    );

    let sendPromise: Promise<boolean> | undefined;
    await act(async () => {
      sendPromise = result.current.send('Hi');
      await Promise.resolve();
    });
    expect(capturedSignal?.aborted).toBe(false);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
    await act(async () => {
      await sendPromise;
    });
  });
});

describe('aiChatReducer', () => {
  it('SEND_START appends a user and assistant and resets the turn', () => {
    const user = makeMessage({ role: 'user', content: 'Hi' });
    const assistant = makeMessage({
      role: 'assistant',
      content: '',
      status: 'streaming',
    });
    const before = stateWith({
      sources: sourcesFixture,
      mode: 'normal',
      truncated: true,
      status: { state: 'thinking' },
      error: new AiAgentError('AI_AGENT_TIMEOUT'),
      conversationId: 'old',
    });

    const next = aiChatReducer(before, {
      type: 'SEND_START',
      user,
      assistant,
    });

    expect(next.messages).toEqual([user, assistant]);
    expect(next.connection).toBe('connecting');
    expect(next.status).toBeNull();
    expect(next.sources).toBeNull();
    expect(next.mode).toBeNull();
    expect(next.truncated).toBe(false);
    expect(next.error).toBeNull();
    expect(next.activeAssistantId).toBe(assistant.id);
    expect(next.conversationId).toBe('old');
  });

  it('META stores the conversation and mode on state and message', () => {
    const user = makeMessage({ role: 'user', content: 'Hi' });
    const assistant = makeMessage({
      role: 'assistant',
      content: '',
      status: 'streaming',
    });
    const before = stateWith({
      messages: [user, assistant],
      connection: 'connecting',
      activeAssistantId: assistant.id,
    });

    const next = aiChatReducer(before, {
      type: 'META',
      data: { ...metaFixture, mode: 'retrieval_only' },
    });

    expect(next.conversationId).toBe(metaFixture.conversationId);
    expect(next.mode).toBe('retrieval_only');
    expect(next.messages[1]?.mode).toBe('retrieval_only');
    expect(next.connection).toBe('streaming');
  });

  it('STATUS stores the latest status', () => {
    const next = aiChatReducer(stateWith({ connection: 'connecting' }), {
      type: 'STATUS',
      data: { state: 'tool', tool: 'platform_stats' },
    });

    expect(next.status).toEqual({ state: 'tool', tool: 'platform_stats' });
    expect(next.connection).toBe('streaming');
  });

  it('SOURCES stores sources globally and on the active assistant', () => {
    const user = makeMessage({ role: 'user', content: 'Hi' });
    const assistant = makeMessage({
      role: 'assistant',
      content: '',
      status: 'streaming',
    });
    const before = stateWith({
      messages: [user, assistant],
      activeAssistantId: assistant.id,
    });

    const next = aiChatReducer(before, {
      type: 'SOURCES',
      data: sourcesFixture,
    });

    expect(next.sources).toEqual(sourcesFixture);
    expect(next.messages[1]?.sources).toEqual(sourcesFixture);
  });

  it('TOKEN appends only to the active streaming assistant', () => {
    const user = makeMessage({ role: 'user', content: 'Hi' });
    const assistant = makeMessage({
      role: 'assistant',
      content: 'A',
      status: 'streaming',
    });
    const before = stateWith({
      messages: [user, assistant],
      activeAssistantId: assistant.id,
      connection: 'connecting',
    });

    const next = aiChatReducer(before, { type: 'TOKEN', delta: 'B' });
    expect(next.messages[1]?.content).toBe('AB');
    expect(next.connection).toBe('streaming');

    expect(aiChatReducer(next, { type: 'TOKEN', delta: '' })).toBe(next);
    expect(
      aiChatReducer(next, {
        type: 'TOKEN',
        delta: 'X',
        assistantId: 'stale',
      }),
    ).toBe(next);
  });

  it('DONE completes the assistant, infers length truncation, and stores usage', () => {
    const user = makeMessage({ role: 'user', content: 'Hi' });
    const assistant = makeMessage({
      role: 'assistant',
      content: 'Partial',
      status: 'streaming',
      mode: 'retrieval_only',
    });
    const before = stateWith({
      messages: [user, assistant],
      connection: 'streaming',
      activeAssistantId: assistant.id,
      mode: 'retrieval_only',
      status: { state: 'answering' },
      error: new AiAgentError('AI_AGENT_TIMEOUT'),
    });

    const next = aiChatReducer(before, {
      type: 'DONE',
      data: { finishReason: 'length', usage: usageFixture },
    });

    expect(next.messages[1]).toMatchObject({
      status: 'complete',
      content: 'Partial',
      mode: 'retrieval_only',
      truncated: true,
    });
    expect(next.connection).toBe('idle');
    expect(next.status).toBeNull();
    expect(next.error).toBeNull();
    expect(next.truncated).toBe(true);
    expect(next.lastUsage).toEqual(usageFixture);
    expect(next.activeAssistantId).toBeNull();
  });

  it('STREAM_ERROR marks the active assistant error and preserves partial data', () => {
    const user = makeMessage({ role: 'user', content: 'Hi' });
    const assistant = makeMessage({
      role: 'assistant',
      content: 'Partial',
      status: 'streaming',
      sources: sourcesFixture,
      mode: 'normal',
    });
    const error = new AiAgentError('AI_AGENT_TIMEOUT');
    const before = stateWith({
      messages: [user, assistant],
      connection: 'streaming',
      activeAssistantId: assistant.id,
      status: { state: 'answering' },
    });

    const next = aiChatReducer(before, { type: 'STREAM_ERROR', error });

    expect(next.messages[1]).toMatchObject({
      status: 'error',
      content: 'Partial',
      sources: sourcesFixture,
      mode: 'normal',
    });
    expect(next.connection).toBe('idle');
    expect(next.status).toBeNull();
    expect(next.error).toBe(error);
    expect(next.activeAssistantId).toBeNull();
  });

  it('ABORT is idempotent and never overwrites a completed message', () => {
    const user = makeMessage({ role: 'user', content: 'Hi' });
    const assistant = makeMessage({
      role: 'assistant',
      content: 'Partial',
      status: 'streaming',
      sources: sourcesFixture,
      mode: 'normal',
    });
    const before = stateWith({
      messages: [user, assistant],
      connection: 'streaming',
      activeAssistantId: assistant.id,
      status: { state: 'answering' },
      error: new AiAgentError('AI_AGENT_TIMEOUT'),
    });

    const next = aiChatReducer(before, { type: 'ABORT' });
    expect(next.messages[1]).toMatchObject({
      status: 'aborted',
      content: 'Partial',
      sources: sourcesFixture,
      mode: 'normal',
    });
    expect(next.connection).toBe('idle');
    expect(next.status).toBeNull();
    expect(next.error).toBeNull();
    expect(next.activeAssistantId).toBeNull();
    expect(aiChatReducer(next, { type: 'ABORT' })).toBe(next);

    const completed = stateWith({
      messages: [
        user,
        { ...assistant, status: 'complete' as const },
      ],
      activeAssistantId: assistant.id,
      connection: 'idle',
    });
    expect(aiChatReducer(completed, { type: 'ABORT' })).toBe(completed);
  });

  it('RETRY_START removes the failed assistant and does not duplicate the user', () => {
    const user = makeMessage({ role: 'user', content: 'Hi' });
    const failed = makeMessage({
      role: 'assistant',
      content: 'Partial',
      status: 'error',
    });
    const replacement = makeMessage({
      role: 'assistant',
      content: '',
      status: 'streaming',
    });
    const before = stateWith({
      messages: [user, failed],
      connection: 'idle',
      sources: sourcesFixture,
      mode: 'normal',
      truncated: true,
      error: new AiAgentError('AI_AGENT_TIMEOUT'),
    });

    const next = aiChatReducer(before, {
      type: 'RETRY_START',
      assistant: replacement,
    });

    expect(next.messages).toEqual([user, replacement]);
    expect(next.messages.filter((message) => message.role === 'user')).toHaveLength(1);
    expect(next.connection).toBe('connecting');
    expect(next.sources).toBeNull();
    expect(next.mode).toBeNull();
    expect(next.truncated).toBe(false);
    expect(next.error).toBeNull();
    expect(next.activeAssistantId).toBe(replacement.id);
  });

  it('HYDRATE restores messages as complete and resets transient state', () => {
    const stored = [
      makeMessage({ role: 'user', content: 'Stored' }),
      makeMessage({
        role: 'assistant',
        content: 'Answer',
        status: 'streaming',
      }),
    ];
    const before = stateWith({
      sources: sourcesFixture,
      mode: 'normal',
      truncated: true,
      error: new AiAgentError('AI_AGENT_TIMEOUT'),
    });

    const next = aiChatReducer(before, {
      type: 'HYDRATE',
      messages: stored,
    });

    expect(next.messages.map((message) => message.status)).toEqual([
      'complete',
      'complete',
    ]);
    expect(next.connection).toBe('idle');
    expect(next.sources).toBeNull();
    expect(next.mode).toBeNull();
    expect(next.truncated).toBe(false);
    expect(next.error).toBeNull();
    expect(next.activeAssistantId).toBeNull();
  });

  it('RESET returns the initial state', () => {
    const before = stateWith({
      messages: [makeMessage({ role: 'user', content: 'Hi' })],
      connection: 'streaming',
      mode: 'normal',
    });

    expect(aiChatReducer(before, { type: 'RESET' })).toBe(initialAiChatState);
  });

  it('ignores unknown action types defensively', () => {
    const before = stateWith({ connection: 'streaming' });
    expect(
      aiChatReducer(before, { type: 'UNKNOWN' } as unknown as AiChatAction),
    ).toBe(before);
  });
});
