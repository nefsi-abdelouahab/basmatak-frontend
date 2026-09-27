import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  ADMIN_LIST_DEFAULT_LIMIT,
  ADMIN_LIST_MAX_LIMIT,
  assignAdminVerification,
  buildAdminCsvParams,
  buildAdminListQuery,
  exportAdminOpportunitiesCsv,
  exportAdminOrganizationsCsv,
  exportAdminVolunteersCsv,
  getAdminLatestDossier,
  getAdminStatusHistories,
  getAdminUser,
  getAdminVolunteerExperiences,
  getDossierMedia,
  isAdminOppCloseStatus,
  isAdminUserStatus,
  isAdminVerificationQueueStatus,
  listAdminOpportunities,
  listAdminOrganizations,
  listAdminVerifications,
  listAdminVolunteers,
  normalizeAdminLimit,
  rejectAdminVerification,
  sendAdminNotice,
  setAdminOpportunityStatus,
  setAdminOrganizationStatus,
  setAdminUserStatus,
  approveAdminVerification,
} from './adminLists';

function stubClient(handlers: {
  get?: (url: string, config?: unknown) => unknown;
  patch?: (url: string, body?: unknown) => unknown;
  post?: (url: string, body?: unknown) => unknown;
}) {
  const get = vi.fn(async (url: string, config?: unknown) => ({
    data: handlers.get?.(url, config),
    headers: {},
  }));
  const patch = vi.fn(async (url: string, body?: unknown) => ({
    data: handlers.patch?.(url, body),
  }));
  const post = vi.fn(async (url: string, body?: unknown) => ({
    data: handlers.post?.(url, body),
  }));
  const client = { get, patch, post } as unknown as AxiosInstance;
  return { client, get, patch, post };
}

const volunteerPage = {
  items: [
    {
      id: '64f0000000000000000000a1',
      username: 'amina',
      email: 'amina@example.com',
      status: 'active',
      skillNames: ['First aid'],
      wilayaName: 'Alger',
      lastActivityAt: '2026-09-01T00:00:00.000Z',
      emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  nextCursor: null,
  limit: 20,
  total: 1,
  page: 1,
  pages: 1,
};

describe('admin list query builder', () => {
  it('drops unset/blank filters and trims q', () => {
    expect(buildAdminListQuery({})).toEqual({});
    expect(
      buildAdminListQuery({
        q: '  amina ',
        wilayaId: '',
        skillId: [],
        status: '  ',
      }),
    ).toEqual({ q: 'amina' });
  });

  it('joins multi-value skill ids and keeps single values', () => {
    expect(buildAdminListQuery({ skillId: ['a', ' ', 'b'] })).toEqual({
      skillId: 'a,b',
    });
    expect(buildAdminListQuery({ skillId: '  a,b ' })).toEqual({ skillId: 'a,b' });
  });

  it('passes sort through and keeps cursor', () => {
    expect(
      buildAdminListQuery({ sort: 'newest', cursor: 'cur', limit: 20 }),
    ).toEqual({ sort: 'newest', cursor: 'cur', limit: 20 });
  });

  it('clamps pageSize into the backend window (never 100)', () => {
    expect(normalizeAdminLimit(undefined)).toBeUndefined();
    expect(normalizeAdminLimit(20)).toBe(20);
    expect(normalizeAdminLimit(100)).toBe(ADMIN_LIST_MAX_LIMIT);
    expect(normalizeAdminLimit(500)).toBe(ADMIN_LIST_MAX_LIMIT);
    expect(normalizeAdminLimit(0)).toBe(ADMIN_LIST_DEFAULT_LIMIT);
    expect(buildAdminListQuery({ limit: 100 })).toEqual({ limit: 50 });
  });

  it('adds format=csv on top of the active filters', () => {
    expect(buildAdminCsvParams({ q: 'amina', status: 'pending' })).toEqual({
      q: 'amina',
      status: 'pending',
      format: 'csv',
    });
  });
});

describe('admin status vocab guards', () => {
  it('accepts only real user/org statuses', () => {
    expect(isAdminUserStatus('active')).toBe(true);
    expect(isAdminUserStatus('suspended')).toBe(true);
    expect(isAdminUserStatus('deleted')).toBe(false);
    expect(isAdminUserStatus('Pending')).toBe(false);
    expect(isAdminUserStatus('Incomplete')).toBe(false);
  });

  it('accepts only real opportunity close statuses', () => {
    expect(isAdminOppCloseStatus('closed')).toBe(true);
    expect(isAdminOppCloseStatus('cancelled')).toBe(true);
    expect(isAdminOppCloseStatus('published')).toBe(false);
    expect(isAdminOppCloseStatus('Flagged')).toBe(false);
  });

  it('accepts only real verification queue statuses', () => {
    expect(isAdminVerificationQueueStatus('pending')).toBe(true);
    expect(isAdminVerificationQueueStatus('verified')).toBe(true);
    expect(isAdminVerificationQueueStatus('rejected')).toBe(true);
    expect(isAdminVerificationQueueStatus('Legal Review')).toBe(false);
  });
});

describe('admin volunteer endpoints', () => {
  it('lists volunteers with combined filters', async () => {
    const { client, get } = stubClient({ get: () => volunteerPage });
    const page = await listAdminVolunteers(client, {
      q: 'amina',
      wilayaId: '16',
      skillId: 'a,b',
    });
    expect(get).toHaveBeenCalledWith(
      '/admin/volunteers',
      expect.objectContaining({
        params: { q: 'amina', wilayaId: '16', skillId: 'a,b' },
      }),
    );
    expect(page.total).toBe(1);
    expect(page.items[0]?.username).toBe('amina');
  });

  it('reads volunteer experiences for latest engagement', async () => {
    const { client, get } = stubClient({
      get: () => ({ items: [], nextCursor: null, total: 0 }),
    });
    await getAdminVolunteerExperiences(client, '64f0000000000000000000a1');
    expect(get).toHaveBeenCalledWith(
      '/admin/volunteers/64f0000000000000000000a1/experiences',
    );
  });

  it('reads a user without password hash expectations', async () => {
    const { client, get } = stubClient({
      get: () => ({ id: 'u1', email: 'a@e.com', role: 'volunteer', status: 'active' }),
    });
    const user = await getAdminUser(client, 'u1');
    expect(get).toHaveBeenCalledWith('/admin/users/u1');
    expect(user.status).toBe('active');
    expect('passwordHash' in user).toBe(false);
  });

  it('suspends with reason/notes capped to backend limits', async () => {
    const { client, patch } = stubClient({
      patch: () => ({ id: 'u1', status: 'suspended' }),
    });
    await setAdminUserStatus(client, 'u1', {
      status: 'suspended',
      reason: `r`.repeat(600),
      notes: `n`.repeat(2500),
    });
    const body = patch.mock.calls[0]?.[1] as Record<string, string>;
    expect(patch.mock.calls[0]?.[0]).toBe('/admin/users/u1/status');
    expect(body.status).toBe('suspended');
    expect(body.reason?.length).toBe(500);
    expect(body.notes?.length).toBe(2000);
  });

  it('omits blank reason/notes from the status body', async () => {
    const { client, patch } = stubClient({
      patch: () => ({ id: 'u1', status: 'active' }),
    });
    await setAdminUserStatus(client, 'u1', { status: 'active', reason: '  ' });
    expect(patch).toHaveBeenCalledWith('/admin/users/u1/status', {
      status: 'active',
    });
  });

  it('sends a notice with a trimmed capped message', async () => {
    const { client, post } = stubClient({ post: () => ({ ok: true }) });
    await sendAdminNotice(client, 'u1', '  Please update your profile  ');
    expect(post).toHaveBeenCalledWith('/admin/users/u1/notice', {
      message: 'Please update your profile',
    });
  });
});

describe('admin organization and verification endpoints', () => {
  it('lists organizations with combined filters', async () => {
    const { client, get } = stubClient({
      get: () => ({ items: [], nextCursor: null, total: 0 }),
    });
    await listAdminOrganizations(client, {
      q: 'el-amel',
      verificationStatus: 'pending',
    });
    expect(get).toHaveBeenCalledWith(
      '/admin/organizations',
      expect.objectContaining({
        params: { q: 'el-amel', verificationStatus: 'pending' },
      }),
    );
  });

  it('suspends an organization with reason and notes', async () => {
    const { client, patch } = stubClient({
      patch: () => ({ id: 'o1', status: 'suspended' }),
    });
    await setAdminOrganizationStatus(client, 'o1', {
      status: 'suspended',
      reason: 'policy breach',
      notes: 'see report 7',
    });
    expect(patch).toHaveBeenCalledWith('/admin/organizations/o1/status', {
      status: 'suspended',
      reason: 'policy breach',
      notes: 'see report 7',
    });
  });

  it('lists the verification queue defaulting to caller-supplied status', async () => {
    const { client, get } = stubClient({
      get: () => ({ items: [], nextCursor: null, total: 0 }),
    });
    await listAdminVerifications(client, { status: 'pending' });
    expect(get).toHaveBeenCalledWith(
      '/admin/organizations/verifications',
      expect.objectContaining({ params: { status: 'pending' } }),
    );
  });

  it('assigns an officer to a verification row', async () => {
    const { client, patch } = stubClient({
      patch: () => ({ id: 'r1', assignedAdminId: 'a1' }),
    });
    await assignAdminVerification(client, 'r1', 'a1');
    expect(patch).toHaveBeenCalledWith(
      '/admin/organizations/verifications/r1/assign',
      { assignedAdminId: 'a1' },
    );
  });

  it('reads the latest dossier for an organization', async () => {
    const { client, get } = stubClient({
      get: () => ({ id: 'r1', status: 'pending', documents: ['m1'] }),
    });
    const row = await getAdminLatestDossier(client, 'o1');
    expect(get).toHaveBeenCalledWith(
      '/admin/organizations/o1/verification/latest',
    );
    expect(row.documents).toEqual(['m1']);
  });

  it('approves with no body and rejects with the required reason', async () => {
    const { client, post } = stubClient({
      post: (url) =>
        url.endsWith('/approve')
          ? { id: 'r1', status: 'verified' }
          : { id: 'r1', status: 'rejected' },
    });
    await approveAdminVerification(client, 'o1');
    expect(post).toHaveBeenCalledWith(
      '/admin/organizations/o1/verification/approve',
    );
    await rejectAdminVerification(client, 'o1', '  Missing statute scan  ');
    expect(post).toHaveBeenCalledWith(
      '/admin/organizations/o1/verification/reject',
      { rejectionReason: 'Missing statute scan' },
    );
  });

  it('reads dossier media through the media endpoint', async () => {
    const { client, get } = stubClient({
      get: () => ({ media: { id: 'm1' }, url: 'https://cdn/x.pdf' }),
    });
    const media = await getDossierMedia(client, 'm1');
    expect(get).toHaveBeenCalledWith('/media/m1');
    expect(media.url).toBe('https://cdn/x.pdf');
  });
});

describe('admin opportunity and history endpoints', () => {
  it('lists opportunities with combined filters', async () => {
    const { client, get } = stubClient({
      get: () => ({ items: [], nextCursor: null, total: 0 }),
    });
    await listAdminOpportunities(client, { q: 'cleanup', status: 'published' });
    expect(get).toHaveBeenCalledWith(
      '/admin/opportunities',
      expect.objectContaining({ params: { q: 'cleanup', status: 'published' } }),
    );
  });

  it('force-closes via status-PATCH (never a close POST)', async () => {
    const { client, patch, post } = stubClient({
      patch: () => ({ id: 'op1', status: 'closed' }),
    });
    await setAdminOpportunityStatus(client, 'op1', {
      status: 'closed',
      reason: 'abusive content',
    });
    expect(patch).toHaveBeenCalledWith('/admin/opportunities/op1/status', {
      status: 'closed',
      reason: 'abusive content',
    });
    expect(post).not.toHaveBeenCalled();
  });

  it('reads status histories with both required params', async () => {
    const { client, get } = stubClient({
      get: () => [
        { from: 'active', to: 'suspended', reason: 'r', notes: 'n' },
      ],
    });
    const rows = await getAdminStatusHistories(client, 'user', 'u1');
    expect(get).toHaveBeenCalledWith(
      '/admin/status-histories',
      expect.objectContaining({ params: { entityType: 'user', entityId: 'u1' } }),
    );
    expect(rows[0]?.from).toBe('active');
  });

  it('exports CSV variants with format=csv (streams via downloadBlob)', async () => {
    // The CSV path never resolves through the stubbed .get().data shape —
    // assert the request (path + format=csv + blob responseType) instead.
    const { client, get } = stubClient({
      get: () => {
        throw new Error('csv streams through downloadBlob, not .get().data');
      },
    });
    await expect(exportAdminVolunteersCsv(client, { q: 'amina' })).rejects.toThrow();
    expect(get).toHaveBeenCalledWith('/admin/volunteers', {
      params: { q: 'amina', format: 'csv' },
      responseType: 'blob',
    });
    await expect(exportAdminOrganizationsCsv(client, {})).rejects.toThrow();
    expect(get).toHaveBeenCalledWith('/admin/organizations', {
      params: { format: 'csv' },
      responseType: 'blob',
    });
    await expect(exportAdminOpportunitiesCsv(client, {})).rejects.toThrow();
    expect(get).toHaveBeenCalledWith('/admin/opportunities', {
      params: { format: 'csv' },
      responseType: 'blob',
    });
  });
});
