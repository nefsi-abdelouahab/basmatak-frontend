import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import {
  UpdateUsersMeSchema,
  deleteMySession,
  deleteUsersMe,
  deviceLabel,
  getUsersMe,
  listMySessions,
  patchUsersMe,
} from './users';

function stubClient(handlers: {
  get?: (url: string) => unknown;
  patch?: (url: string, body?: unknown) => unknown;
  delete?: (url: string) => unknown;
}) {
  const get = vi.fn(async (url: string) => ({ data: handlers.get?.(url) }));
  const patch = vi.fn(async (url: string, body?: unknown) => ({ data: handlers.patch?.(url, body) }));
  const del = vi.fn(async (url: string) => ({ data: handlers.delete?.(url) }));
  const client = { get, patch, delete: del } as unknown as AxiosInstance;
  return { client, del };
}

const session = {
  id: 'sess-current',
  createdAt: '2026-09-01T00:00:00.000Z',
  expiresAt: '2026-10-01T00:00:00.000Z',
  lastUsedAt: null,
  device: { browser: 'Chrome', os: 'Windows', device: 'Desktop' },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  isCurrent: true,
};

describe('users validators', () => {
  it('accepts email/phone contact updates only', () => {
    expect(
      UpdateUsersMeSchema.safeParse({ email: 'n@example.com', phone: '+213555123456' }).success,
    ).toBe(true);
  });

  it('rejects bad email and spaced phones', () => {
    expect(UpdateUsersMeSchema.safeParse({ email: 'nope' }).success).toBe(false);
    expect(UpdateUsersMeSchema.safeParse({ phone: '555 123' }).success).toBe(false);
  });
});

describe('users api functions', () => {
  it('getUsersMe/patchUsersMe round-trip /users/me', async () => {
    const { client } = stubClient({
      get: (url) =>
        url === '/users/me' ? { id: 'u1', email: 'v@example.com', phone: null } : undefined,
      patch: (url, body) =>
        url === '/users/me' ? { id: 'u1', email: 'v@example.com', ...(body as object) } : undefined,
    });
    expect((await getUsersMe(client)).email).toBe('v@example.com');
    const updated = await patchUsersMe(client, { phone: '+213555123456' });
    expect(updated.phone).toBe('+213555123456');
  });

  it('deleteUsersMe deletes /users/me (soft delete)', async () => {
    const { client, del } = stubClient({ delete: () => undefined });
    await deleteUsersMe(client);
    expect(del).toHaveBeenCalledWith('/users/me');
  });

  it('listMySessions surfaces device metadata + isCurrent', async () => {
    const other = { ...session, id: 'sess-old', isCurrent: false, device: null };
    const { client } = stubClient({
      get: (url) => (url === '/users/me/sessions' ? [session, other] : undefined),
    });
    const sessions = await listMySessions(client);
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((s) => s.isCurrent)).toHaveLength(1);
    expect(sessions[0].device?.browser).toBe('Chrome');
  });

  it('deleteMySession revokes one session by id', async () => {
    const { client, del } = stubClient({ delete: () => undefined });
    await deleteMySession(client, 'sess-old');
    expect(del).toHaveBeenCalledWith('/users/me/sessions/sess-old');
  });
});

describe('deviceLabel', () => {
  it('joins device/os/browser metadata', () => {
    expect(deviceLabel(session)).toBe('Desktop · Windows · Chrome');
  });

  it('falls back to the raw user agent, then unknown', () => {
    expect(deviceLabel({ device: null, userAgent: 'CustomAgent/1.0' })).toBe('CustomAgent/1.0');
    expect(deviceLabel({ device: null, userAgent: null })).toBe('Unknown device');
  });
});
