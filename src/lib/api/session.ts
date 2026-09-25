import { z } from 'zod';
import type { AxiosInstance } from 'axios';
import axios from 'axios';
import type { TokenPair } from '../auth/storage';

// Backend contract (openspec/specs/auth): login returns { accessToken, refreshToken,
// user }; POST /auth/refresh rotates and returns a new access/refresh pair;
// POST /auth/logout is authenticated (session comes from the access token);
// GET /auth/me returns (id, email, emailVerifiedAt, role, status, createdAt).

export const RefreshResponseSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
  })
  .passthrough();

export const SessionUserSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    emailVerifiedAt: z.string().nullable().optional(),
    role: z.enum(['volunteer', 'organization', 'admin']),
    status: z.string(),
    createdAt: z.string().optional(),
  })
  .passthrough();

export type SessionUser = z.infer<typeof SessionUserSchema>;

type HttpClient = Pick<AxiosInstance, 'get' | 'post'>;

export async function refreshSession(
  baseURL: string,
  refreshToken: string,
): Promise<TokenPair> {
  const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
  const parsed = RefreshResponseSchema.parse(data);
  return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
}

export async function getMe(client: HttpClient): Promise<SessionUser> {
  const { data } = await client.get('/auth/me');
  return SessionUserSchema.parse(data);
}

export async function logout(client: HttpClient): Promise<void> {
  await client.post('/auth/logout');
}
