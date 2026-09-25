import { z } from 'zod';
import type { AxiosInstance } from 'axios';

// Backend contract (openspec/specs/system-status): GET /system/status is public
// and returns { status, version, uptimeSeconds, maintenance, message }; it and
// GET /health stay reachable while maintenance mode is on.

export const HealthSchema = z
  .object({
    status: z.string(),
    version: z.string().optional(),
  })
  .passthrough();

export type Health = z.infer<typeof HealthSchema>;

export const SystemStatusSchema = z
  .object({
    status: z.string(),
    version: z.string().optional(),
    uptimeSeconds: z.number().optional(),
    maintenance: z.boolean(),
    message: z.string().optional(),
  })
  .passthrough();

export type SystemStatus = z.infer<typeof SystemStatusSchema>;

type HttpClient = Pick<AxiosInstance, 'get'>;

export async function getHealth(client: HttpClient): Promise<Health> {
  const { data } = await client.get('/health');
  return HealthSchema.parse(data);
}

export async function getSystemStatus(client: HttpClient): Promise<SystemStatus> {
  const { data } = await client.get('/system/status');
  return SystemStatusSchema.parse(data);
}
