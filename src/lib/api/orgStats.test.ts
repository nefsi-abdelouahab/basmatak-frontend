// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  DASHBOARD_SUMMARY_LIMIT,
  OrgStatsSchema,
  getMyOrganization,
  getOrgActivity,
  getOrgStats,
  getPublishGate,
  isGateLocked,
  listApplicationsSummary,
  listNotifications,
  listParticipantsSummary,
  listSubmissionsSummary,
  orgCoverUrlOf,
  orgDisplayCode,
  statCards,
} from './orgStats';

function stubClient(handlers: {
  get?: (url: string, config?: { params?: unknown }) => unknown;
}) {
  const get = vi.fn(async (url: string, config?: { params?: unknown }) => ({
    data: handlers.get?.(url, config),
  }));
  const client = { get } as unknown as AxiosInstance;
  return { client, get };
}

const statsFixture = {
  opportunitiesActive: 3,
  opportunitiesCompleted: 7,
  applicationsPending: 4,
  applicationsUnderReview: 2,
  participantsActive: 12,
  participantsCompleted: 30,
  verifiedHours: 180,
  decisionsLast30d: 9,
};

const page = (items: unknown[], total?: number) => ({
  items,
  nextCursor: null,
  limit: 5,
  total: total ?? items.length,
  page: 1,
  pages: 1,
});

describe('org display code', () => {
  it('prefixes the registry id and stays display-only', () => {
    expect(orgDisplayCode('a1b2c3')).toBe('ORG-a1b2c3');
    expect(orgDisplayCode(undefined)).toBeNull();
    expect(orgDisplayCode('   ')).toBeNull();
  });
});

describe('stat-card mapping', () => {
  it('maps every card from its stats field with hours from verifiedHours', () => {
    const cards = statCards(OrgStatsSchema.parse(statsFixture));
    expect(Object.fromEntries(cards.map((c) => [c.key, c.value]))).toMatchObject({
      opportunitiesActive: 3,
      opportunitiesCompleted: 7,
      applicationsPending: 4,
      applicationsUnderReview: 2,
      participantsActive: 12,
      participantsCompleted: 30,
      verifiedHours: 180,
      decisionsLast30d: 9,
    });
  });

  it('renders optional reliability cards only when present', () => {
    expect(
      statCards(OrgStatsSchema.parse(statsFixture)).some((c) => c.key === 'decidedRatio'),
    ).toBe(false);
    expect(
      statCards(OrgStatsSchema.parse(statsFixture)).some(
        (c) => c.key === 'medianDecisionHours',
      ),
    ).toBe(false);
    const withOptional = statCards(
      OrgStatsSchema.parse({ ...statsFixture, decidedRatio: 0.75, medianDecisionHours: 36 }),
    );
    expect(withOptional.find((c) => c.key === 'decidedRatio')?.value).toBe(0.75);
    expect(withOptional.find((c) => c.key === 'medianDecisionHours')?.value).toBe(36);
  });

  it('invents no totals beyond the payload', () => {
    const cards = statCards(OrgStatsSchema.parse(statsFixture));
    expect(cards).toHaveLength(8);
  });
});

describe('publish-gate messaging', () => {
  it('locked is a pure function of the gate payload', () => {
    expect(isGateLocked({ locked: true, pendingCount: 2 })).toBe(true);
    expect(isGateLocked({ locked: false, pendingCount: 0 })).toBe(false);
  });

  it('parses the gate status shape', async () => {
    const { client, get } = stubClient({
      get: (url) =>
        url === '/organizations/me/publish-gate'
          ? { locked: true, pendingCount: 2, threshold: 5, pendingOpportunities: [] }
          : {},
    });
    await expect(getPublishGate(client)).resolves.toMatchObject({ locked: true, pendingCount: 2 });
    expect(get).toHaveBeenCalledWith('/organizations/me/publish-gate');
  });
});

describe('orgStats endpoint wiring', () => {
  it('reads org facts, stats, activity, and notifications from their routes', async () => {
    const { client } = stubClient({
      get: (url) => {
        if (url === '/organizations/me') return { registryId: 'abc', coverMediaId: null };
        if (url === '/organizations/me/stats') return statsFixture;
        if (url === '/organizations/me/activity') return page([{ _id: 'e1', type: 'x' }]);
        if (url === '/notifications') return page([{ _id: 'n1', isRead: false }]);
        return {};
      },
    });
    await expect(getMyOrganization(client)).resolves.toMatchObject({ registryId: 'abc' });
    await expect(getOrgStats(client)).resolves.toMatchObject({ verifiedHours: 180 });
    await expect(getOrgActivity(client)).resolves.toMatchObject({ total: 1 });
    await expect(listNotifications(client)).resolves.toMatchObject({ total: 1 });
  });

  it('reads the three inbox summaries with the small-page limit', async () => {
    const { client, get } = stubClient({
      get: (url) => {
        if (url === '/organizations/me/participants')
          return page([{ _id: 'p1', status: 'active' }]);
        if (url === '/organizations/me/submissions')
          return page([{ _id: 's1', status: 'submitted' }]);
        if (url === '/organizations/me/applications')
          return page([{ _id: 'a1', status: 'pending' }]);
        return {};
      },
    });
    await expect(listParticipantsSummary(client)).resolves.toMatchObject({ total: 1 });
    await expect(listSubmissionsSummary(client)).resolves.toMatchObject({ total: 1 });
    await expect(listApplicationsSummary(client)).resolves.toMatchObject({ total: 1 });
    for (const call of get.mock.calls) {
      expect(call[1]?.params).toMatchObject({ limit: DASHBOARD_SUMMARY_LIMIT });
    }
  });

  it('honors an explicit summary limit override', async () => {
    const { client, get } = stubClient({
      get: () => page([]),
    });
    await listSubmissionsSummary(client, { limit: 8 });
    expect(get).toHaveBeenCalledWith('/organizations/me/submissions', {
      params: { limit: 8 },
    });
  });
});

describe('org cover', () => {
  it('resolves the signed URL and stays null when absent', () => {
    expect(orgCoverUrlOf({ signedUrl: 'https://cdn.example/cover.jpg' })).toBe(
      'https://cdn.example/cover.jpg',
    );
    expect(orgCoverUrlOf({ url: 'https://cdn.example/c.jpg' })).toBe(
      'https://cdn.example/c.jpg',
    );
    expect(orgCoverUrlOf(undefined)).toBeNull();
    expect(orgCoverUrlOf({})).toBeNull();
  });
});
