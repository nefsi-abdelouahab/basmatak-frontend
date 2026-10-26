'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { z } from 'zod';
import {
  AI_AGENT_HISTORY_CHARS,
  AI_AGENT_HISTORY_MESSAGES,
  AI_AGENT_MESSAGE_CHARS,
  AiAgentError,
  AiAgentModeSchema,
  AiAgentSourcesEventSchema,
  normalizeAiAgentLocale,
  streamChat,
  type AiAgentChatMessage,
  type AiAgentChatRole,
  type AiAgentDoneEvent,
  type AiAgentLiveEvent,
  type AiAgentMetaEvent,
  type AiAgentMode,
  type AiAgentSourcesEvent,
  type AiAgentStatusEvent,
  type AiAgentUiLocale,
  type AiAgentUsage,
} from '../lib/api/aiAgent';
import {
  subscribeAuthCleared,
  subscribeSessionExpired,
} from '../lib/auth/storage';

/**
 * Chat state for the floating Basmatak assistant.
 *
 * This is deliberately not a React Query cache: a chat transcript is local,
 * append-only client state, and a global store would outlive the widget. The
 * server is stateless per request; only the client-provided history is sent.
 */

export const AI_AGENT_STORAGE_KEY = 'basmatak.aiAgent.history';

// Session 11 renders the assistant avatar/icon. Use the existing Basmatak logo,
// not a generic robot/sparkle glyph. Kept here as the single source of truth so
// the UI session does not hard-code a different asset.
export const AI_AGENT_ICON_SRC = '/logo.png';

const STORAGE_VERSION = 1;
const MAX_PERSISTED_MESSAGES = 30;
const DEFAULT_CONTINUE_PROMPT = 'Continue.';

export type AiChatConnection = 'idle' | 'connecting' | 'streaming';

export interface AiChatMessage {
  id: string;
  role: AiAgentChatRole;
  content: string;
  createdAt: string;
  status: 'streaming' | 'complete' | 'error' | 'aborted';
  sources?: AiAgentSourcesEvent;
  mode?: AiAgentMode;
  truncated?: boolean;
}

export interface AiChatState {
  messages: AiChatMessage[];
  connection: AiChatConnection;
  status: AiAgentStatusEvent | null;
  sources: AiAgentSourcesEvent | null;
  mode: AiAgentMode | null;
  truncated: boolean;
  error: AiAgentError | null;
  conversationId: string | null;
  lastUsage: AiAgentUsage | null;
  activeAssistantId: string | null;
}

export type AiChatAction =
  | { type: 'HYDRATE'; messages: AiChatMessage[] }
  | { type: 'SEND_START'; user: AiChatMessage; assistant: AiChatMessage }
  | { type: 'META'; data: AiAgentMetaEvent }
  | { type: 'STATUS'; data: AiAgentStatusEvent }
  | { type: 'SOURCES'; data: AiAgentSourcesEvent }
  | { type: 'TOKEN'; delta: string; assistantId?: string }
  | { type: 'DONE'; data: AiAgentDoneEvent }
  | { type: 'STREAM_ERROR'; error: AiAgentError }
  | { type: 'ABORT' }
  | { type: 'RETRY_START'; assistant: AiChatMessage }
  | { type: 'RESET' };

export const initialAiChatState: AiChatState = {
  messages: [],
  connection: 'idle',
  status: null,
  sources: null,
  mode: null,
  truncated: false,
  error: null,
  conversationId: null,
  lastUsage: null,
  activeAssistantId: null,
};

function updateActiveMessage(
  messages: AiChatMessage[],
  activeAssistantId: string | null,
  update: (message: AiChatMessage) => AiChatMessage,
): AiChatMessage[] {
  if (activeAssistantId === null) return messages;
  let changed = false;
  const next = messages.map((message) => {
    if (message.id !== activeAssistantId) return message;
    changed = true;
    return update(message);
  });
  return changed ? next : messages;
}

export function aiChatReducer(
  state: AiChatState,
  action: AiChatAction,
): AiChatState {
  switch (action.type) {
    case 'HYDRATE':
      return {
        ...initialAiChatState,
        messages: action.messages.map((message) => ({
          ...message,
          status: 'complete',
        })),
      };

    case 'SEND_START':
      return {
        ...state,
        messages: [...state.messages, action.user, action.assistant],
        connection: 'connecting',
        status: null,
        sources: null,
        mode: null,
        truncated: false,
        error: null,
        activeAssistantId: action.assistant.id,
      };

    case 'META':
      return {
        ...state,
        messages: updateActiveMessage(
          state.messages,
          state.activeAssistantId,
          (message) => ({ ...message, mode: action.data.mode }),
        ),
        conversationId: action.data.conversationId,
        mode: action.data.mode,
        connection: 'streaming',
      };

    case 'STATUS':
      return {
        ...state,
        status: action.data,
        connection: 'streaming',
      };

    case 'SOURCES':
      return {
        ...state,
        messages: updateActiveMessage(
          state.messages,
          state.activeAssistantId,
          (message) => ({ ...message, sources: action.data }),
        ),
        sources: action.data,
      };

    case 'TOKEN': {
      if (typeof action.delta !== 'string' || action.delta === '') return state;
      if (state.activeAssistantId === null) return state;
      if (
        action.assistantId !== undefined &&
        action.assistantId !== state.activeAssistantId
      ) {
        return state;
      }

      const next = updateActiveMessage(
        state.messages,
        state.activeAssistantId,
        (message) =>
          message.status === 'streaming'
            ? { ...message, content: message.content + action.delta }
            : message,
      );
      if (next === state.messages) return state;
      return { ...state, messages: next, connection: 'streaming' };
    }

    case 'DONE': {
      const truncated =
        action.data.truncated === true || action.data.finishReason === 'length';
      const mode = state.mode;
      return {
        ...state,
        messages: updateActiveMessage(
          state.messages,
          state.activeAssistantId,
          (message) => ({
            ...message,
            status: 'complete',
            ...(mode !== null ? { mode } : {}),
            truncated,
          }),
        ),
        connection: 'idle',
        status: null,
        error: null,
        mode,
        truncated,
        lastUsage: action.data.usage ?? null,
        activeAssistantId: null,
      };
    }

    case 'STREAM_ERROR':
      return {
        ...state,
        messages: updateActiveMessage(
          state.messages,
          state.activeAssistantId,
          (message) =>
            message.status === 'streaming'
              ? { ...message, status: 'error' }
              : message,
        ),
        connection: 'idle',
        status: null,
        error: action.error,
        activeAssistantId: null,
      };

    case 'ABORT': {
      if (state.activeAssistantId === null) return state;
      const active = state.messages.find(
        (message) => message.id === state.activeAssistantId,
      );
      if (active === undefined || active.status !== 'streaming') return state;

      return {
        ...state,
        messages: updateActiveMessage(
          state.messages,
          state.activeAssistantId,
          (message) => ({ ...message, status: 'aborted' }),
        ),
        connection: 'idle',
        status: null,
        error: null,
        activeAssistantId: null,
      };
    }

    case 'RETRY_START': {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (
        last?.role === 'assistant' &&
        (last.status === 'error' || last.status === 'aborted')
      ) {
        messages.pop();
      }
      messages.push(action.assistant);

      return {
        ...state,
        messages,
        connection: 'connecting',
        status: null,
        sources: null,
        mode: null,
        truncated: false,
        error: null,
        activeAssistantId: action.assistant.id,
      };
    }

    case 'RESET':
      return initialAiChatState;

    default:
      return state;
  }
}

export interface AiChatStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface UseAiChatOptions {
  locale?: AiAgentUiLocale;
  continuePrompt?: string;
  storage?: AiChatStorage | null;
}

export interface AiChatLimits {
  messageChars: number;
  historyMessages: number;
  historyChars: number;
}

// --- Persistence -----------------------------------------------------------

const PersistedAiChatMessageSchema = z
  .object({
    id: z.string().min(1),
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    createdAt: z.string().min(1),
    sources: AiAgentSourcesEventSchema.optional(),
    mode: AiAgentModeSchema.optional(),
    truncated: z.boolean().optional(),
  })
  .passthrough();

const PersistedAiChatHistorySchema = z
  .object({
    version: z.literal(STORAGE_VERSION),
    messages: z.array(PersistedAiChatMessageSchema),
  })
  .passthrough();

function getDefaultAiChatStorage(): AiChatStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function removePersistedHistory(storage: AiChatStorage): void {
  try {
    storage.removeItem(AI_AGENT_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private/security-restricted contexts.
  }
}

interface PersistedAiChatMessage {
  id: string;
  role: AiAgentChatRole;
  content: string;
  createdAt: string;
  sources?: AiAgentSourcesEvent;
  mode?: AiAgentMode;
  truncated?: boolean;
}

function toPersistedMessage(message: AiChatMessage): PersistedAiChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    ...(message.sources !== undefined ? { sources: message.sources } : {}),
    ...(message.mode !== undefined ? { mode: message.mode } : {}),
    ...(message.truncated !== undefined
      ? { truncated: message.truncated }
      : {}),
  };
}

export function loadAiChatHistory(
  storage: AiChatStorage | null,
): AiChatMessage[] {
  if (storage === null) return [];

  let raw: string | null;
  try {
    raw = storage.getItem(AI_AGENT_STORAGE_KEY);
  } catch {
    return [];
  }
  if (raw === null) return [];

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    removePersistedHistory(storage);
    return [];
  }

  const parsed = PersistedAiChatHistorySchema.safeParse(parsedJson);
  if (!parsed.success) {
    removePersistedHistory(storage);
    return [];
  }
  if (parsed.data.messages.length === 0) {
    removePersistedHistory(storage);
    return [];
  }

  return parsed.data.messages
    .slice(-MAX_PERSISTED_MESSAGES)
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      status: 'complete' as const,
      ...(message.sources !== undefined ? { sources: message.sources } : {}),
      ...(message.mode !== undefined ? { mode: message.mode } : {}),
      ...(message.truncated !== undefined
        ? { truncated: message.truncated }
        : {}),
    }));
}

export function persistAiChatMessages(
  messages: AiChatMessage[],
  storage: AiChatStorage | null,
): void {
  if (storage === null) return;

  const completed = messages
    .filter((message) => message.status === 'complete')
    .slice(-MAX_PERSISTED_MESSAGES);

  if (completed.length === 0) {
    removePersistedHistory(storage);
    return;
  }

  const payload = {
    version: STORAGE_VERSION,
    messages: completed.map(toPersistedMessage),
  };

  try {
    storage.setItem(AI_AGENT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota/security failures are intentionally silent.
  }
}

// --- Request history -------------------------------------------------------

function totalContentChars(messages: Array<{ content: string }>): number {
  return messages.reduce((total, message) => total + message.content.length, 0);
}

/**
 * Build the exact history the backend accepts:
 * - only completed, non-empty messages;
 * - no trailing user message without a completed assistant answer;
 * - newest messages, oldest first;
 * - at most four messages and 2,400 UTF-16 code units.
 */
export function buildRequestHistory(
  messages: AiChatMessage[],
  limits: { maxMessages?: number; maxChars?: number } = {},
): AiAgentChatMessage[] {
  const requestedMaxMessages =
    limits.maxMessages ?? AI_AGENT_HISTORY_MESSAGES;
  const requestedMaxChars = limits.maxChars ?? AI_AGENT_HISTORY_CHARS;
  const maxMessages = Number.isFinite(requestedMaxMessages)
    ? Math.max(0, Math.trunc(requestedMaxMessages))
    : AI_AGENT_HISTORY_MESSAGES;
  const maxChars = Number.isFinite(requestedMaxChars)
    ? Math.max(0, Math.trunc(requestedMaxChars))
    : AI_AGENT_HISTORY_CHARS;

  if (maxMessages === 0 || maxChars === 0) return [];

  const eligible = messages
    .filter(
      (message) =>
        message.status === 'complete' && message.content.length > 0,
    )
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

  // A failed/aborted assistant is filtered out above. Its user turn must also
  // not become a trailing user message (the backend would see consecutive
  // user roles after the next send).
  while (eligible.length > 0 && eligible[eligible.length - 1]?.role === 'user') {
    eligible.pop();
  }

  let selected = eligible.slice(-maxMessages);
  if (selected.length === 0) return [];

  while (selected.length > 1 && totalContentChars(selected) > maxChars) {
    selected = selected.slice(1);
  }

  if (totalContentChars(selected) > maxChars) {
    const last = selected[selected.length - 1];
    if (last === undefined) return [];
    selected = [
      {
        role: last.role,
        content: last.content.slice(last.content.length - maxChars),
      },
    ];
  }

  return selected.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

// --- IDs and timestamps ----------------------------------------------------

function createMessageId(): string {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject !== undefined && typeof cryptoObject.randomUUID === 'function') {
    try {
      return cryptoObject.randomUUID();
    } catch {
      // Fall through to the timestamp/random form.
    }
  }
  return `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createTimestamp(): string {
  return new Date().toISOString();
}

function createUserMessage(content: string): AiChatMessage {
  return {
    id: createMessageId(),
    role: 'user',
    content,
    createdAt: createTimestamp(),
    status: 'complete',
  };
}

function createAssistantPlaceholder(): AiChatMessage {
  return {
    id: createMessageId(),
    role: 'assistant',
    content: '',
    createdAt: createTimestamp(),
    status: 'streaming',
  };
}

function findLastUserIndex(messages: AiChatMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') return index;
  }
  return -1;
}

// --- Hook ------------------------------------------------------------------

export function useAiChat(options: UseAiChatOptions = {}) {
  const [state, dispatch] = useReducer(aiChatReducer, initialAiChatState);

  const stateRef = useRef(state);
  stateRef.current = state;

  const storage =
    options.storage === undefined
      ? getDefaultAiChatStorage()
      : options.storage;
  const storageRef = useRef<AiChatStorage | null>(storage);
  storageRef.current = storage;

  const hydratedRef = useRef(false);
  const mountedRef = useRef(true);
  const runIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const resetRef = useRef<() => void>(() => undefined);

  const locale = normalizeAiAgentLocale(options.locale);
  const continuePrompt = options.continuePrompt;

  const runStream = useCallback(
    async (
      message: string,
      history: AiAgentChatMessage[],
      assistantId: string,
      controller: AbortController,
      runId: number,
    ): Promise<void> => {
      const isCurrent = (): boolean =>
        mountedRef.current && runIdRef.current === runId;

      const handleLiveEvent = (event: AiAgentLiveEvent): void => {
        if (!isCurrent()) return;
        if (event.event === 'meta') {
          dispatch({ type: 'META', data: event.data });
          return;
        }
        if (event.event === 'status') {
          dispatch({ type: 'STATUS', data: event.data });
          return;
        }
        if (event.event === 'sources') {
          dispatch({ type: 'SOURCES', data: event.data });
          return;
        }
        dispatch({
          type: 'TOKEN',
          delta: event.data.delta,
          assistantId,
        });
      };

      try {
        const result = await streamChat(
          {
            message,
            locale,
            ...(history.length > 0 ? { history } : {}),
          },
          {
            signal: controller.signal,
            onEvent: handleLiveEvent,
          },
        );

        if (!isCurrent()) return;

        if (result.aborted) {
          dispatch({ type: 'ABORT' });
          return;
        }

        if (result.done === undefined) {
          dispatch({
            type: 'STREAM_ERROR',
            error: new AiAgentError('AI_AGENT_STREAM_INTERRUPTED'),
          });
          return;
        }

        if (result.done.finishReason === 'error') {
          dispatch({
            type: 'STREAM_ERROR',
            error: new AiAgentError('AI_AGENT_INTERNAL_ERROR'),
          });
          return;
        }

        dispatch({ type: 'DONE', data: result.done });
      } catch (error) {
        if (!isCurrent()) return;
        if (controller.signal.aborted) {
          dispatch({ type: 'ABORT' });
          return;
        }
        if (error instanceof AiAgentError) {
          dispatch({ type: 'STREAM_ERROR', error });
          return;
        }
        // Never let a raw error message (which could contain provider details)
        // reach React state or the UI.
        dispatch({
          type: 'STREAM_ERROR',
          error: new AiAgentError('AI_AGENT_INTERNAL_ERROR'),
        });
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
      }
    },
    [locale],
  );

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      if (
        stateRef.current.connection !== 'idle' ||
        controllerRef.current !== null
      ) {
        return false;
      }

      const message = typeof text === 'string' ? text.trim() : '';
      if (message === '' || message.length > AI_AGENT_MESSAGE_CHARS) {
        return false;
      }

      const history = buildRequestHistory(stateRef.current.messages);
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      const controller = new AbortController();
      controllerRef.current = controller;

      const user = createUserMessage(message);
      const assistant = createAssistantPlaceholder();
      dispatch({ type: 'SEND_START', user, assistant });

      await runStream(message, history, assistant.id, controller, runId);
      return true;
    },
    [runStream],
  );

  const abort = useCallback((): void => {
    if (
      stateRef.current.connection === 'idle' &&
      controllerRef.current === null
    ) {
      return;
    }

    runIdRef.current += 1;
    const controller = controllerRef.current;
    controllerRef.current = null;
    controller?.abort();
    dispatch({ type: 'ABORT' });
  }, []);

  const retry = useCallback(async (): Promise<boolean> => {
    const current = stateRef.current;
    if (current.connection !== 'idle' || controllerRef.current !== null) {
      return false;
    }

    const last = current.messages[current.messages.length - 1];
    if (
      last === undefined ||
      last.role !== 'assistant' ||
      (last.status !== 'error' && last.status !== 'aborted')
    ) {
      return false;
    }

    const userIndex = findLastUserIndex(current.messages);
    if (userIndex === -1) return false;
    const user = current.messages[userIndex];
    if (user === undefined) return false;

    const history = buildRequestHistory(current.messages.slice(0, userIndex));
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const controller = new AbortController();
    controllerRef.current = controller;
    const assistant = createAssistantPlaceholder();

    dispatch({ type: 'RETRY_START', assistant });
    await runStream(user.content, history, assistant.id, controller, runId);
    return true;
  }, [runStream]);

  const continueChat = useCallback(async (): Promise<boolean> => {
    const current = stateRef.current;
    if (current.connection !== 'idle' || controllerRef.current !== null) {
      return false;
    }

    const last = current.messages[current.messages.length - 1];
    if (
      last === undefined ||
      last.role !== 'assistant' ||
      last.status !== 'complete' ||
      !current.truncated
    ) {
      return false;
    }

    const requestedPrompt =
      typeof continuePrompt === 'string' ? continuePrompt.trim() : '';
    const message =
      requestedPrompt === '' || requestedPrompt.length > AI_AGENT_MESSAGE_CHARS
        ? DEFAULT_CONTINUE_PROMPT
        : requestedPrompt;

    const history = buildRequestHistory(current.messages);
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const controller = new AbortController();
    controllerRef.current = controller;

    const user = createUserMessage(message);
    const assistant = createAssistantPlaceholder();
    dispatch({ type: 'SEND_START', user, assistant });

    await runStream(message, history, assistant.id, controller, runId);
    return true;
  }, [continuePrompt, runStream]);

  const newChat = useCallback((): void => {
    runIdRef.current += 1;
    const controller = controllerRef.current;
    controllerRef.current = null;
    controller?.abort();
    dispatch({ type: 'RESET' });
    const activeStorage = storageRef.current;
    if (activeStorage !== null) removePersistedHistory(activeStorage);
  }, []);

  resetRef.current = newChat;

  // Hydrate once after mount. This never runs during SSR and is guarded so the
  // persistence effect below cannot clear a stored transcript on first paint.
  useEffect(() => {
    if (hydratedRef.current) return;
    const stored = loadAiChatHistory(storageRef.current);
    hydratedRef.current = true;
    dispatch({ type: 'HYDRATE', messages: stored });
  }, []);

  // Persist only settled, completed messages. The empty check is important on
  // the first render: the hydrate effect has not applied the stored transcript
  // yet, and writing an empty array would delete it.
  useEffect(() => {
    if (
      !hydratedRef.current ||
      state.connection !== 'idle' ||
      state.messages.length === 0
    ) {
      return;
    }
    persistAiChatMessages(state.messages, storageRef.current);
  }, [state.connection, state.messages]);

  // Logout/refresh-failure and session expiry both clear the transcript through
  // the same new-chat path. The ref keeps this subscription effect independent
  // of every render's state and callbacks.
  useEffect(() => {
    const unsubscribeCleared = subscribeAuthCleared(() => resetRef.current());
    const unsubscribeExpired = subscribeSessionExpired(() => resetRef.current());
    return () => {
      unsubscribeCleared();
      unsubscribeExpired();
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runIdRef.current += 1;
      const controller = controllerRef.current;
      controllerRef.current = null;
      controller?.abort();
    };
  }, []);

  const lastMessage = state.messages[state.messages.length - 1];
  const canRetry =
    state.connection === 'idle' &&
    lastMessage !== undefined &&
    lastMessage.role === 'assistant' &&
    (lastMessage.status === 'error' || lastMessage.status === 'aborted');
  const canContinue =
    state.connection === 'idle' &&
    lastMessage !== undefined &&
    lastMessage.role === 'assistant' &&
    lastMessage.status === 'complete' &&
    state.truncated;

  return {
    messages: state.messages,
    connection: state.connection,
    isStreaming: state.connection !== 'idle',
    status: state.status,
    sources: state.sources,
    mode: state.mode,
    truncated: state.truncated,
    error: state.error,
    conversationId: state.conversationId,
    lastUsage: state.lastUsage,
    canSend: state.connection === 'idle',
    canRetry,
    canContinue,
    limits: {
      messageChars: AI_AGENT_MESSAGE_CHARS,
      historyMessages: AI_AGENT_HISTORY_MESSAGES,
      historyChars: AI_AGENT_HISTORY_CHARS,
    } satisfies AiChatLimits,
    send,
    abort,
    retry,
    continueChat,
    newChat,
  };
}
