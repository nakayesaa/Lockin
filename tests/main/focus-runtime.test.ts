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
      loadURL: ReturnType<typeof vi.fn>;
      setIgnoreMenuShortcuts: ReturnType<typeof vi.fn>;
      emit(event: string, ...args: unknown[]): void;
      openWindow(url: string): { action: string } | undefined;
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
    readonly setIgnoreMenuShortcuts = vi.fn();
    readonly loadURL = vi.fn(async () => {
      const error = electron.nextLoadError;
      electron.nextLoadError = null;
      if (error) throw error;
    });
    private readonly listeners = new Map<string, Array<(...args: never[]) => void>>();
    private windowOpenHandler: ((details: { url: string }) => { action: string }) | undefined;

    on(event: string, listener: (...args: never[]) => void) {
      const listeners = this.listeners.get(event) ?? [];
      listeners.push(listener);
      this.listeners.set(event, listeners);
    }

    emit(event: string, ...args: unknown[]) {
      this.listeners.get(event)?.forEach((listener) => listener(...(args as never[])));
    }

    setWindowOpenHandler(handler: (details: { url: string }) => { action: string }) {
      this.windowOpenHandler = handler;
    }
    openWindow(url: string) {
      return this.windowOpenHandler?.({ url });
    }
    isDestroyed() {
      return false;
    }
    focus() {}
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
  const onNavigationBlocked = vi.fn();
  const onSiteStateChanged = vi.fn();
  const runtime = new FocusRuntime(
    window as never,
    { getSession: vi.fn().mockResolvedValue({ session, notice: null }) } as never,
    { onNavigationBlocked, onSiteStateChanged },
  );
  return {
    runtime,
    window,
    onNavigationBlocked,
    onSiteStateChanged,
  };
}

describe('FocusRuntime website lifecycle', () => {
  beforeEach(() => {
    electron.views.length = 0;
    electron.nextLoadError = null;
  });

  it('owns only one website view and disposes it when switching or closing', async () => {
    const { runtime, window } = setup();
    const permissionCheck = electron.siteSession.setPermissionCheckHandler.mock.calls[0]?.[0] as
      (() => boolean) | undefined;
    const permissionRequest = electron.siteSession.setPermissionRequestHandler.mock
      .calls[0]?.[0] as
      | ((contents: unknown, permission: string, callback: (allowed: boolean) => void) => void)
      | undefined;
    const downloadHandler = electron.siteSession.on.mock.calls.find(
      ([event]) => event === 'will-download',
    )?.[1] as ((event: { preventDefault(): void }) => void) | undefined;
    const permissionCallback = vi.fn();
    const downloadEvent = { preventDefault: vi.fn() };

    expect(permissionCheck?.()).toBe(false);
    permissionRequest?.({}, 'camera', permissionCallback);
    expect(permissionCallback).toHaveBeenCalledWith(false);
    downloadHandler?.(downloadEvent);
    expect(downloadEvent.preventDefault).toHaveBeenCalledOnce();

    await runtime.openSpace('chatgpt');
    const first = electron.views[0]!;
    expect(first.setBounds).toHaveBeenCalledWith({ x: 0, y: 0, width: 1200, height: 800 });
    expect(first.webContents.setIgnoreMenuShortcuts).toHaveBeenCalledWith(true);

    first.webContents.emit('before-mouse-event', {}, { type: 'mouseMove', x: 1150, y: 20 });
    expect(first.setBounds).toHaveBeenLastCalledWith({ x: 0, y: 64, width: 1200, height: 736 });
    runtime.setSiteControlsVisible(false);
    expect(first.setBounds).toHaveBeenLastCalledWith({ x: 0, y: 0, width: 1200, height: 800 });

    await runtime.openSpace('leetcode');
    expect(first.webContents.close).toHaveBeenCalledOnce();
    expect(window.contentView.removeChildView).toHaveBeenCalledWith(first);
    expect(window.contentView.addChildView).toHaveBeenCalledTimes(2);

    runtime.closeSpace();
    expect(electron.views[1]!.webContents.close).toHaveBeenCalledOnce();
  });

  it('blocks every outside top-level navigation while leaving subresources alone', async () => {
    const { runtime, onNavigationBlocked } = setup();
    await runtime.openSpace('chatgpt');
    const view = electron.views[0]!;
    const subframe = {
      url: 'https://outside.example/frame',
      isMainFrame: false,
      preventDefault: vi.fn(),
    };

    view.webContents.emit('will-navigate', subframe);
    expect(subframe.preventDefault).not.toHaveBeenCalled();

    const redirect = {
      url: 'https://chatgpt.com.evil.example/login',
      isMainFrame: true,
      preventDefault: vi.fn(),
    };
    view.webContents.emit('will-redirect', redirect);
    expect(redirect.preventDefault).toHaveBeenCalledOnce();
    expect(view.webContents.close).toHaveBeenCalledOnce();
    expect(onNavigationBlocked).toHaveBeenCalledWith(redirect.url);
  });

  it('opens allowed new-window requests in place and ignores superseded loads', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { runtime, onSiteStateChanged } = setup();
    await runtime.openSpace('chatgpt');
    const view = electron.views[0]!;
    electron.nextLoadError = new Error('superseded');

    expect(view.webContents.openWindow('https://chatgpt.com/auth')).toEqual({ action: 'deny' });
    expect(view.webContents.openWindow('https://leetcode.com/problems')).toEqual({
      action: 'deny',
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(view.webContents.loadURL).toHaveBeenLastCalledWith('https://leetcode.com/problems');
    expect(view.webContents.close).not.toHaveBeenCalled();
    expect(onSiteStateChanged).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
    expect(onSiteStateChanged).toHaveBeenLastCalledWith({ status: 'ready', spaceId: 'leetcode' });
  });

  it('rejects external protocols and stale events cannot close the current view', async () => {
    const { runtime, onNavigationBlocked } = setup();
    await runtime.openSpace('chatgpt');
    const staleView = electron.views[0]!;
    await runtime.openSpace('leetcode');
    const currentView = electron.views[1]!;
    const staleNavigation = {
      url: 'https://outside.example/',
      isMainFrame: true,
      preventDefault: vi.fn(),
    };

    staleView.webContents.emit('will-navigate', staleNavigation);
    expect(staleNavigation.preventDefault).toHaveBeenCalledOnce();
    expect(currentView.webContents.close).not.toHaveBeenCalled();
    expect(onNavigationBlocked).not.toHaveBeenCalled();

    expect(currentView.webContents.openWindow('mailto:hello@example.com')).toEqual({
      action: 'deny',
    });
    expect(currentView.webContents.close).toHaveBeenCalledOnce();
    expect(onNavigationBlocked).toHaveBeenCalledWith('mailto:hello@example.com');
  });

  it('lets websites unload cleanly and rejects unknown space identifiers', async () => {
    const { runtime } = setup();
    await expect(runtime.openSpace('unknown')).rejects.toThrow(
      'This space is not allowed in the active session',
    );
    expect(electron.views).toHaveLength(0);

    await runtime.openSpace('chatgpt');
    const preventDefault = vi.fn();
    electron.views[0]!.webContents.emit('will-prevent-unload', { preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
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
