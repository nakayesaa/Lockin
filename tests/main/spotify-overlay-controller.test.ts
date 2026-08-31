// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  nextId: 1,
  views: [] as Array<{
    setBounds: ReturnType<typeof vi.fn>;
    setVisible: ReturnType<typeof vi.fn>;
    webContents: {
      id: number;
      close: ReturnType<typeof vi.fn>;
      loadFile: ReturnType<typeof vi.fn>;
      isDestroyed(): boolean;
    };
  }>,
}));

vi.mock('electron', () => {
  class FakeWebContentsView {
    readonly setBounds = vi.fn();
    readonly setVisible = vi.fn();
    readonly webContents = {
      id: electron.nextId++,
      close: vi.fn(),
      loadFile: vi.fn().mockResolvedValue(undefined),
      loadURL: vi.fn().mockResolvedValue(undefined),
      setIgnoreMenuShortcuts: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      on: vi.fn(),
      getURL: vi.fn(() => 'file:///renderer/index.html#spotify-overlay'),
      isDestroyed: () => false,
    };

    constructor() {
      electron.views.push(this);
    }

    setBackgroundColor() {}
  }

  return { WebContentsView: FakeWebContentsView };
});

import { SpotifyOverlayController } from '../../src/main/spotify-overlay-controller';

function setup() {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const window = {
    contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
    getContentSize: () => [1200, 800],
    isDestroyed: () => false,
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      listeners.set(event, listener);
    }),
    off: vi.fn(),
    once: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      listeners.set(event, listener);
    }),
  };
  return {
    controller: new SpotifyOverlayController(window as never, '/app/preload.cjs', undefined),
    window,
  };
}

describe('Spotify website overlay', () => {
  beforeEach(() => {
    electron.views.length = 0;
    electron.nextId = 1;
  });

  it('stays above the website and collapses to the compact disc bounds', async () => {
    const { controller, window } = setup();

    controller.show();
    const view = electron.views[0]!;
    await vi.waitFor(() => expect(view.setVisible).toHaveBeenLastCalledWith(true));

    expect(window.contentView.addChildView).toHaveBeenLastCalledWith(view);
    expect(view.setBounds).toHaveBeenLastCalledWith({
      x: 872,
      y: 591,
      width: 300,
      height: 184,
    });
    expect(controller.owns({ id: view.webContents.id } as never)).toBe(true);

    controller.setExpanded(false);
    expect(view.setBounds).toHaveBeenLastCalledWith({
      x: 1096,
      y: 699,
      width: 76,
      height: 76,
    });

    controller.hide();
    expect(window.contentView.removeChildView).toHaveBeenCalledWith(view);
    expect(view.webContents.close).toHaveBeenCalledOnce();
  });
});
