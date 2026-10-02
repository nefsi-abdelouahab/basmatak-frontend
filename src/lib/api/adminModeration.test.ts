// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  ADMIN_SETTING_KEYS,
  buildReportCsvParams,
  buildReportListParams,
  buildResolveActionPayload,
  canResolveWithPayload,
  coerceSettingValue,
  isCompatibleActionTarget,
  isMaintenanceMessageValid,
  isNoticeValid,
  isResolutionValid,
  listAdminReports,
  listAdminSettings,
  resolveAdminReport,
  settingDefOf,
  toggleMaintenance,
  updateAdminSetting,
  validateSettingValue,
} from './adminModeration';

function stubClient(handlers: {
  get?: (url: string, config?: { params?: unknown }) => unknown;
  patch?: (url: string, body?: unknown) => unknown;
  post?: (url: string, body?: unknown) => unknown;
  put?: (url: string, body?: unknown) => unknown;
}) {
  const get = vi.fn(async (url: string, config?: { params?: unknown }) => ({
    data: handlers.get?.(url, config),
    headers: {},
  }));
  const patch = vi.fn(async (url: string, body?: unknown) => ({
    data: handlers.patch?.(url, body),
  }));
  const post = vi.fn(async (url: string, body?: unknown) => ({
    data: handlers.post?.(url, body),
  }));
  const put = vi.fn(async (url: string, body?: unknown) => ({
    data: handlers.put?.(url, body),
  }));
  const client = { get, patch, post, put } as unknown as AxiosInstance;
  return { client, get, patch, post, put };
}

const reportRow = (overrides: Record<string, unknown> = {}) => ({
  _id: '64f0000000000000000000r1',
  status: 'open',
  targetType: 'opportunity',
  targetId: '64f0000000000000000000o1',
  reason: 'Spam listing',
  priority: 'normal',
  ...overrides,
});

const reportPage = (items: unknown[]) => ({
  items,
  nextCursor: null,
  limit: 20,
  total: items.length,
  page: 1,
  pages: 1,
});

describe('buildReportListParams', () => {
  it('keeps valid vocabularies and drops blanks/unknowns', () => {
    expect(
      buildReportListParams({
        status: 'open',
        targetType: 'user',
        priority: 'high',
        assignedAdminId: '  ',
        q: '',
        from: '',
        sort: 'bogus',
      }),
    ).toEqual({ status: 'open', targetType: 'user', priority: 'high' });
  });

  it('keeps q/from/to/sort/cursor/limit when set', () => {
    expect(
      buildReportListParams({
        q: '  spam  ',
        from: '2026-09-01',
        to: '2026-09-30',
        sort: 'priority',
        cursor: 'cur',
        limit: 20,
      }),
    ).toEqual({
      q: 'spam',
      from: '2026-09-01',
      to: '2026-09-30',
      sort: 'priority',
      cursor: 'cur',
      limit: 20,
    });
  });

  it('CSV params mirror filters plus format=csv', () => {
    expect(buildReportCsvParams({ status: 'open', q: 'spam' })).toEqual({
      status: 'open',
      q: 'spam',
      format: 'csv',
    });
  });
});

describe('action compatibility matrix', () => {
  it('allows opportunity actions on opportunity targets only', () => {
    expect(isCompatibleActionTarget('unpublish_opportunity', 'opportunity')).toBe(true);
    expect(isCompatibleActionTarget('close_opportunity', 'opportunity')).toBe(true);
    expect(isCompatibleActionTarget('unpublish_opportunity', 'user')).toBe(false);
    expect(isCompatibleActionTarget('close_opportunity', 'organization')).toBe(false);
  });

  it('allows suspend on user|organization targets only', () => {
    expect(isCompatibleActionTarget('suspend_target', 'user')).toBe(true);
    expect(isCompatibleActionTarget('suspend_target', 'organization')).toBe(true);
    expect(isCompatibleActionTarget('suspend_target', 'opportunity')).toBe(false);
    expect(isCompatibleActionTarget('suspend_target', 'review')).toBe(false);
  });

  it('allows notice on any target type but rejects unknown actions', () => {
    for (const target of ['opportunity', 'user', 'organization', 'review', 'submission']) {
      expect(isCompatibleActionTarget('notice', target)).toBe(true);
    }
    expect(isCompatibleActionTarget('sanction_target', 'user')).toBe(false);
    expect(isCompatibleActionTarget('', 'user')).toBe(false);
  });
});

describe('buildResolveActionPayload', () => {
  it('builds bare actions without payloads', () => {
    expect(
      buildResolveActionPayload({ actionType: 'unpublish_opportunity' }, 'opportunity'),
    ).toEqual({ type: 'unpublish_opportunity' });
    expect(buildResolveActionPayload({ actionType: 'suspend_target' }, 'user')).toEqual({
      type: 'suspend_target',
    });
  });

  it('returns null for incompatible pairs and unknown types', () => {
    expect(buildResolveActionPayload({ actionType: 'suspend_target' }, 'opportunity')).toBeNull();
    expect(
      buildResolveActionPayload({ actionType: 'unpublish_opportunity' }, 'user'),
    ).toBeNull();
    expect(
      buildResolveActionPayload(
        { actionType: 'sanction_target' as never },
        'user',
      ),
    ).toBeNull();
  });

  it('requires userId + valid message for the notice action', () => {
    expect(
      buildResolveActionPayload(
        { actionType: 'notice', noticeUserId: 'u1', noticeMessage: 'Hello' },
        'review',
      ),
    ).toEqual({ type: 'notice', payload: { userId: 'u1', message: 'Hello' } });
    expect(
      buildResolveActionPayload({ actionType: 'notice', noticeUserId: '', noticeMessage: 'Hi' }, 'user'),
    ).toBeNull();
    expect(
      buildResolveActionPayload({ actionType: 'notice', noticeUserId: 'u1', noticeMessage: '  ' }, 'user'),
    ).toBeNull();
  });

  it('returns null when no action is selected', () => {
    expect(buildResolveActionPayload({ actionType: '' }, 'opportunity')).toBeNull();
  });
});

describe('resolution / notice / maintenance gating', () => {
  it('resolution requires non-empty ≤4000 chars', () => {
    expect(isResolutionValid('')).toBe(false);
    expect(isResolutionValid('   ')).toBe(false);
    expect(isResolutionValid('Confirmed after review')).toBe(true);
    expect(isResolutionValid('x'.repeat(4001))).toBe(false);
  });

  it('notice requires non-empty ≤1000 chars', () => {
    expect(isNoticeValid('')).toBe(false);
    expect(isNoticeValid('Hello')).toBe(true);
    expect(isNoticeValid('x'.repeat(1001))).toBe(false);
  });

  it('maintenance message allows empty but caps at 500', () => {
    expect(isMaintenanceMessageValid('')).toBe(true);
    expect(isMaintenanceMessageValid('Upgrading search')).toBe(true);
    expect(isMaintenanceMessageValid('x'.repeat(501))).toBe(false);
  });
});

describe('canResolveWithPayload', () => {
  it('requires resolved + resolution when an action rides along', () => {
    expect(
      canResolveWithPayload('resolved', 'Confirmed', { type: 'suspend_target' }),
    ).toBe(true);
    expect(canResolveWithPayload('in_review', 'Confirmed', { type: 'suspend_target' })).toBe(false);
    expect(canResolveWithPayload('resolved', '  ', { type: 'suspend_target' })).toBe(false);
    expect(canResolveWithPayload('dismissed', 'Confirmed', { type: 'suspend_target' })).toBe(false);
  });

  it('allows plain transitions without an action', () => {
    expect(canResolveWithPayload('in_review', '', null)).toBe(true);
    expect(canResolveWithPayload('dismissed', '', null)).toBe(true);
    expect(canResolveWithPayload('open', '', null)).toBe(false);
  });
});

describe('settings registry', () => {
  it('covers exactly the 16 canonical keys', () => {
    expect(ADMIN_SETTING_KEYS).toHaveLength(16);
    expect(settingDefOf('maintenance.enabled')?.kind).toBe('boolean');
    expect(settingDefOf('nope.unknown') ).toBeUndefined();
  });

  it('validates booleans strictly', () => {
    expect(validateSettingValue('ops.publishingEnabled', false)).toBe(true);
    expect(validateSettingValue('ops.publishingEnabled', 'false')).toBe(false);
    expect(validateSettingValue('ops.publishingEnabled', 0)).toBe(false);
  });

  it('validates numbers (finite, integer, positive)', () => {
    expect(validateSettingValue('publishGate.maxPendingOpportunities', 3)).toBe(true);
    expect(validateSettingValue('publishGate.maxPendingOpportunities', 1.5)).toBe(false);
    expect(validateSettingValue('publishGate.maxPendingOpportunities', 0)).toBe(false);
    expect(validateSettingValue('publishGate.maxPendingOpportunities', '3')).toBe(false);
    expect(validateSettingValue('auth.adminSessionDurationDays', 30)).toBe(true);
  });

  it('validates whitelisted language/format strings', () => {
    expect(validateSettingValue('locale.defaultLanguage', 'ar')).toBe(true);
    expect(validateSettingValue('locale.defaultLanguage', 'fr')).toBe(false);
    expect(validateSettingValue('locale.dateFormat', 'DD/MM/YYYY')).toBe(true);
    expect(validateSettingValue('locale.dateFormat', 'MM-YYYY')).toBe(false);
    expect(validateSettingValue('locale.defaultTimezone', 'Africa/Algiers')).toBe(true);
    expect(validateSettingValue('locale.defaultTimezone', '')).toBe(false);
  });

  it('validates bounded text + unknown keys never validate', () => {
    expect(validateSettingValue('maintenance.message', 'Upgrading search')).toBe(true);
    expect(validateSettingValue('maintenance.message', 'x'.repeat(501))).toBe(false);
    expect(validateSettingValue('maintenance.message', 42)).toBe(false);
    expect(validateSettingValue('statutory.mandate', 'yes')).toBe(false);
  });

  it('coerces numeric editor strings', () => {
    expect(coerceSettingValue('publishGate.maxPendingOpportunities', '3')).toBe(3);
    expect(coerceSettingValue('ops.publishingEnabled', false)).toBe(false);
  });
});

describe('typed functions', () => {
  it('listAdminReports parses the cursor page and sends built params', async () => {
    const { client, get } = stubClient({
      get: () => reportPage([reportRow()]),
    });
    const result = await listAdminReports(client, { status: 'bogus', q: 'spam' });
    expect(result.total).toBe(1);
    expect(get).toHaveBeenCalledWith('/admin/reports', { params: { q: 'spam' } });
  });

  it('listAdminReports keeps the cursor page/page/pages contract', async () => {
    const { client } = stubClient({
      get: () => ({
        ...reportPage([reportRow()]),
        nextCursor: 'cur2',
        limit: 1,
        page: 2,
        pages: 9,
      }),
    });
    const result = await listAdminReports(client, { limit: 1 });
    expect(result.nextCursor).toBe('cur2');
    expect(result.page).toBe(2);
    expect(result.pages).toBe(9);
  });

  it('resolveAdminReport posts status + resolution + action', async () => {
    const { client, patch } = stubClient({
      patch: () => reportRow({ status: 'resolved', resolution: 'Confirmed' }),
    });
    const result = await resolveAdminReport(client, 'r1', {
      status: 'resolved',
      resolution: 'Confirmed',
      action: { type: 'unpublish_opportunity' },
    });
    expect(result.status).toBe('resolved');
    expect(patch).toHaveBeenCalledWith('/admin/reports/r1', {
      status: 'resolved',
      resolution: 'Confirmed',
      action: { type: 'unpublish_opportunity' },
    });
  });

  it('resolveAdminReport omits absent action/resolution keys', async () => {
    const { client, patch } = stubClient({
      patch: () => reportRow({ status: 'in_review' }),
    });
    await resolveAdminReport(client, 'r1', { status: 'in_review' });
    expect(patch).toHaveBeenCalledWith('/admin/reports/r1', { status: 'in_review' });
  });

  it('listAdminSettings parses the rows array', async () => {
    const { client } = stubClient({
      get: () => [{ key: 'ops.publishingEnabled', value: true }],
    });
    const rows = await listAdminSettings(client);
    expect(rows).toEqual([{ key: 'ops.publishingEnabled', value: true }]);
  });

  it('updateAdminSetting PUTs {value} under the encoded key', async () => {
    const { client, put } = stubClient({
      put: () => ({ key: 'ops.publishingEnabled', value: false }),
    });
    const row = await updateAdminSetting(client, 'ops.publishingEnabled', false);
    expect(row.value).toBe(false);
    expect(put).toHaveBeenCalledWith('/admin/settings/ops.publishingEnabled', {
      value: false,
    });
  });

  it('toggleMaintenance posts enabled + message', async () => {
    const { client, post } = stubClient({
      post: () => ({ enabled: true, message: 'Upgrading search' }),
    });
    const state = await toggleMaintenance(client, { enabled: true, message: 'Upgrading search' });
    expect(state).toEqual({ enabled: true, message: 'Upgrading search' });
    expect(post).toHaveBeenCalledWith('/admin/ops/maintenance', {
      enabled: true,
      message: 'Upgrading search',
    });
  });
});
