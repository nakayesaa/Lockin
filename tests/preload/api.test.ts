// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { createLockInApi } from '../../src/preload/api';
import { IPC_CHANNELS } from '../../src/shared/contracts';
import { createDefaultWorkspace } from '../../src/shared/default-workspace';

describe('preload API', () => {
  it('exposes only declared workspace operations and validates responses', async () => {
    const response = { state: createDefaultWorkspace(), notice: null };
    const invoke = vi.fn().mockResolvedValue(response);
    const api = createLockInApi(invoke);

    expect(Object.keys(api)).toEqual([
      'getWorkspace',
      'createSpace',
      'updateSpace',
      'deleteSpace',
      'createPreset',
      'updatePreset',
      'duplicatePreset',
      'deletePreset',
      'setActivePreset',
    ]);
    await expect(api.getWorkspace()).resolves.toEqual(response);
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.workspaceGet);
  });

  it('validates mutation input before invoking the main process', async () => {
    const invoke = vi.fn().mockResolvedValue({ state: createDefaultWorkspace(), notice: null });
    const api = createLockInApi(invoke);

    await expect(api.deleteSpace('../unsafe')).rejects.toThrow();
    await expect(api.createSpace({ name: 'Missing URL', url: '' })).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();

    await expect(api.createSpace({ name: 'Figma', url: 'figma.com' })).resolves.toBeDefined();
    expect(invoke).toHaveBeenCalledWith(
      IPC_CHANNELS.spaceCreate,
      expect.objectContaining({ name: 'Figma', url: 'figma.com' }),
    );
  });
});
