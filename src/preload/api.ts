import type { IpcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  appInfoSchema,
  pingRequestSchema,
  pingResponseSchema,
  type LockInApi,
  type PingRequest,
} from '../shared/contracts';

type Invoke = IpcRenderer['invoke'];

export function createLockInApi(invoke: Invoke): LockInApi {
  return Object.freeze({
    async getAppInfo() {
      return appInfoSchema.parse(await invoke(IPC_CHANNELS.appInfo));
    },
    async ping(input: PingRequest) {
      const request = pingRequestSchema.parse(input);
      return pingResponseSchema.parse(await invoke(IPC_CHANNELS.ping, request));
    },
  });
}
