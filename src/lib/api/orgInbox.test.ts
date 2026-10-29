// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  buildInboxQuery,
  canAcceptApplication,
  canDecideSubmission,
  canRejectApplication,
  canRemoveParticipation,
  canStartReviewApplication,
  canStartReviewSubmission,
  evidenceIdsOf,
  evidenceUrlOf,
  getApplicantProfile,
  getEvidenceMedia,
  getOrgApplication,
  getOrgSubmission,
  getVerification,
  isReasonValid,
  listOpportunityApplications,
  listOpportunityParticipants,
  listOrgApplications,
  listOrgParticipants,
  listOrgSubmissions,
  removeParticipation,
  acceptApplication,
  rejectApplication,
  rejectSubmission,
  startReviewApplication,
  startReviewSubmission,
  verifySubmission,
} from './orgInbox';

function stubClient(handlers: {
  get?: (url: string, config?: { params?: unknown }) => unknown;
  post?: (url: string, body?: unknown) => unknown;
}) {
  const get = vi.fn(async (url: string, config?: { params?: unknown }) => ({
    data: handlers.get?.(url, config),
  }));
  const post = vi.fn(async (url: string, body?: unknown) => ({
    data: handlers.post?.(url, body),
  }));
  const client = { get, post } as unknown as AxiosInstance;
  return { client, get, post };
}

const page = (items: unknown[], total?: number) => ({
  items,
  nextCursor: null,
  limit: 20,
  total: total ?? items.length,
  page: 1,
  pages: 1,
});

describe('buildInboxQuery', () => {
  it('joins multi-status arrays with commas (submitted,under_review)', () => {
    expect(
      buildInboxQuery({ status: ['submitted', 'under_review'] }),
    ).toEqual({ status: 'submitted,under_review' });
  });

  it('passes single status through and drops empty values', () => {
    expect(
      buildInboxQuery({
        opportunityId: 'opp1',
        status: 'pending',
        q: '',
        format: undefined,
        cursor: undefined,
      }),
    ).toEqual({ opportunityId: 'opp1', status: 'pending' });
  });

  it('keeps format/sort/cursor/limit for the contributions inbox', () => {
    expect(
      buildInboxQuery({
        q: 'cleanup',
        format: 'image',
        sort: 'newest',
        cursor: 'cur',
        limit: 20,
      }),
    ).toEqual({
      q: 'cleanup',
      format: 'image',
      sort: 'newest',
      cursor: 'cur',
      limit: 20,
    });
  });
});

describe('reason gating', () => {
  it('blocks empty and whitespace-only reasons', () => {
    expect(isReasonValid('')).toBe(false);
    expect(isReasonValid('   ')).toBe(false);
    expect(isReasonValid('Evidence does not match')).toBe(true);
  });
});

describe('action-availability gates mirror backend transitions', () => {
  it('application start-review iff pending', () => {
    expect(canStartReviewApplication('pending')).toBe(true);
    for (const s of ['under_review', 'accepted', 'rejected', 'withdrawn']) {
      expect(canStartReviewApplication(s)).toBe(false);
    }
  });

  it('application accept/reject iff pending or under_review', () => {
    for (const s of ['pending', 'under_review']) {
      expect(canAcceptApplication(s)).toBe(true);
      expect(canRejectApplication(s)).toBe(true);
    }
    for (const s of ['accepted', 'rejected', 'withdrawn']) {
      expect(canAcceptApplication(s)).toBe(false);
      expect(canRejectApplication(s)).toBe(false);
    }
  });

  it('participant remove iff accepted or active (seat stays allocated)', () => {
    expect(canRemoveParticipation('accepted')).toBe(true);
    expect(canRemoveParticipation('active')).toBe(true);
    for (const s of ['completed', 'withdrawn', 'removed']) {
      expect(canRemoveParticipation(s)).toBe(false);
    }
  });

  it('submission start-review iff submitted; decide iff submitted or under_review', () => {
    expect(canStartReviewSubmission('submitted')).toBe(true);
    expect(canStartReviewSubmission('under_review')).toBe(false);
    expect(canDecideSubmission('submitted')).toBe(true);
    expect(canDecideSubmission('under_review')).toBe(true);
    for (const s of ['verified', 'rejected', 'draft']) {
      expect(canDecideSubmission(s)).toBe(false);
    }
  });
});

describe('applications endpoints', () => {
  const row = { _id: 'a1', status: 'pending', message: 'Hi' };

  it('lists the aggregate inbox with combined params', async () => {
    const { client, get } = stubClient({
      get: () => page([row], 1),
    });
    const result = await listOrgApplications(client, {
      opportunityId: 'opp1',
      status: 'pending',
      q: 'ali',
    });
    expect(get).toHaveBeenCalledWith('/organizations/me/applications', {
      params: { opportunityId: 'opp1', status: 'pending', q: 'ali' },
    });
    expect(result.total).toBe(1);
  });

  it('lists the per-opportunity view without opportunityId param', async () => {
    const { client, get } = stubClient({
      get: () => page([row], 1),
    });
    await listOpportunityApplications(client, 'opp1', { status: 'pending' });
    expect(get).toHaveBeenCalledWith('/opportunities/opp1/applications', {
      params: { status: 'pending' },
    });
  });

  it('reads one application and starts review on the pending-only route', async () => {
    const { client, get, post } = stubClient({
      get: () => ({ ...row, status: 'pending' }),
      post: () => ({ ...row, status: 'under_review' }),
    });
    await getOrgApplication(client, 'a1');
    expect(get).toHaveBeenCalledWith('/applications/a1');
    const updated = await startReviewApplication(client, 'a1');
    expect(post).toHaveBeenCalledWith('/applications/a1/start-review');
    expect(updated.status).toBe('under_review');
  });

  it('accepts with an empty-body post; rejects with {reason}', async () => {
    const { client, post } = stubClient({
      post: (_url: string, body: unknown) => ({ ...row, status: 'accepted', body }),
    });
    await acceptApplication(client, 'a1');
    expect(post).toHaveBeenCalledWith('/applications/a1/accept');
    await rejectApplication(client, 'a1', { reason: 'No seats' });
    expect(post).toHaveBeenCalledWith('/applications/a1/reject', {
      reason: 'No seats',
    });
  });

  it('reads the applicant public profile (opt-out blocks stay nullable)', async () => {
    const { client, get } = stubClient({
      get: () => ({ username: 'ali', firstName: 'Ali', skills: null, experiences: null }),
    });
    const profile = await getApplicantProfile(client, 'ali');
    expect(get).toHaveBeenCalledWith('/volunteers/ali');
    expect(profile.skills).toBeNull();
  });
});

describe('participants endpoints', () => {
  const row = { _id: 'p1', status: 'active' };

  it('lists the aggregate roster incl. completed with combined params', async () => {
    const { client, get } = stubClient({
      get: () => page([row, { ...row, _id: 'p2', status: 'completed' }], 2),
    });
    const result = await listOrgParticipants(client, {
      q: 'ali',
      opportunityId: 'opp1',
      status: 'completed',
    });
    expect(get).toHaveBeenCalledWith('/organizations/me/participants', {
      params: { q: 'ali', opportunityId: 'opp1', status: 'completed' },
    });
    expect(result.total).toBe(2);
  });

  it('lists the per-opportunity roster view', async () => {
    const { client, get } = stubClient({
      get: () => page([row], 1),
    });
    await listOpportunityParticipants(client, 'opp1', {});
    expect(get).toHaveBeenCalledWith('/opportunities/opp1/participants', {
      params: {},
    });
  });

  it('removes with {reason} on the personnel-action route', async () => {
    const { client, post } = stubClient({
      post: () => ({ ...row, status: 'removed' }),
    });
    const updated = await removeParticipation(client, 'p1', { reason: 'No-show' });
    expect(post).toHaveBeenCalledWith('/participations/p1/remove', {
      reason: 'No-show',
    });
    expect(updated.status).toBe('removed');
  });
});

describe('contributions endpoints', () => {
  const row = {
    _id: 's1',
    status: 'submitted',
    title: 'Cleanup report',
    evidence: [{ mediaId: 'm1' }],
  };

  it('lists the inbox with multi-status and format/sort params', async () => {
    const { client, get } = stubClient({
      get: () => page([row], 1),
    });
    const result = await listOrgSubmissions(client, {
      status: ['submitted', 'under_review'],
      q: 'cleanup',
      format: 'image',
      sort: 'newest',
    });
    expect(get).toHaveBeenCalledWith('/organizations/me/submissions', {
      params: {
        status: 'submitted,under_review',
        q: 'cleanup',
        format: 'image',
        sort: 'newest',
      },
    });
    expect(result.total).toBe(1);
  });

  it('reads one submission and starts review on the submitted-only route', async () => {
    const { client, get, post } = stubClient({
      get: () => row,
      post: () => ({ ...row, status: 'under_review' }),
    });
    await getOrgSubmission(client, 's1');
    expect(get).toHaveBeenCalledWith('/submissions/s1');
    const updated = await startReviewSubmission(client, 's1');
    expect(post).toHaveBeenCalledWith('/submissions/s1/start-review');
    expect(updated.status).toBe('under_review');
  });

  it('verifies with an empty-body atomic post; rejects with {reason}', async () => {
    const { client, post } = stubClient({
      post: () => ({ ...row, status: 'verified' }),
    });
    await verifySubmission(client, 's1');
    expect(post).toHaveBeenCalledWith('/submissions/s1/verify', {});
    await rejectSubmission(client, 's1', { reason: 'Mismatch' });
    expect(post).toHaveBeenCalledWith('/submissions/s1/reject', {
      reason: 'Mismatch',
    });
  });

  it('reads the issued verification including private organization notes', async () => {
    const { client, get } = stubClient({
      get: () => ({
        _id: 'v1',
        verificationCode: 'ABC123',
        notes: 'Excellent follow-through on site.',
      }),
    });
    const verification = await getVerification(client, 'v1');
    expect(get).toHaveBeenCalledWith('/verifications/v1');
    expect(verification.verificationCode).toBe('ABC123');
    expect(verification.notes).toBe('Excellent follow-through on site.');
  });

  it('reads owning-org evidence media and extracts the URL', async () => {
    const { client, get } = stubClient({
      get: () => ({ media: { _id: 'm1' }, url: 'https://cdn.example/e1.jpg' }),
    });
    const media = await getEvidenceMedia(client, 'm1');
    expect(get).toHaveBeenCalledWith('/media/m1');
    expect(evidenceUrlOf(media)).toBe('https://cdn.example/e1.jpg');
  });

  it('evidence URL is null when unresolvable; ids derive from the submission', async () => {
    expect(evidenceUrlOf(undefined)).toBeNull();
    expect(evidenceUrlOf({})).toBeNull();
    expect(evidenceIdsOf({ evidence: [{ mediaId: 'm1' }] })).toEqual(['m1']);
    expect(evidenceIdsOf({ evidence: null })).toEqual([]);
    expect(evidenceIdsOf(undefined)).toEqual([]);
  });
});
