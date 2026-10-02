import { z } from 'zod';
import type { AxiosInstance } from 'axios';
import { SessionUserSchema } from './session';

// F1 auth module: one typed function per auth backend endpoint (base `/api/v1`).
// Verified read-only against backend/src/auth (controller + service):
// register/login/refresh return { accessToken, refreshToken, user }; every other
// auth route answers 204 with no body. Refresh/me/logout already live in F0's
// session.ts and are reused via import there — never redefined here.

export const emailSchema = z.string().email();
export const passwordSchema = z.string().min(8).max(72);
export const phoneSchema = z.string().regex(/^\+?[0-9]{8,15}$/);

// Human-formatted numbers ("+213 555 12 34", "(0) 49-90-12-34") are rejected
// by phoneSchema and by the backend's identical rule (UpdateMeDto), so forms
// normalize before validating or submitting: strip spaces, dashes, dots,
// and parentheses, keep a leading + and digits. Letters are never stripped
// (they stay invalid).
export function normalizePhoneNumber(value: string): string {
  return value.replace(/[\s\-.()]/g, '');
}

export const AuthTokensSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
    user: SessionUserSchema,
  })
  .passthrough();

export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const RegisterInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional(),
});

export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

type HttpClient = Pick<AxiosInstance, 'get' | 'post'>;

export async function registerVolunteer(
  client: HttpClient,
  input: RegisterInput,
): Promise<AuthTokens> {
  const { data } = await client.post('/auth/register/volunteer', input);
  return AuthTokensSchema.parse(data);
}

export async function registerOrganization(
  client: HttpClient,
  input: RegisterInput,
): Promise<AuthTokens> {
  const { data } = await client.post('/auth/register/organization', input);
  return AuthTokensSchema.parse(data);
}

export async function login(client: HttpClient, input: LoginInput): Promise<AuthTokens> {
  const { data } = await client.post('/auth/login', input);
  return AuthTokensSchema.parse(data);
}

export async function logoutAll(client: HttpClient): Promise<void> {
  await client.post('/auth/logout-all');
}

export async function logoutOthers(client: HttpClient): Promise<void> {
  await client.post('/auth/logout-others');
}

export async function verifyEmail(
  client: HttpClient,
  input: { token: string },
): Promise<void> {
  await client.post('/auth/verify-email', input);
}

export async function resendVerification(client: HttpClient): Promise<void> {
  await client.post('/auth/resend-verification');
}

export async function forgotPassword(
  client: HttpClient,
  input: { email: string },
): Promise<void> {
  await client.post('/auth/forgot-password', input);
}

export async function resetPassword(
  client: HttpClient,
  input: { token: string; newPassword: string },
): Promise<void> {
  await client.post('/auth/reset-password', input);
}

export async function changePassword(
  client: HttpClient,
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  await client.post('/auth/change-password', input);
}
