import { app, ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  appInfoSchema,
  pingRequestSchema,
  pingResponseSchema,
  type AppInfo,
  type PingResponse,
} from '../shared/contracts';

export function registerIpcHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.appInfo);
  ipcMain.removeHandler(IPC_CHANNELS.ping);

  ipcMain.handle(IPC_CHANNELS.appInfo, (): AppInfo => {
    return appInfoSchema.parse({
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
      isPackaged: app.isPackaged,
    });
  });

  ipcMain.handle(IPC_CHANNELS.ping, (_event, input: unknown): PingResponse => {
    const request = pingRequestSchema.parse(input);
    return pingResponseSchema.parse({
      message: request.message,
      receivedAt: new Date().toISOString(),
    });
  });
}
