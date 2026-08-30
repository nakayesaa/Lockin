import { BrowserWindow, WebContentsView, screen, session as electronSession } from 'electron';
import type { Space } from '../shared/data-model';
import { findAllowedSpaceForUrl } from '../shared/website-rules';
import { createLogger } from './logger';
import type { SessionStore } from './session-store';
import { createSiteViewOptions, SITE_PARTITION } from './site-view-options';

const BACK_GUTTER = 64;
const configuredSessions = new WeakSet<object>();

interface FocusRuntimeOptions {
  readonly onNavigationBlocked: (url: string) => void;
  readonly onSiteStateChanged: (state: SiteState) => void;
}

export type SiteState =
  | { readonly status: 'loading' | 'ready'; readonly spaceId: string }
  | { readonly status: 'failed'; readonly spaceId: string; readonly message: string };

export class FocusRuntime {
  private siteView: WebContentsView | null = null;
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
    window.on('enter-full-screen', this.resize);
    window.on('leave-full-screen', this.resize);
    screen.on('display-metrics-changed', this.resize);
    window.once('closed', () => this.destroy());
  }

  async openSpace(spaceId: string): Promise<void> {
    const session = (await this.sessions.getSession()).session;
    if (!session || session.endReason !== null) throw new Error('No focus session is active');
    const space = session.spaces.find(({ id }) => id === spaceId);
    if (!space) throw new Error('This space is not allowed in the active session');

    this.closeSpace();
    const view = this.createView(space, session.spaces);
    this.siteView = view;
    this.window.contentView.addChildView(view);
    view.setVisible(false);
    this.layoutActiveView();
    await this.load(view, space.id, space.startUrl);
  }

  enterFocus(): void {
    if (!this.window.isFullScreen()) this.window.setFullScreen(true);
  }

  exitFocus(): void {
    if (this.window.isFullScreen()) this.window.setFullScreen(false);
  }

  closeSpace(): void {
    this.disposeSiteView();
    if (!this.window.isDestroyed()) this.window.webContents.focus();
  }

  reset(): void {
    this.closeSpace();
  }

  destroy(): void {
    this.window.off('resize', this.resize);
    this.window.off('enter-full-screen', this.resize);
    this.window.off('leave-full-screen', this.resize);
    screen.off('display-metrics-changed', this.resize);
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
      if (findAllowedSpaceForUrl(url, allowedSpaces)) void this.load(view, space.id, url);
      else this.block(url);
      return { action: 'deny' };
    });
    webContents.on('render-process-gone', (_event, details) => {
      this.logger.warn('Site renderer stopped', { spaceId: space.id, reason: details.reason });
      this.fail(view, space.id, 'The website stopped unexpectedly.');
    });
    webContents.on('unresponsive', () =>
      this.fail(view, space.id, 'The website is not responding.'),
    );

    return view;
  }

  private async load(view: WebContentsView, spaceId: string, url: string): Promise<void> {
    if (this.siteView !== view) return;
    view.setVisible(false);
    this.options.onSiteStateChanged({ status: 'loading', spaceId });
    try {
      await view.webContents.loadURL(url);
      if (this.siteView !== view) return;
      view.setVisible(true);
      view.webContents.focus();
      this.options.onSiteStateChanged({ status: 'ready', spaceId });
    } catch (error) {
      if (this.siteView !== view) return;
      this.logger.warn('Website failed to load', {
        spaceId,
        message: error instanceof Error ? error.message : 'Unknown load error',
      });
      this.fail(view, spaceId, 'The website could not be loaded. Check your connection.');
    }
  }

  private layoutActiveView(): void {
    if (!this.siteView) return;
    const [width = 0, height = 0] = this.window.getContentSize();
    this.siteView.setBounds({
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

  private fail(view: WebContentsView, spaceId: string, message: string): void {
    if (this.siteView !== view) return;
    this.disposeSiteView();
    this.options.onSiteStateChanged({ status: 'failed', spaceId, message });
  }

  private disposeSiteView(): void {
    const view = this.siteView;
    if (!view) return;
    this.siteView = null;
    if (!this.window.isDestroyed()) this.window.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close();
  }
}
