// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultWorkspace } from '../../src/shared/default-workspace';
import { CURRENT_SESSION_VERSION, type SessionRecord } from '../../src/shared/session-model';

const electron = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
    electron.handlers.set(channel, handler);
  }),
  removeHandler: vi.fn((channel: string) => {
    electron.handlers.delete(channel);
  }),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: electron.handle,
    removeHandler: electron.removeHandler,
  },
}));

import { registerIpcHandlers } from '../../src/main/ipc';
import { IPC_CHANNELS } from '../../src/shared/contracts';

function activeSession(): SessionRecord {
  const workspace = createDefaultWorkspace();
  return {
    version: CURRENT_SESSION_VERSION,
    id: 'session-1',
    presetId: workspace.settings.activePresetId,
    presetName: workspace.presets[0]!.name,
    durationSeconds: 3_600,
    startedAt: '2026-08-31T08:00:00.000Z',
    endsAt: '2026-08-31T09:00:00.000Z',
    endedAt: null,
    endReason: null,
    spaces: workspace.spaces,
  };
}

function handler(channel: string): (...args: unknown[]) => Promise<unknown> {
  const registered = electron.handlers.get(channel);
  if (!registered) throw new Error(`Missing IPC handler: ${channel}`);
  return registered as (...args: unknown[]) => Promise<unknown>;
}

describe('focus IPC transition ordering', () => {
  beforeEach(() => {
    electron.handlers.clear();
    electron.handle.mockClear();
    electron.removeHandler.mockClear();
  });

  it('persists a new session before entering fullscreen focus', async () => {
    const order: string[] = [];
    const workspace = createDefaultWorkspace();
    const session = activeSession();
    const store = { getState: vi.fn().mockResolvedValue({ state: workspace, notice: null }) };
    const sessions = {
      start: vi.fn(async () => {
        order.push('persist');
        return { session, notice: null };
      }),
    };
    const runtime = {
      reset: vi.fn(() => order.push('reset')),
      enterFocus: vi.fn(() => order.push('enter')),
    };
    registerIpcHandlers(store as never, sessions as never, runtime as never, {} as never);

    await handler(IPC_CHANNELS.sessionStart)({}, { presetId: workspace.settings.activePresetId });

    expect(order).toEqual(['reset', 'persist', 'enter']);
    expect(runtime.enterFocus).toHaveBeenCalledWith(session);
  });

  it('does not leave fullscreen until an early ending is durable', async () => {
    const order: string[] = [];
    const failedWrite = new Error('disk full');
    const endEarly = vi.fn<() => Promise<unknown>>(async () => {
      order.push('persist');
      throw failedWrite;
    });
    const sessions = { endEarly };
    const runtime = {
      reset: vi.fn(() => order.push('reset')),
      exitFocus: vi.fn(() => order.push('exit')),
    };
    registerIpcHandlers({} as never, sessions as never, runtime as never, {} as never);

    await expect(handler(IPC_CHANNELS.sessionEnd)({})).rejects.toThrow('disk full');
    expect(order).toEqual(['reset', 'persist']);
    expect(runtime.exitFocus).not.toHaveBeenCalled();

    const ended = {
      ...activeSession(),
      endedAt: '2026-08-31T08:15:00.000Z',
      endReason: 'ended-early' as const,
    };
    sessions.endEarly.mockImplementation(async () => {
      order.push('persist');
      return { session: ended, notice: null };
    });
    order.length = 0;

    await handler(IPC_CHANNELS.sessionEnd)({});
    expect(order).toEqual(['reset', 'persist', 'exit']);
  });

  it('keeps Spotify authorization outside an active focus session', async () => {
    const sessions = { peekSession: vi.fn().mockResolvedValue(activeSession()) };
    const spotify = {
      connect: vi.fn().mockResolvedValue({ status: 'idle' }),
      getPlayback: vi.fn().mockResolvedValue({ status: 'disconnected' }),
      disconnect: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      next: vi.fn(),
      open: vi.fn(),
    };
    registerIpcHandlers({} as never, sessions as never, {} as never, spotify as never);

    await expect(handler(IPC_CHANNELS.spotifyConnect)({})).rejects.toThrow(
      'Connect Spotify before starting',
    );
    expect(spotify.connect).not.toHaveBeenCalled();
    await expect(handler(IPC_CHANNELS.spotifyGet)({})).resolves.toEqual({
      status: 'disconnected',
    });
    await expect(
      handler(IPC_CHANNELS.spotifyOpen)({}, { url: 'https://open.spotify.com/track/id' }),
    ).rejects.toThrow('Open Spotify after your focus session');
    expect(spotify.open).not.toHaveBeenCalled();

    sessions.peekSession.mockResolvedValue(null);
    await expect(handler(IPC_CHANNELS.spotifyConnect)({})).resolves.toEqual({ status: 'idle' });
    expect(spotify.connect).toHaveBeenCalledOnce();
    await handler(IPC_CHANNELS.spotifyOpen)({}, { url: 'https://open.spotify.com/track/id' });
    expect(spotify.open).toHaveBeenCalledWith('https://open.spotify.com/track/id');
  });
});
