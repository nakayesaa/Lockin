import { z } from 'zod';

export const IPC_CHANNELS = {
  appInfo: 'lockin:app-info',
  ping: 'lockin:ping',
} as const;

export const appInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  platform: z.enum(['win32', 'linux', 'darwin']),
  isPackaged: z.boolean(),
});

export const pingRequestSchema = z.object({
  message: z.string().trim().min(1).max(64),
});

export const pingResponseSchema = z.object({
  message: z.string(),
  receivedAt: z.string().datetime(),
});

export type AppInfo = z.infer<typeof appInfoSchema>;
export type PingRequest = z.infer<typeof pingRequestSchema>;
export type PingResponse = z.infer<typeof pingResponseSchema>;

export interface LockInApi {
  getAppInfo(): Promise<AppInfo>;
  ping(input: PingRequest): Promise<PingResponse>;
}
