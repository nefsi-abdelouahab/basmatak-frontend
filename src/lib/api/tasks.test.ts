// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { AxiosHeaders, type AxiosInstance } from 'axios';
import {
  ApplicationRowSchema,
  ParticipationRowSchema,
  applicationTimeline,
  buildApplicationParams,
  buildParticipationParams,
  canWithdrawApplication,
  canWithdrawParticipation,
  downloadAttestation,
  getApplication,
  getParticipation,
  getVolunteerActivity,
  listMyApplications,
  listMyParticipations,
  participationTimeline,
  shortApplicationId,
  withdrawApplication,
  withdrawParticipation,
} from './tasks';

function stubClient(handlers: {
  get?: (url: string, config?: { params?: unknown }) => unknown;
  post?: (url: string, body?: unknown) => unknown;
}) {
  const get = vi.fn(async (url: string, config?: { params?: unknown }) => ({
    data: handlers.get?.(url, config),
    headers: {},
  }));
  const post = vi.fn(async (url: string, body?: unknown) => ({
    data: handlers.post?.(url, body),
    headers: {},
  }));
  const client = { get, post } as unknown as AxiosInstance;
  return { client, get, post };
}

const application = {
  _id: '64f0000000000000000000a1',
  status: 'under_review',
  message: 'I want to help',
  organization: { nameFr: 'Org A' },
  opportunity: { title: 'Cleanup' },
  position: { title: 'Helper' },
  createdAt: '2026-09-01T00:00:00.000Z',
};

const participation = {
  _id: '64f0000000000000000000b2',
  status: 'accepted',
  organization: { nameFr: 'Org A' },
  opportunity: { title: 'Cleanup' },
  createdAt: '2026-09-02T00:00:00.000Z',
};

const page = (items: unknown[]) => ({
  items,
  nextCursor: null,
  limit: 20,
  total: items.length,
  page: 1,
  pages: 1,
});

describe('task status vocabularies', () => {
  it('under_review is a real application tab value', () => {
    expect(
      ApplicationRowSchema.safeParse({ ...application, status: 'under_review' }).success,
    ).toBe(true);
    expect(
      ParticipationRowSchema.safeParse({ ...participation, status: 'active' }).success,
    ).toBe(true);
  });

  it('date-filter params map to from/to only for applications', () => {
    expect(
      buildApplicationParams({ status: 'under_review', from: '2026-09-01', to: '2026-09-30' }),
    ).toEqual({ status: 'under_review', from: '2026-09-01', to: '2026-09-30' });
    expect(buildParticipationParams({ status: 'accepted' })).toEqual({ status: 'accepted' });
    expect(buildApplicationParams({})).toEqual({});
  });

  it('shortApplicationId derives an uppercase ObjectId suffix, never APL-', () => {
    expect(shortApplicationId('64f0000000000000000000a1')).toBe('0000A1');
    expect(shortApplicationId('64f0000000000000000000a1')).not.toMatch(/^APL-/);
  });
});

describe('withdraw gating mirrors the backend whitelists', () => {
  it('applications withdraw from pending/under_review/accepted only', () => {
    expect(canWithdrawApplication('pending')).toBe(true);
    expect(canWithdrawApplication('under_review')).toBe(true);
    expect(canWithdrawApplication('accepted')).toBe(true);
    expect(canWithdrawApplication('rejected')).toBe(false);
    expect(canWithdrawApplication('withdrawn')).toBe(false);
  });

  it('participations withdraw from accepted/active only', () => {
    expect(canWithdrawParticipation('accepted')).toBe(true);
    expect(canWithdrawParticipation('active')).toBe(true);
    expect(canWithdrawParticipation('completed')).toBe(false);
    expect(canWithdrawParticipation('withdrawn')).toBe(false);
    expect(canWithdrawParticipation('removed')).toBe(false);
  });
});

describe('neutral timelines', () => {
  it('application timeline walks Submitted, Under review, Accepted', () => {
    expect(applicationTimeline('pending')).toEqual({
      steps: ['current', 'todo', 'todo'],
      terminal: null,
    });
    expect(applicationTimeline('under_review')).toEqual({
      steps: ['done', 'current', 'todo'],
      terminal: null,
    });
    expect(applicationTimeline('accepted')).toEqual({
      steps: ['done', 'done', 'current'],
      terminal: null,
    });
    expect(applicationTimeline('rejected').terminal).toBe('rejected');
    expect(applicationTimeline('withdrawn').terminal).toBe('withdrawn');
  });

  it('participation timeline has no messaging states', () => {
    expect(participationTimeline('accepted').steps).toEqual(['current', 'todo', 'todo']);
    expect(participationTimeline('active').steps).toEqual(['done', 'current', 'todo']);
    expect(participationTimeline('completed').steps).toEqual(['done', 'done', 'current']);
    expect(participationTimeline('removed').terminal).toBe('removed');
  });
});

describe('tasks api functions', () => {
  it('lists applications with status + from/to params', async () => {
    const { client, get } = stubClient({
      get: (url) => (url === '/applications/me' ? page([application]) : undefined),
    });
    const result = await listMyApplications(client, {
      status: 'under_review',
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(result.total).toBe(1);
    expect(get).toHaveBeenCalledWith(
      '/applications/me',
      expect.objectContaining({
        params: { status: 'under_review', from: '2026-09-01', to: '2026-09-30' },
      }),
    );
  });

  it('reads and withdraws a single application', async () => {
    const { client, post } = stubClient({
      get: () => application,
      post: () => ({ ...application, status: 'withdrawn' }),
    });
    expect((await getApplication(client, 'a1')).status).toBe('under_review');
    expect((await withdrawApplication(client, 'a1')).status).toBe('withdrawn');
    expect(post).toHaveBeenCalledWith('/applications/a1/withdraw');
  });

  it('lists participations without date params', async () => {
    const { client, get } = stubClient({
      get: (url) => (url === '/participations/me' ? page([participation]) : undefined),
    });
    const result = await listMyParticipations(client, { status: 'accepted' });
    expect(result.total).toBe(1);
    expect(get).toHaveBeenCalledWith(
      '/participations/me',
      expect.objectContaining({ params: { status: 'accepted' } }),
    );
  });

  it('reads and withdraws a single participation', async () => {
    const { client, post } = stubClient({
      get: () => participation,
      post: () => ({ ...participation, status: 'withdrawn' }),
    });
    expect((await getParticipation(client, 'p1')).status).toBe('accepted');
    expect((await withdrawParticipation(client, 'p1')).status).toBe('withdrawn');
    expect(post).toHaveBeenCalledWith('/participations/p1/withdraw');
  });

  it('reads the volunteer activity strip', async () => {
    const { client } = stubClient({
      get: (url) =>
        url === '/volunteers/me/activity'
          ? page([{ _id: 'e1', type: 'application.status', createdAt: '2026-09-03T00:00:00.000Z' }])
          : undefined,
    });
    const result = await getVolunteerActivity(client, {});
    expect(result.total).toBe(1);
  });

  it('downloadAttestation resolves the server filename despite AxiosHeaders casing', async () => {
    const get = vi.fn(async () => ({
      data: new Blob(['%PDF-1.4 fake']),
      headers: new AxiosHeaders({
        'Content-Disposition': 'attachment; filename="attestation-EXP-000123.pdf"',
      }),
    }));
    const client = { get, post: vi.fn() } as unknown as AxiosInstance;
    const clicked: string[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(`${this.href}:${this.download}`);
      });
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:fake',
      revokeObjectURL: () => {},
    });
    try {
      const filename = await downloadAttestation(client, '64f0000000000000000000e1');
      expect(get).toHaveBeenCalledWith(
        '/experiences/64f0000000000000000000e1/attestation',
        expect.objectContaining({ responseType: 'blob' }),
      );
      expect(filename).toBe('attestation-EXP-000123.pdf');
      expect(clicked).toEqual(['blob:fake:attestation-EXP-000123.pdf']);
    } finally {
      clickSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
