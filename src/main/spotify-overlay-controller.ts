import { WebContentsView } from 'electron';
import type { BrowserWindow, WebContents } from 'electron';
import { join } from 'node:path';
import { createLogger } from './logger';

const expandedSize = { width: 300, height: 184 } as const;
const compactSize = { width: 76, height: 76 } as const;
const rightMargin = 28;
const bottomMargin = 25;

export class SpotifyOverlayController {
  private readonly logger = createLogger('spotify-overlay');
  private view: WebContentsView | null = null;
  private expanded = true;
  private requestedVisible = false;
  private readonly resize = () => this.layout();

  constructor(
    private readonly window: BrowserWindow,
    private readonly preloadPath: string,
    private readonly rendererUrl: string | undefined,
  ) {
    window.on('resize', this.resize);
    window.on('enter-full-screen', this.resize);
    window.on('leave-full-screen', this.resize);
    window.once('closed', () => this.destroy());
  }

  show(): void {
    this.requestedVisible = true;
    if (this.view) {
      this.window.contentView.addChildView(this.view);
      this.layout();
      this.view.setVisible(true);
      return;
    }

    const view = this.createView();
    this.view = view;
    this.window.contentView.addChildView(view);
    view.setVisible(false);
    this.layout();
    void this.load(view)
      .then(() => {
        if (this.view !== view || !this.requestedVisible) return;
        this.window.contentView.addChildView(view);
        this.layout();
        view.setVisible(true);
      })
      .catch((error: unknown) => {
        if (this.view !== view) return;
        this.logger.error('Spotify overlay failed to load', {
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        this.destroyView();
      });
  }

  hide(): void {
    this.requestedVisible = false;
    this.expanded = true;
    this.destroyView();
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.layout();
  }

  owns(sender: WebContents): boolean {
    return this.view?.webContents.id === sender.id;
  }

  destroy(): void {
    this.requestedVisible = false;
    this.window.off('resize', this.resize);
    this.window.off('enter-full-screen', this.resize);
    this.window.off('leave-full-screen', this.resize);
    this.destroyView();
  }

  private createView(): WebContentsView {
    const view = new WebContentsView({
      webPreferences: {
        preload: this.preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webviewTag: false,
        devTools: Boolean(this.rendererUrl),
        webSecurity: true,
        allowRunningInsecureContent: false,
        navigateOnDragDrop: false,
      },
    });
    view.setBackgroundColor('#00000000');
    view.webContents.setIgnoreMenuShortcuts(true);
    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    view.webContents.on('will-navigate', (event, url) => {
      if (url !== view.webContents.getURL()) event.preventDefault();
    });
    return view;
  }

  private load(view: WebContentsView): Promise<void> {
    if (this.rendererUrl) {
      const destination = new URL(this.rendererUrl);
      destination.hash = 'spotify-overlay';
      return view.webContents.loadURL(destination.toString());
    }
    return view.webContents.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: 'spotify-overlay',
    });
  }

  private layout(): void {
    if (!this.view || this.window.isDestroyed()) return;
    const [windowWidth = 0, windowHeight = 0] = this.window.getContentSize();
    const size = this.expanded ? expandedSize : compactSize;
    this.view.setBounds({
      x: Math.max(0, windowWidth - size.width - rightMargin),
      y: Math.max(0, windowHeight - size.height - bottomMargin),
      ...size,
    });
  }

  private destroyView(): void {
    const view = this.view;
    if (!view) return;
    this.view = null;
    if (!this.window.isDestroyed()) this.window.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close();
  }
}
