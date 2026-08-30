import { BrowserWindow, WebContentsView, session as electronSession } from 'electron';
import type { Space } from '../shared/data-model';
import { findAllowedSpaceForUrl } from '../shared/website-rules';
import { createLogger } from './logger';
import type { SessionStore } from './session-store';
import { createSiteViewOptions, SITE_PARTITION } from './site-view-options';

const BACK_GUTTER = 64;
const configuredSessions = new WeakSet<object>();

interface FocusRuntimeOptions {
  readonly onNavigationBlocked: (url: string) => void;
}

export class FocusRuntime {
  private readonly views = new Map<string, WebContentsView>();
  private activeView: WebContentsView | null = null;
  private readonly logger = createLogger('focus-runtime');
  private readonly resize: () => void;

  constructor(
    private readonly window: BrowserWindow,
    private readonly sessions: SessionStore,
    private readonly options: FocusRuntimeOptions,
  ) {
    const siteSession = electronSession.fromPartition(SITE_PARTITION);
    if (!configuredSessions.has(siteSession)) {
      siteSession.setPermissionCheckHandler(() => false);
      siteSession.setPermissionRequestHandler((_contents, _permission, callback) =>
        callback(false),
      );
      siteSession.on('will-download', (event) => event.preventDefault());
      configuredSessions.add(siteSession);
    }

    this.resize = () => this.layoutActiveView();
    window.on('resize', this.resize);
    window.once('closed', () => this.destroy());
  }

  async openSpace(spaceId: string): Promise<void> {
    const session = (await this.sessions.getSession()).session;
    if (!session || session.endReason !== null) throw new Error('No focus session is active');
    const space = session.spaces.find(({ id }) => id === spaceId);
    if (!space) throw new Error('This space is not allowed in the active session');

    const view = this.views.get(space.id) ?? this.createView(space, session.spaces);
    this.views.set(space.id, view);
    if (this.activeView && this.activeView !== view) this.activeView.setVisible(false);
    this.window.contentView.addChildView(view);
    view.setVisible(true);
    this.activeView = view;
    this.layoutActiveView();

    if (!view.webContents.getURL()) await view.webContents.loadURL(space.startUrl);
    view.webContents.focus();
  }

  enterFocus(): void {
    if (!this.window.isFullScreen()) this.window.setFullScreen(true);
  }

  exitFocus(): void {
    if (this.window.isFullScreen()) this.window.setFullScreen(false);
  }

  closeSpace(): void {
    this.activeView?.setVisible(false);
    this.activeView = null;
    if (!this.window.isDestroyed()) this.window.webContents.focus();
  }

  reset(): void {
    this.closeSpace();
    for (const view of this.views.values()) {
      if (!this.window.isDestroyed()) this.window.contentView.removeChildView(view);
      if (!view.webContents.isDestroyed()) view.webContents.close();
    }
    this.views.clear();
  }

  destroy(): void {
    this.window.off('resize', this.resize);
    this.reset();
  }

  private createView(space: Space, allowedSpaces: Space[]): WebContentsView {
    const view = new WebContentsView(createSiteViewOptions());
    view.setBackgroundColor('#ffffff');
    const { webContents } = view;

    const guard = (details: { url: string; isMainFrame: boolean; preventDefault(): void }) => {
      if (!details.isMainFrame || findAllowedSpaceForUrl(details.url, allowedSpaces)) return;
      details.preventDefault();
      this.block(details.url);
    };
    webContents.on('will-navigate', (details) => guard(details));
    webContents.on('will-redirect', (details) => guard(details));
    webContents.setWindowOpenHandler(({ url }) => {
      if (findAllowedSpaceForUrl(url, allowedSpaces)) void webContents.loadURL(url);
      else this.block(url);
      return { action: 'deny' };
    });
    webContents.on('render-process-gone', (_event, details) => {
      this.logger.warn('Site renderer stopped', { spaceId: space.id, reason: details.reason });
    });

    return view;
  }

  private layoutActiveView(): void {
    if (!this.activeView) return;
    const [width = 0, height = 0] = this.window.getContentSize();
    this.activeView.setBounds({
      x: BACK_GUTTER,
      y: 0,
      width: Math.max(0, width - BACK_GUTTER),
      height: Math.max(0, height),
    });
  }

  private block(url: string): void {
    this.closeSpace();
    this.options.onNavigationBlocked(url);
  }
}
