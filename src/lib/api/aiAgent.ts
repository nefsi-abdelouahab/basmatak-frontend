import type { AxiosInstance } from 'axios';
import { z } from 'zod';
import { createSseParser } from './sse';

/**
 * Frontend transport for the public Basmatak AI assistant.
 *
 * The backend contract is intentionally narrow: status is a small public JSON
 * payload, and chat is a POST that answers with an SSE stream. No provider,
 * model, key, token-accounting detail, or internal path is ever exposed here.
 * Keep event payload types additive so a future optional field does not break
 * older clients.
 */

export type AiAgentLocale = 'en' | 'ar';

/**
 * The UI may offer French even though the chat DTO only accepts `en` or `ar`.
 * `normalizeAiAgentLocale` maps it to `en`; French answers are driven by the
 * backend's message-text detection until the DTO supports `fr`.
 */
export type AiAgentUiLocale = AiAgentLocale | 'fr';

export type AiAgentMode =
  | 'normal'
  | 'conservative'
  | 'knowledge_only'
  | 'retrieval_only'
  | 'exhausted';

export type AiAgentStatusState = 'searching' | 'thinking' | 'answering' | 'tool';

export type AiAgentChatRole = 'user' | 'assistant';

export type AiAgentFinishReason = 'stop' | 'length' | 'error';

export type AiAgentDataSourceType =
  | 'opportunity'
  | 'organization'
  | 'reference'
  | 'stats';

export interface AiAgentChatMessage {
  role: AiAgentChatRole;
  content: string;
}

export interface AiAgentMetaEvent {
  conversationId: string;
  locale: AiAgentLocale;
  mode: AiAgentMode;
}

export interface AiAgentStatusEvent {
  state: AiAgentStatusState;
  tool?: string;
}

export interface AiAgentTokenEvent {
  delta: string;
}

export interface AiAgentUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimated?: boolean;
}

export interface AiAgentDoneEvent {
  finishReason: AiAgentFinishReason;
  truncated?: boolean;
  usage?: AiAgentUsage;
}

export interface AiAgentKnowledgeSource {
  id: string;
  title: string;
  source: string;
  heading?: string;
}

export interface AiAgentDataSource {
  id: string;
  citationId: string;
  type: AiAgentDataSourceType;
  title: string;
  path?: string;
}

export interface AiAgentSourcesEvent {
  knowledge: AiAgentKnowledgeSource[];
  data: AiAgentDataSource[];
}

/**
 * The backend keeps its error code a string so a future policy code can reach
 * an older client without crashing it. Known codes are mapped to safe copy
 * below; unknown codes fall back to the generic message.
 */
export interface AiAgentErrorEvent {
  code: string;
  message: string;
  retryAfterSeconds?: number;
}

export interface AiAgentKnowledgeCounts {
  files: number;
  chunks: number;
}

export interface AiAgentPublicLimits {
  messageChars: number;
  historyMessages: number;
  historyChars: number;
}

export interface AiAgentStatusResponse {
  enabled: boolean;
  mode: AiAgentMode;
  knowledge: AiAgentKnowledgeCounts;
  limits: AiAgentPublicLimits;
}

export interface AiAgentChatRequest {
  message: string;
  locale: AiAgentLocale;
  history?: AiAgentChatMessage[];
}

export type AiAgentLiveEvent =
  | { event: 'meta'; data: AiAgentMetaEvent }
  | { event: 'status'; data: AiAgentStatusEvent }
  | { event: 'sources'; data: AiAgentSourcesEvent }
  | { event: 'token'; data: AiAgentTokenEvent };

export interface AiAgentStreamOptions {
  signal?: AbortSignal;
  onEvent?: (event: AiAgentLiveEvent) => void;
  fetchImpl?: typeof fetch;
  baseURL?: string;
}

export interface AiAgentStreamResult {
  text: string;
  meta?: AiAgentMetaEvent;
  sources?: AiAgentSourcesEvent;
  done?: AiAgentDoneEvent;
  aborted: boolean;
}

export const AI_AGENT_MESSAGE_CHARS = 2000;
export const AI_AGENT_HISTORY_MESSAGES = 4;
export const AI_AGENT_HISTORY_CHARS = 2400;

const FALLBACK_BASE_URL = 'http://localhost:3000/api/v1';

// --- Zod schemas -----------------------------------------------------------

const nonNegativeInteger = z.number().int().nonnegative();
const nonNegativeNumber = z.number().nonnegative();

export const AiAgentLocaleSchema = z.enum(['en', 'ar']);

export const AiAgentModeSchema = z.enum([
  'normal',
  'conservative',
  'knowledge_only',
  'retrieval_only',
  'exhausted',
]);

export const AiAgentStatusStateSchema = z.enum([
  'searching',
  'thinking',
  'answering',
  'tool',
]);

export const AiAgentChatRoleSchema = z.enum(['user', 'assistant']);

export const AiAgentFinishReasonSchema = z.enum(['stop', 'length', 'error']);

export const AiAgentDataSourceTypeSchema = z.enum([
  'opportunity',
  'organization',
  'reference',
  'stats',
]);

export const AiAgentChatMessageSchema = z
  .object({
    role: AiAgentChatRoleSchema,
    content: z.string(),
  })
  .passthrough();

export const AiAgentUsageSchema = z
  .object({
    inputTokens: nonNegativeInteger,
    outputTokens: nonNegativeInteger,
    totalTokens: nonNegativeInteger,
    estimated: z.boolean().optional(),
  })
  .passthrough();

export const AiAgentMetaEventSchema = z
  .object({
    conversationId: z.string(),
    locale: AiAgentLocaleSchema,
    mode: AiAgentModeSchema,
  })
  .passthrough();

export const AiAgentStatusEventSchema = z
  .object({
    state: AiAgentStatusStateSchema,
    tool: z.string().optional(),
  })
  .passthrough();

export const AiAgentTokenEventSchema = z
  .object({
    delta: z.string(),
  })
  .passthrough();

export const AiAgentDoneEventSchema = z
  .object({
    finishReason: AiAgentFinishReasonSchema,
    truncated: z.boolean().optional(),
    usage: AiAgentUsageSchema.optional(),
  })
  .passthrough();

export const AiAgentKnowledgeSourceSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    source: z.string(),
    heading: z.string().optional(),
  })
  .passthrough();

export const AiAgentDataSourceSchema = z
  .object({
    id: z.string(),
    citationId: z.string(),
    type: AiAgentDataSourceTypeSchema,
    title: z.string(),
    path: z.string().optional(),
  })
  .passthrough();

export const AiAgentSourcesEventSchema = z
  .object({
    knowledge: z.array(AiAgentKnowledgeSourceSchema),
    data: z.array(AiAgentDataSourceSchema),
  })
  .passthrough();

export const AiAgentErrorEventSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    retryAfterSeconds: nonNegativeNumber.optional(),
  })
  .passthrough();

export const AiAgentKnowledgeCountsSchema = z
  .object({
    files: nonNegativeInteger,
    chunks: nonNegativeInteger,
  })
  .passthrough();

export const AiAgentPublicLimitsSchema = z
  .object({
    messageChars: nonNegativeInteger,
    historyMessages: nonNegativeInteger,
    historyChars: nonNegativeInteger,
  })
  .passthrough();

export const AiAgentStatusSchema = z
  .object({
    enabled: z.boolean(),
    mode: AiAgentModeSchema,
    knowledge: AiAgentKnowledgeCountsSchema,
    limits: AiAgentPublicLimitsSchema,
  })
  .passthrough();

// Friendly aliases for callers that prefer the contract type name.
export const AiAgentStatusResponseSchema = AiAgentStatusSchema;
export const AiAgentSourcesSchema = AiAgentSourcesEventSchema;

// --- User-safe errors ------------------------------------------------------

const GENERIC_ERROR_MESSAGE =
  'The assistant could not complete the response. Please try again.';

const SAFE_ERROR_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  AI_AGENT_DISABLED:
    'The assistant is temporarily unavailable. Please try again shortly.',
  AI_AGENT_INVALID_INPUT: 'Please check the message length and try again.',
  VALIDATION_ERROR: 'Please check the message length and try again.',
  RATE_LIMITED: 'Too many messages. Please wait a moment and try again.',
  AI_AGENT_BUSY: 'The assistant is busy right now. Please retry shortly.',
  AI_AGENT_QUOTA_EXHAUSTED:
    'The assistant has reached its usage limit. Please try again later.',
  AI_AGENT_PROVIDER_UNAVAILABLE:
    'The assistant is temporarily unavailable. Please retry.',
  AI_AGENT_TIMEOUT: 'The assistant took too long to answer. Please retry.',
  AI_AGENT_INTERNAL_ERROR: GENERIC_ERROR_MESSAGE,
  INTERNAL_SERVER_ERROR: GENERIC_ERROR_MESSAGE,
  NETWORK_ERROR:
    'Could not reach the server. Please check your connection and try again.',
  AI_AGENT_STREAM_INTERRUPTED:
    'The answer stopped unexpectedly. Please retry.',
  AI_AGENT_INVALID_RESPONSE:
    'The assistant returned an unexpected response. Please retry.',
});

export function aiAgentErrorMessage(code: string): string {
  return SAFE_ERROR_MESSAGES[code] ?? GENERIC_ERROR_MESSAGE;
}

export interface AiAgentErrorOptions {
  statusCode?: number;
  retryAfterSeconds?: number;
  partialText?: string;
  meta?: AiAgentMetaEvent;
  sources?: AiAgentSourcesEvent;
}

export class AiAgentError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly retryAfterSeconds?: number;
  readonly partialText?: string;
  readonly meta?: AiAgentMetaEvent;
  readonly sources?: AiAgentSourcesEvent;
  readonly userMessage: string;

  constructor(code: string, options: AiAgentErrorOptions = {}) {
    const userMessage = aiAgentErrorMessage(code);
    super(userMessage);
    this.name = 'AiAgentError';
    this.code = code;
    this.statusCode = options.statusCode ?? 0;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.partialText = options.partialText;
    this.meta = options.meta;
    this.sources = options.sources;
    this.userMessage = userMessage;
    // Required when targeting ES2017 and extending a built-in.
    Object.setPrototypeOf(this, AiAgentError.prototype);
  }
}

export function normalizeAiAgentLocale(
  locale: AiAgentUiLocale | string | undefined,
): AiAgentLocale {
  if (locale === 'ar') return 'ar';
  // French is intentionally not sent: the DTO accepts only en/ar. The backend
  // still detects French from the message text and answers in French.
  return 'en';
}

// --- Status ----------------------------------------------------------------

type HttpClient = Pick<AxiosInstance, 'get'>;

export async function getAiAgentStatus(
  client: HttpClient,
): Promise<AiAgentStatusResponse> {
  const { data } = await client.get('/ai-agent/status');
  return AiAgentStatusSchema.parse(data);
}

// --- Chat streaming --------------------------------------------------------

const KNOWN_EVENT_NAMES = new Set([
  'meta',
  'status',
  'sources',
  'token',
  'done',
  'error',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isAbortLike(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return (
    isRecord(error) &&
    (error.name === 'AbortError' || error.name === 'Abort')
  );
}

function fallbackCodeForStatus(status: number): string {
  if (status === 400) return 'VALIDATION_ERROR';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'AI_AGENT_DISABLED';
  if (status >= 500) return 'INTERNAL_SERVER_ERROR';
  return 'HTTP_ERROR';
}

function parseRetryAfterHeader(value: string | null): number | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;

  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) ? seconds : undefined;
  }

  const date = Date.parse(trimmed);
  if (!Number.isFinite(date)) return undefined;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

function retryAfterFromEnvelope(envelope: unknown): number | undefined {
  if (!isRecord(envelope) || !isRecord(envelope.details)) return undefined;
  const value = envelope.details.retryAfterSeconds;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

async function mapHttpError(response: Response): Promise<AiAgentError> {
  let envelope: unknown;
  try {
    envelope = await response.json();
  } catch {
    // A malformed or empty error body is expected to be handled safely.
  }

  const code =
    isRecord(envelope) && typeof envelope.code === 'string' && envelope.code !== ''
      ? envelope.code
      : fallbackCodeForStatus(response.status);

  const retryAfterSeconds =
    retryAfterFromEnvelope(envelope) ??
    parseRetryAfterHeader(response.headers.get('retry-after'));

  // Deliberately never use the backend's message: it can contain provider
  // details. `details.retryAfterSeconds` is authoritative because the current
  // CORS surface does not expose `Retry-After` to browsers.
  return new AiAgentError(code, {
    statusCode: response.status,
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  });
}

function resolveBaseURL(baseURL?: string): string {
  const value =
    baseURL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? FALLBACK_BASE_URL;
  return value.replace(/\/+$/, '');
}

function validateChatRequest(input: AiAgentChatRequest): void {
  if (
    typeof input.message !== 'string' ||
    input.message.length === 0 ||
    input.message.length > AI_AGENT_MESSAGE_CHARS ||
    !/\S/.test(input.message)
  ) {
    throw new AiAgentError('VALIDATION_ERROR');
  }

  if (input.locale !== 'en' && input.locale !== 'ar') {
    throw new AiAgentError('VALIDATION_ERROR');
  }

  if (input.history === undefined) return;
  if (!Array.isArray(input.history) || input.history.length > AI_AGENT_HISTORY_MESSAGES) {
    throw new AiAgentError('VALIDATION_ERROR');
  }

  let totalChars = 0;
  for (const message of input.history) {
    if (
      !isRecord(message) ||
      (message.role !== 'user' && message.role !== 'assistant') ||
      typeof message.content !== 'string' ||
      message.content.length === 0
    ) {
      throw new AiAgentError('VALIDATION_ERROR');
    }
    totalChars += message.content.length;
  }

  if (totalChars > AI_AGENT_HISTORY_CHARS) {
    throw new AiAgentError('VALIDATION_ERROR');
  }
}

export async function streamChat(
  input: AiAgentChatRequest,
  options: AiAgentStreamOptions = {},
): Promise<AiAgentStreamResult> {
  validateChatRequest(input);

  const signal = options.signal;
  if (signal?.aborted) {
    return { text: '', aborted: true };
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new AiAgentError('NETWORK_ERROR');
  }

  const history = input.history ?? [];
  const body = {
    message: input.message,
    locale: input.locale,
    ...(history.length > 0
      ? {
          history: history.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }
      : {}),
  };

  let response: Response;
  try {
    response = await fetchImpl(
      `${resolveBaseURL(options.baseURL)}/ai-agent/chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal,
      },
    );
  } catch (error) {
    if (isAbortLike(error, signal)) {
      return { text: '', aborted: true };
    }
    throw new AiAgentError('NETWORK_ERROR');
  }

  if (!response.ok) {
    throw await mapHttpError(response);
  }

  const contentType = response.headers.get('content-type');
  if (contentType !== null && !contentType.toLowerCase().includes('text/event-stream')) {
    throw new AiAgentError('AI_AGENT_INVALID_RESPONSE', {
      statusCode: response.status,
    });
  }

  if (response.body === null) {
    throw new AiAgentError('AI_AGENT_STREAM_INTERRUPTED', {
      statusCode: response.status,
    });
  }

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = response.body.getReader();
  } catch {
    throw new AiAgentError('AI_AGENT_STREAM_INTERRUPTED', {
      statusCode: response.status,
    });
  }

  const parser = createSseParser();
  let text = '';
  let meta: AiAgentMetaEvent | undefined;
  let sources: AiAgentSourcesEvent | undefined;
  let done: AiAgentDoneEvent | undefined;

  try {
    while (true) {
      const read = await reader.read();
      if (read.done) break;

      for (const frame of parser.push(read.value)) {
        if (!KNOWN_EVENT_NAMES.has(frame.event)) continue;

        let payload: unknown;
        try {
          payload = JSON.parse(frame.data);
        } catch {
          if (frame.event === 'error') {
            throw new AiAgentError('AI_AGENT_STREAM_INTERRUPTED', {
              statusCode: response.status,
              partialText: text,
              meta,
              sources,
            });
          }
          continue;
        }

        if (frame.event === 'meta') {
          const parsed = AiAgentMetaEventSchema.safeParse(payload);
          if (!parsed.success) continue;
          meta = parsed.data;
          options.onEvent?.({ event: 'meta', data: parsed.data });
          continue;
        }

        if (frame.event === 'status') {
          const parsed = AiAgentStatusEventSchema.safeParse(payload);
          if (!parsed.success) continue;
          options.onEvent?.({ event: 'status', data: parsed.data });
          continue;
        }

        if (frame.event === 'sources') {
          const parsed = AiAgentSourcesEventSchema.safeParse(payload);
          if (!parsed.success) continue;
          sources = parsed.data;
          options.onEvent?.({ event: 'sources', data: parsed.data });
          continue;
        }

        if (frame.event === 'token') {
          const parsed = AiAgentTokenEventSchema.safeParse(payload);
          if (!parsed.success) continue;
          if (parsed.data.delta === '') continue;
          text += parsed.data.delta;
          options.onEvent?.({ event: 'token', data: parsed.data });
          continue;
        }

        if (frame.event === 'done') {
          const parsed = AiAgentDoneEventSchema.safeParse(payload);
          if (!parsed.success) continue;
          done = parsed.data;
          break;
        }

        // The remaining known event is `error`, which is terminal and never
        // followed by `done`.
        const parsed = AiAgentErrorEventSchema.safeParse(payload);
        if (!parsed.success) {
          throw new AiAgentError('AI_AGENT_STREAM_INTERRUPTED', {
            statusCode: response.status,
            partialText: text,
            meta,
            sources,
          });
        }
        throw new AiAgentError(parsed.data.code, {
          statusCode: response.status,
          ...(parsed.data.retryAfterSeconds !== undefined
            ? { retryAfterSeconds: parsed.data.retryAfterSeconds }
            : {}),
          partialText: text,
          meta,
          sources,
        });
      }

      if (done !== undefined) break;
    }

    if (done !== undefined) {
      return {
        text,
        ...(meta !== undefined ? { meta } : {}),
        ...(sources !== undefined ? { sources } : {}),
        done,
        aborted: false,
      };
    }

    parser.end();
    throw new AiAgentError('AI_AGENT_STREAM_INTERRUPTED', {
      statusCode: response.status,
      partialText: text,
      meta,
      sources,
    });
  } catch (error) {
    if (error instanceof AiAgentError) throw error;
    if (isAbortLike(error, signal)) {
      return {
        text,
        ...(meta !== undefined ? { meta } : {}),
        ...(sources !== undefined ? { sources } : {}),
        aborted: true,
      };
    }
    throw new AiAgentError('NETWORK_ERROR', {
      statusCode: response.status,
      partialText: text,
      meta,
      sources,
    });
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Cancellation is best-effort; the stream may already be closed.
    }
  }
}
