// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  AdminAnalyticsOverviewSchema,
  AdminAnalyticsQueueSchema,
  AdminAnalyticsSeriesSchema,
  AdminStatsOverviewSchema,
  AUDIT_STRIP_LIMIT,
  DELTA_UNAVAILABLE,
  SERIES_DEFAULT_DAYS,
  SERIES_MAX_DAYS,
  SERIES_MIN_DAYS,
  TURNAROUND_UNAVAILABLE,
  TOTAL_KEYS,
  attentionItems,
  auditRows,
  buildAuditCsvParams,
  buildAuditParams,
  clampSeriesDays,
  cursorPage,
  deltaCards,
  formatDeltaPercent,
  getAdminAnalyticsOverview,
  getAdminAnalyticsQueue,
  getAdminAnalyticsSeries,
  getAdminStatsOverview,
  listAdminAuditLogs,
  seriesMax,
  seriesTotals,
  statusCounts,
  turnaroundValue,
  uptimeParts,
  AdminAuditRowSchema,
} from './adminAnalytics';

function stubClient(handlers: {
  get?: (url: string, config?: { params?: unknown }) => unknown;
}) {
  const get = vi.fn(async (url: string, config?: { params?: unknown }) => ({
    data: handlers.get?.(url, config),
  }));
  const client = { get } as unknown as AxiosInstance;
  return { client, get };
}

const overviewFixture = {
  totals: {
    users: { current: 12, previous: 8, deltaPercent: 50 },
    organizations: { current: 4, previous: 0, deltaPercent: null },
    opportunities: { current: 30, previous: 25, deltaPercent: 20 },
    applications: { current: 60, previous: 75, deltaPercent: -20 },
    submissions: { current: 5, previous: 5, deltaPercent: 0 },
  },
  activeParticipants: 42,
  perStatus: {
    users: { active: 90, suspended: 3 },
    organizations: { byStatus: { active: 10 }, byVerificationStatus: { pending: 4, verified: 6 } },
    opportunities: { published: 20, draft: 10 },
    applications: { pending: 30, accepted: 30 },
    submissions: { submitted: 2, under_review: 3 },
  },
  verificationReady: { total: 5, byOrganization: [{ organizationId: 'org1', count: 5 }] },
  gateFreezes: 1,
  medianDecisionHours: 18.5,
};

const queueFixture = {
  pendingVerifications: 4,
  openReports: 2,
  underReviewSubmissions: 3,
  suspendedUsers: 1,
  suspendedOrganizations: 2,
  maintenanceMode: false,
};

const statsFixture = {
  counts: {
    users: 93,
    volunteers: 80,
    organizations: 10,
    verifiedOrganizations: 6,
    opportunities: 30,
    pendingVerifications: 4,
  },
  totalVolunteerHours: 1234.5,
  verificationRate: 0.6,
  gateFreezes: 1,
};

const seriesFixture = {
  days: 2,
  points: [
    { date: '2026-09-01', signups: 3, applications: 5, verifications: 1 },
    { date: '2026-09-02', signups: 7, applications: 0, verifications: 2 },
  ],
};

const auditPageFixture = {
  items: [
    {
      log: {
        _id: '64f0000000000000000000a1',
        action: 'organization.status.update',
        method: 'PATCH',
        path: '/admin/organizations/64f0000000000000000000b1/status',
        entityType: 'organizations',
        entityId: '64f0000000000000000000b1',
        createdAt: '2026-09-20T10:00:00.000Z',
      },
      actorName: 'Admin One',
      targetName: 'Org A',
    },
    {
      log: {
        _id: '64f0000000000000000000a2',
        action: 'opportunity.status.update',
        method: 'PATCH',
        path: '/admin/opportunities/64f0000000000000000000b2/status',
        entityType: 'opportunities',
        entityId: '64f0000000000000000000b2',
        createdAt: '2026-09-19T10:00:00.000Z',
      },
      actorName: null,
      targetName: null,
    },
  ],
  nextCursor: null,
  limit: AUDIT_STRIP_LIMIT,
  total: 2,
  page: 1,
  pages: 1,
};

describe('admin analytics schemas', () => {
  it('parses the backend overview payload', () => {
    const parsed = AdminAnalyticsOverviewSchema.parse(overviewFixture);
    expect(parsed.totals.organizations.deltaPercent).toBeNull();
    expect(parsed.medianDecisionHours).toBe(18.5);
    expect(parsed.perStatus.organizations.byVerificationStatus.pending).toBe(4);
  });

  it('rejects an overview payload missing a totals entry', () => {
    const broken = { ...overviewFixture, totals: { users: overviewFixture.totals.users } };
    expect(() => AdminAnalyticsOverviewSchema.parse(broken)).toThrow();
  });

  it('parses the queue and stats payloads', () => {
    expect(AdminAnalyticsQueueSchema.parse(queueFixture).maintenanceMode).toBe(false);
    const stats = AdminStatsOverviewSchema.parse(statsFixture);
    expect(stats.counts.pendingVerifications).toBe(4);
    expect(stats.verificationRate).toBe(0.6);
  });

  it('parses the series payload', () => {
    expect(AdminAnalyticsSeriesSchema.parse(seriesFixture).points).toHaveLength(2);
  });

  it('parses the audit cursor page', () => {
    const page = cursorPage(AdminAuditRowSchema).parse(auditPageFixture);
    expect(page.total).toBe(2);
    expect(page.items[0]?.actorName).toBe('Admin One');
  });
});

describe('delta rendering', () => {
  it('returns the unavailable sentinel for a null deltaPercent, never "0%"', () => {
    expect(formatDeltaPercent(null)).toBe(DELTA_UNAVAILABLE);
    expect(formatDeltaPercent(null)).not.toBe('0%');
    expect(formatDeltaPercent(undefined)).toBeNull();
    expect(formatDeltaPercent(Number.NaN)).toBeNull();
  });

  it('formats a real zero delta as a measured flat trend', () => {
    expect(formatDeltaPercent(0)).toBe('0%');
  });

  it('signs and rounds real deltas', () => {
    expect(formatDeltaPercent(50)).toBe('+50%');
    expect(formatDeltaPercent(-20)).toBe('-20%');
    expect(formatDeltaPercent(12.34)).toBe('+12.3%');
  });

  it('maps all five totals in backend order with their deltas', () => {
    const cards = deltaCards(AdminAnalyticsOverviewSchema.parse(overviewFixture).totals);
    expect(cards.map((c) => c.key)).toEqual([...TOTAL_KEYS]);
    const byKey = Object.fromEntries(cards.map((c) => [c.key, c]));
    expect(byKey.users).toMatchObject({ current: 12, previous: 8, deltaPercent: '+50%' });
    // Previous window empty → sentinel, not a fabricated percentage.
    expect(byKey.organizations?.deltaPercent).toBeNull();
    expect(byKey.organizations?.previous).toBe(0);
    expect(byKey.submissions?.deltaPercent).toBe('0%');
  });
});

describe('series mapping', () => {
  const points = AdminAnalyticsSeriesSchema.parse(seriesFixture).points;

  it('sums each series from the returned points only', () => {
    expect(seriesTotals(points)).toEqual({ signups: 10, applications: 5, verifications: 3 });
  });

  it('derives the bar scale from the data, not a hardcoded ceiling', () => {
    expect(seriesMax(points)).toBe(7);
  });

  it('returns a zero scale only for an empty window', () => {
    expect(seriesMax([])).toBe(0);
    expect(seriesTotals([])).toEqual({ signups: 0, applications: 0, verifications: 0 });
  });

  it('clamps the requested window to the backend 1-90 bound', () => {
    expect(clampSeriesDays(0)).toBe(SERIES_MIN_DAYS);
    expect(clampSeriesDays(-5)).toBe(SERIES_MIN_DAYS);
    expect(clampSeriesDays(91)).toBe(SERIES_MAX_DAYS);
    expect(clampSeriesDays(1000)).toBe(SERIES_MAX_DAYS);
    expect(clampSeriesDays(30)).toBe(30);
    expect(clampSeriesDays(undefined)).toBe(SERIES_DEFAULT_DAYS);
    expect(clampSeriesDays(7.5)).toBe(SERIES_DEFAULT_DAYS);
  });
});

describe('attention queue mapping', () => {
  it('emits the five real categories in fixed order with their counts', () => {
    const items = attentionItems(AdminAnalyticsQueueSchema.parse(queueFixture));
    expect(items.map((i) => i.key)).toEqual([
      'pendingVerifications',
      'openReports',
      'underReviewSubmissions',
      'suspendedUsers',
      'suspendedOrganizations',
    ]);
    expect(items.map((i) => i.count)).toEqual([4, 2, 3, 1, 2]);
  });

  it('renders a zero count as zero rather than hiding the category', () => {
    const items = attentionItems(
      AdminAnalyticsQueueSchema.parse({ ...queueFixture, openReports: 0 }),
    );
    const reports = items.find((i) => i.key === 'openReports');
    expect(reports?.count).toBe(0);
  });

  it('links onward to the manage-screens routes and carries no action', () => {
    const items = attentionItems(AdminAnalyticsQueueSchema.parse(queueFixture));
    const byKey = Object.fromEntries(items.map((i) => [i.key, i]));
    expect(byKey.pendingVerifications?.href).toBe('/admin/verifications');
    expect(byKey.openReports?.href).toBe('/admin/reports');
    expect(byKey.suspendedOrganizations?.href).toBe('/admin/organizations');
    // Navigation only: no mutating verb, no moderation field on the item.
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(['count', 'href', 'key', 'source']);
      expect(item.href).not.toMatch(/approve|reject|suspend|resolve|hide/i);
    }
  });

  it('keeps the maintenance flag as a plain operational state', () => {
    const items = attentionItems(AdminAnalyticsQueueSchema.parse(queueFixture));
    expect(items.some((i) => 'maintenanceMode' in i)).toBe(false);
  });
});

describe('audit display names', () => {
  const page = cursorPage(AdminAuditRowSchema).parse(auditPageFixture);

  it('uses the enriched actor and target names', () => {
    const rows = auditRows(page);
    expect(rows[0]?.actor).toBe('Admin One');
    expect(rows[0]?.target).toBe('Org A');
  });

  it('keeps a null name null so the caller renders its placeholder', () => {
    const rows = auditRows(page);
    expect(rows[1]?.actor).toBeNull();
    expect(rows[1]?.target).toBeNull();
  });

  it('treats a blank name as missing', () => {
    const rows = auditRows(
      cursorPage(AdminAuditRowSchema).parse({
        items: [{ log: { _id: 'x1' }, actorName: '   ', targetName: '' }],
        total: 1,
      }),
    );
    expect(rows[0]?.actor).toBeNull();
    expect(rows[0]?.target).toBeNull();
  });

  it('uses the log id only as a row key, never as a label', () => {
    const rows = auditRows(page);
    expect(rows[0]?.key).toBe('64f0000000000000000000a1');
    expect(rows[0]?.actor).not.toBe(rows[0]?.key);
  });

  it('builds audit params with the strip limit and drops blank filters', () => {
    expect(buildAuditParams()).toEqual({ limit: AUDIT_STRIP_LIMIT });
    expect(buildAuditParams({ q: '  ', limit: 5, sort: 'oldest' })).toEqual({
      limit: 5,
      sort: 'oldest',
    });
    expect(buildAuditParams({ q: ' org ' })).toMatchObject({ q: 'org' });
  });

  it('builds audit CSV params from filters plus format=csv', () => {
    expect(buildAuditCsvParams({ q: 'org', sort: 'oldest' })).toEqual({
      limit: AUDIT_STRIP_LIMIT,
      q: 'org',
      sort: 'oldest',
      format: 'csv',
    });
  });
});

describe('turnaround and status helpers', () => {
  it('returns the not-enough-data sentinel for a null median', () => {
    expect(turnaroundValue(null)).toBe(TURNAROUND_UNAVAILABLE);
    expect(turnaroundValue(undefined)).toBeNull();
    expect(turnaroundValue(null)).not.toBe(0);
  });

  it('passes a real median through', () => {
    expect(turnaroundValue(18.5)).toBe(18.5);
    expect(turnaroundValue(0)).toBe(0);
  });

  it('sorts real status counts by count then name', () => {
    expect(statusCounts({ draft: 2, active: 5, suspended: 2 })).toEqual([
      { status: 'active', count: 5 },
      { status: 'draft', count: 2 },
      { status: 'suspended', count: 2 },
    ]);
  });

  it('splits uptime seconds without inventing a value', () => {
    expect(uptimeParts(90_061)).toEqual({ days: 1, hours: 1, minutes: 1 });
    expect(uptimeParts(null)).toBeNull();
    expect(uptimeParts(undefined)).toBeNull();
  });
});

describe('endpoint functions', () => {
  it('reads each dashboard endpoint once at its documented path', async () => {
    const { client, get } = stubClient({
      get: (url) => {
        if (url === '/admin/stats/overview') return statsFixture;
        if (url === '/admin/analytics/overview') return overviewFixture;
        if (url === '/admin/analytics/series') return seriesFixture;
        if (url === '/admin/analytics/queue') return queueFixture;
        if (url === '/admin/audit-logs') return auditPageFixture;
        return {};
      },
    });

    expect((await getAdminStatsOverview(client)).counts.users).toBe(93);
    expect((await getAdminAnalyticsOverview(client)).activeParticipants).toBe(42);
    expect((await getAdminAnalyticsSeries(client, 2)).points).toHaveLength(2);
    expect((await getAdminAnalyticsQueue(client)).pendingVerifications).toBe(4);
    expect((await listAdminAuditLogs(client)).items).toHaveLength(2);

    expect(get.mock.calls.map((call) => call[0])).toEqual([
      '/admin/stats/overview',
      '/admin/analytics/overview',
      '/admin/analytics/series',
      '/admin/analytics/queue',
      '/admin/audit-logs',
    ]);
  });

  it('sends a clamped days value', async () => {
    const { client, get } = stubClient({ get: () => seriesFixture });
    await getAdminAnalyticsSeries(client, 500);
    expect(get.mock.calls[0]?.[1]).toEqual({ params: { days: SERIES_MAX_DAYS } });
  });

  it('sends the strip limit for audit logs', async () => {
    const { client, get } = stubClient({ get: () => auditPageFixture });
    await listAdminAuditLogs(client);
    expect(get.mock.calls[0]?.[1]).toEqual({ params: { limit: AUDIT_STRIP_LIMIT } });
  });

  it('accepts a bare array audit response', async () => {
    const { client } = stubClient({ get: () => auditPageFixture.items });
    const page = await listAdminAuditLogs(client);
    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(2);
  });
});
