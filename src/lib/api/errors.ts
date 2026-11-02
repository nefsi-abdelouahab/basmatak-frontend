import { isAxiosError } from 'axios';

// Mirrors the backend error envelope:
// { statusCode, code, message, details? } with UPPER_SNAKE business codes.

export interface ApiErrorShape {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  /** Set by mapToApiError when `message` came verbatim from the backend envelope. */
  hasBackendMessage?: boolean;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;
  readonly hasBackendMessage: boolean;

  constructor(shape: ApiErrorShape) {
    super(shape.message);
    this.name = 'ApiError';
    this.statusCode = shape.statusCode;
    this.code = shape.code;
    this.details = shape.details;
    this.hasBackendMessage = shape.hasBackendMessage ?? false;
  }
}

export type ApiErrorState =
  | 'session-expired'
  | 'forbidden'
  | 'not-found'
  | 'rate-limited'
  | 'maintenance'
  | 'server-error'
  | 'network-error';

const FALLBACK_BY_STATUS: Record<number, { code: string; message: string }> = {
  400: { code: 'BAD_REQUEST', message: 'The request was invalid.' },
  401: { code: 'UNAUTHORIZED', message: 'Your session has expired.' },
  403: { code: 'FORBIDDEN', message: 'Access denied.' },
  404: { code: 'NOT_FOUND', message: 'The requested resource was not found.' },
  409: { code: 'CONFLICT', message: 'The request conflicts with the current state.' },
  422: { code: 'VALIDATION_FAILED', message: 'The submitted data was invalid.' },
  429: { code: 'RATE_LIMITED', message: 'Too many requests.' },
  503: { code: 'SERVICE_UNAVAILABLE', message: 'The service is temporarily unavailable.' },
};

export function mapToApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (isAxiosError(err)) {
    const status = err.response?.status;
    if (typeof status === 'number') {
      const data = err.response?.data as Partial<ApiErrorShape> | undefined;
      const fallback = FALLBACK_BY_STATUS[status] ?? {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred.',
      };
      const hasBackendMessage =
        typeof data?.message === 'string' && data.message.trim().length > 0;
      return new ApiError({
        statusCode: typeof data?.statusCode === 'number' ? data.statusCode : status,
        code: typeof data?.code === 'string' ? data.code : fallback.code,
        message: hasBackendMessage ? (data?.message as string) : fallback.message,
        details: data?.details,
        hasBackendMessage,
      });
    }
    const timedOut = err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT';
    return new ApiError({
      statusCode: 0,
      code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: timedOut ? 'The request took too long.' : 'Could not reach the server.',
    });
  }
  return new ApiError({
    statusCode: 0,
    code: 'UNKNOWN_ERROR',
    message: err instanceof Error ? err.message : 'An unexpected error occurred.',
  });
}

export function errorStateFor(error: ApiError): ApiErrorState {
  switch (error.statusCode) {
    case 0:
      return error.code === 'NETWORK_ERROR' ? 'network-error' : 'server-error';
    case 401:
      return 'session-expired';
    case 403:
      return 'forbidden';
    case 404:
      return 'not-found';
    case 429:
      return 'rate-limited';
    case 503:
      return 'maintenance';
    default:
      return 'server-error';
  }
}

// Backend-owned message for user-facing renders: returns the envelope message
// when the backend actually sent one (verbatim, both locales), else null so
// callers fall back to catalog copy instead of the hardcoded English
// FALLBACK_BY_STATUS strings. Accepts raw axios rejections and already-mapped
// ApiErrors (provenance rides on hasBackendMessage).
export function backendMessageOf(err: unknown): string | null {
  if (err instanceof ApiError) {
    return err.hasBackendMessage ? err.message : null;
  }
  if (isAxiosError(err)) {
    const data = err.response?.data as Partial<ApiErrorShape> | undefined;
    if (typeof data?.message === 'string' && data.message.trim().length > 0) {
      return data.message;
    }
  }
  return null;
}

// Business code extracted from the same envelope (never display copy). Raw
// axios rejections and mapped ApiErrors both resolve; transport-level codes
// such as ECONNABORTED stay out of the business-code space.
export function backendCodeOf(err: unknown): string | null {
  if (err instanceof ApiError) return err.code || null;
  if (isAxiosError(err)) {
    const data = err.response?.data as Partial<ApiErrorShape> | undefined;
    if (typeof data?.code === 'string' && data.code.trim().length > 0) {
      return data.code;
    }
  }
  return null;
}
