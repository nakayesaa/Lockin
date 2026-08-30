// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultWorkspace } from '../../src/shared/default-workspace';
import type { SessionRecord } from '../../src/shared/session-model';

const electron = vi.hoisted(() => ({
  views: [] as Array<{
    setVisible: ReturnType<typeof vi.fn>;
    setBounds: ReturnType<typeof vi.fn>;
    webContents: {
      close: ReturnType<typeof vi.fn>;
      emit(event: string, ...args: unknown[]): void;
    };
  }>,
  nextLoadError: null as Error | null,
  screen: { on: vi.fn(), off: vi.fn() },
  siteSession: {
    setPermissionCheckHandler: vi.fn(),
    setPermissionRequestHandler: vi.fn(),
    on: vi.fn(),
    clearStorageData: vi.fn(),
    clearCache: vi.fn(),
  },
}));

vi.mock('electron', () => {
  class FakeWebContents {
    readonly close = vi.fn();
    private readonly listeners = new Map<string, Array<(...args: never[]) => void>>();

    on(event: string, listener: (...args: never[]) => void) {
      const listeners = this.listeners.get(event) ?? [];
      listeners.push(listener);
      this.listeners.set(event, listeners);
    }

    emit(event: string, ...args: unknown[]) {
      this.listeners.get(event)?.forEach((listener) => listener(...(args as never[])));
    }

    setWindowOpenHandler() {}
    isDestroyed() {
      return false;
    }
    focus() {}
    async loadURL() {
      const error = electron.nextLoadError;
      electron.nextLoadError = null;
      if (error) throw error;
    }
  }

  class FakeWebContentsView {
    readonly setVisible = vi.fn();
    readonly setBounds = vi.fn();
    readonly webContents = new FakeWebContents();

    constructor() {
      electron.views.push(this);
    }

    setBackgroundColor() {}
  }

  return {
    BrowserWindow: class {},
    WebContentsView: FakeWebContentsView,
    screen: electron.screen,
    session: { fromPartition: () => electron.siteSession },
  };
});

import { FocusRuntime } from '../../src/main/focus-runtime';

function activeSession(): SessionRecord {
  const workspace = createDefaultWorkspace();
  return {
    version: 1,
    id: 'session',
    presetId: 'default',
    presetName: 'Deep Work',
    durationSeconds: 3600,
    startedAt: '2026-08-30T08:00:00.000Z',
    endsAt: '2026-08-30T09:00:00.000Z',
    endedAt: null,
    endReason: null,
    spaces: workspace.spaces,
  };
}

function setup() {
  const session = activeSession();
  const window = {
    contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
    webContents: { focus: vi.fn() },
    getContentSize: () => [1200, 800],
    isDestroyed: () => false,
    isFullScreen: () => false,
    setFullScreen: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
  };
  const onSiteStateChanged = vi.fn();
  const runtime = new FocusRuntime(
    window as never,
    { getSession: vi.fn().mockResolvedValue({ session, notice: null }) } as never,
    { onNavigationBlocked: vi.fn(), onSiteStateChanged },
  );
  return { runtime, window, onSiteStateChanged };
}

describe('FocusRuntime website lifecycle', () => {
  beforeEach(() => {
    electron.views.length = 0;
    electron.nextLoadError = null;
  });

  it('owns only one website view and disposes it when switching or closing', async () => {
    const { runtime, window } = setup();

    await runtime.openSpace('chatgpt');
    const first = electron.views[0]!;
    expect(first.setBounds).toHaveBeenCalledWith({ x: 64, y: 0, width: 1136, height: 800 });

    await runtime.openSpace('leetcode');
    expect(first.webContents.close).toHaveBeenCalledOnce();
    expect(window.contentView.removeChildView).toHaveBeenCalledWith(first);
    expect(window.contentView.addChildView).toHaveBeenCalledTimes(2);

    runtime.closeSpace();
    expect(electron.views[1]!.webContents.close).toHaveBeenCalledOnce();
  });

  it('disposes failed and crashed views while publishing a retryable state', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { runtime, onSiteStateChanged } = setup();
    electron.nextLoadError = new Error('offline');

    await runtime.openSpace('chatgpt');
    expect(electron.views[0]!.webContents.close).toHaveBeenCalledOnce();
    expect(onSiteStateChanged).toHaveBeenLastCalledWith({
      status: 'failed',
      spaceId: 'chatgpt',
      message: 'The website could not be loaded. Check your connection.',
    });

    await runtime.openSpace('chatgpt');
    electron.views[1]!.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
    expect(electron.views[1]!.webContents.close).toHaveBeenCalledOnce();
    expect(onSiteStateChanged).toHaveBeenLastCalledWith({
      status: 'failed',
      spaceId: 'chatgpt',
      message: 'The website stopped unexpectedly.',
    });
  });
});
