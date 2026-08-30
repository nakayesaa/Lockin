// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { createLockInApi } from '../../src/preload/api';
import { IPC_CHANNELS } from '../../src/shared/contracts';
import { createDefaultWorkspace } from '../../src/shared/default-workspace';

describe('preload API', () => {
  function createBridge(invoke = vi.fn()) {
    return { invoke, on: vi.fn(), removeListener: vi.fn() };
  }

  it('exposes only declared workspace operations and validates responses', async () => {
    const response = { state: createDefaultWorkspace(), notice: null };
    const invoke = vi.fn().mockResolvedValue(response);
    const api = createLockInApi(createBridge(invoke));

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
      'getSession',
      'startSession',
      'endSession',
      'clearSession',
      'openSite',
      'closeSite',
      'onSessionEvent',
    ]);
    await expect(api.getWorkspace()).resolves.toEqual(response);
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.workspaceGet);
  });

  it('validates mutation input before invoking the main process', async () => {
    const invoke = vi.fn().mockResolvedValue({ state: createDefaultWorkspace(), notice: null });
    const api = createLockInApi(createBridge(invoke));

    await expect(api.deleteSpace('../unsafe')).rejects.toThrow();
    await expect(api.createSpace({ name: 'Missing URL', url: '' })).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();

    await expect(api.createSpace({ name: 'Figma', url: 'figma.com' })).resolves.toBeDefined();
    expect(invoke).toHaveBeenCalledWith(
      IPC_CHANNELS.spaceCreate,
      expect.objectContaining({ name: 'Figma', url: 'figma.com' }),
    );
  });

  it('subscribes to validated session events and removes the exact listener', () => {
    const bridge = createBridge();
    const api = createLockInApi(bridge);
    const listener = vi.fn();
    const unsubscribe = api.onSessionEvent(listener);
    const wrapped = bridge.on.mock.calls[0]?.[1] as (event: unknown, input: unknown) => void;

    wrapped({}, { type: 'navigation-blocked', destination: 'example.com' });
    expect(listener).toHaveBeenCalledWith({
      type: 'navigation-blocked',
      destination: 'example.com',
    });
    wrapped({}, { type: 'site-state-changed', status: 'ready', spaceId: 'chatgpt' });
    expect(listener).toHaveBeenLastCalledWith({
      type: 'site-state-changed',
      status: 'ready',
      spaceId: 'chatgpt',
    });
    unsubscribe();
    expect(bridge.removeListener).toHaveBeenCalledWith(IPC_CHANNELS.sessionEvent, wrapped);
  });
});
