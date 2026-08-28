// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { createLockInApi } from '../../src/preload/api';
import { IPC_CHANNELS } from '../../src/shared/contracts';

describe('preload API', () => {
  it('uses only the declared app-info channel and validates its response', async () => {
    const invoke = vi.fn().mockResolvedValue({
      name: 'LockIn',
      version: '0.1.0',
      platform: 'win32',
      isPackaged: false,
    });
    const api = createLockInApi(invoke);

    await expect(api.getAppInfo()).resolves.toMatchObject({ name: 'LockIn' });
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.appInfo);
  });

  it('validates ping input before invoking the main process', async () => {
    const invoke = vi.fn().mockResolvedValue({
      message: 'ready',
      receivedAt: '2026-08-29T00:00:00.000Z',
    });
    const api = createLockInApi(invoke);

    await expect(api.ping({ message: '' })).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();

    await expect(api.ping({ message: 'ready' })).resolves.toMatchObject({ message: 'ready' });
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.ping, { message: 'ready' });
  });
});
