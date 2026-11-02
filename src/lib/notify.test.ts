import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/errors';
import {
  DEDUPE_WINDOW_MS,
  ERROR_DURATION_MS,
  SUCCESS_DURATION_MS,
  configureNotify,
  error,
  fromError,
  notify,
  resetNotifyForTests,
  success,
} from './notify';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const successToast = vi.mocked(toast.success);
const errorToast = vi.mocked(toast.error);

function configure(announceError?: (message: string) => void) {
  return configureNotify({
    t: (key, values) => `${key}${values?.name ? `:${values.name}` : ''}`,
    announceError,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  resetNotifyForTests();
  successToast.mockClear();
  errorToast.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('notify.success', () => {
  it('does nothing before the layout registers a translator', () => {
    success('success.generic');
    expect(successToast).not.toHaveBeenCalled();

    configure();
    success('success.generic');
    expect(successToast).toHaveBeenCalledTimes(1);
  });

  it('shows translated copy with the 3s success contract', () => {
    configure();
    success('success.skillAdded', { name: 'Design' });

    expect(successToast).toHaveBeenCalledWith('success.skillAdded:Design', {
      id: 'success.skillAdded',
      duration: SUCCESS_DURATION_MS,
      closeButton: false,
      testId: 'app-toast',
    });
    expect(SUCCESS_DURATION_MS).toBe(3_000);
  });
});

describe('notify.error', () => {
  it('shows the 5s error contract with a close button and assertive copy', () => {
    const announce = vi.fn();
    configure(announce);
    error('error.server');

    expect(errorToast).toHaveBeenCalledWith('error.server', {
      id: 'error.server',
      duration: ERROR_DURATION_MS,
      closeButton: true,
      testId: 'app-toast',
    });
    expect(ERROR_DURATION_MS).toBe(5_000);
    expect(announce).toHaveBeenCalledWith('error.server');
  });
});

describe('deduplication', () => {
  it('collapses the same key inside two seconds and allows it afterwards', () => {
    configure();
    success('success.generic');
    success('success.generic');
    expect(successToast).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(DEDUPE_WINDOW_MS - 1);
    success('success.generic');
    expect(successToast).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    success('success.generic');
    expect(successToast).toHaveBeenCalledTimes(2);
  });

  it('deduplicates success and error keys independently', () => {
    configure();
    success('success.generic');
    error('error.generic');
    expect(successToast).toHaveBeenCalledTimes(1);
    expect(errorToast).toHaveBeenCalledTimes(1);

    error('error.generic');
    expect(errorToast).toHaveBeenCalledTimes(1);
  });
});

describe('notify.fromError', () => {
  it('maps unknown failures to the generic key', () => {
    configure();
    fromError(new Error('secret backend text'));
    expect(errorToast).toHaveBeenCalledWith(
      'error.generic',
      expect.objectContaining({ id: 'error.generic' }),
    );
  });

  it('uses the supplied fallback only for unmapped failures', () => {
    configure();
    fromError(new Error('boom'), 'error.uploadFailed');
    expect(errorToast).toHaveBeenLastCalledWith(
      'error.uploadFailed',
      expect.objectContaining({ id: 'error.uploadFailed' }),
    );

    fromError(
      new ApiError({ statusCode: 429, code: 'RATE_LIMITED', message: 'Slow down' }),
      'error.uploadFailed',
    );
    expect(errorToast).toHaveBeenLastCalledWith(
      'error.rateLimited',
      expect.objectContaining({ id: 'error.rateLimited' }),
    );
  });
});

describe('translator lifecycle', () => {
  it('keeps a newer translator when an older cleanup runs', () => {
    const cleanupFirst = configure();
    configure();
    cleanupFirst();
    success('success.generic');
    expect(successToast).toHaveBeenCalledTimes(1);
  });

  it('cleans up the active translator', () => {
    const cleanup = configure();
    cleanup();
    success('success.generic');
    expect(successToast).not.toHaveBeenCalled();
  });

  it('exposes the same helpers on the notify object', () => {
    configure();
    notify.success('success.generic');
    notify.error('error.generic');
    expect(successToast).toHaveBeenCalledTimes(1);
    expect(errorToast).toHaveBeenCalledTimes(1);
  });
});
