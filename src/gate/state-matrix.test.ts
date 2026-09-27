import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError, errorStateFor, mapToApiError } from '../lib/api/errors';

// F19 gate check (5) — state matrix, unit half (the rendered half lives in
// e2e/gate-state-matrix.spec.ts).
// Every screen must honor loading/empty/error + the unified error states
// (401 session-expired, 403 variants, 404, 429, 503 maintenance).

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..');

describe('F19 gate (5): state matrix (unit)', () => {
  it('maps every contract status to its error state', () => {
    const stateFor = (status: number): string =>
      errorStateFor(new ApiError({ statusCode: status, code: `C${status}`, message: 'x' }));
    expect(stateFor(401)).toBe('session-expired');
    expect(stateFor(403)).toBe('forbidden');
    expect(stateFor(404)).toBe('not-found');
    expect(stateFor(429)).toBe('rate-limited');
    expect(stateFor(503)).toBe('maintenance');
    expect(stateFor(500)).toBe('server-error');
    expect(errorStateFor(new ApiError({ statusCode: 0, code: 'NETWORK_ERROR', message: 'x' }))).toBe(
      'network-error',
    );
  });

  it('preserves backend business codes (403 variants, consent, throttling)', () => {
    const statusFor = (code: string): number => (code === 'CONSENT_REQUIRED' ? 400 : code === 'RATE_LIMITED' ? 429 : 403);
    for (const code of [
      'FORBIDDEN',
      'ACCOUNT_SUSPENDED',
      'ACCOUNT_INACCESSIBLE',
      'EMAIL_NOT_VERIFIED',
      'CONSENT_REQUIRED',
      'RATE_LIMITED',
    ]) {
      const status = statusFor(code);
      const err = mapToApiError({
        response: { status, data: { statusCode: status, code, message: code } },
        isAxiosError: true,
      });
      expect(err.code).toBe(code);
    }
  });

  it('the forbidden screen resolves all four 403 variants to distinct sub-states', () => {
    const screen = fs.readFileSync(
      path.join(SRC, 'components', 'system', 'ForbiddenScreen.tsx'),
      'utf8',
    );
    for (const code of ['FORBIDDEN', 'ACCOUNT_SUSPENDED', 'ACCOUNT_INACCESSIBLE', 'EMAIL_NOT_VERIFIED']) {
      expect(screen, `ForbiddenScreen handles ${code}`).toContain(code);
    }
    expect(screen).toContain('system-forbidden');
  });

  it('all seven system screens exist behind one shared shell', () => {
    const dir = path.join(SRC, 'components', 'system');
    for (const file of [
      'SystemScreen.tsx',
      'NotFoundScreen.tsx',
      'ForbiddenScreen.tsx',
      'ServerErrorScreen.tsx',
      'MaintenanceScreen.tsx',
      'NetworkErrorScreen.tsx',
      'SessionExpiredScreen.tsx',
      'RateLimitedScreen.tsx',
    ]) {
      expect(fs.existsSync(path.join(dir, file)), file).toBe(true);
    }
    const shared = fs.readFileSync(path.join(dir, 'SystemScreen.tsx'), 'utf8');
    expect(shared).toContain('bg-primary');
  });

  it('loading/empty/error primitives follow the loading → error → data convention', () => {
    for (const file of ['Loader.tsx', 'Empty.tsx', 'Pagination.tsx']) {
      expect(fs.existsSync(path.join(SRC, 'components', 'ui', file)), file).toBe(true);
    }
    const dashboard = fs.readFileSync(
      path.join(SRC, 'app', '[locale]', 'volunteer', 'dashboard', 'VolunteerDashboardPage.tsx'),
      'utf8',
    );
    expect(dashboard).toContain('<Loader');
    expect(dashboard).toContain('isError');
    expect(dashboard).toContain('<Empty');
  });
});
