import { BrowserWindow, WebContentsView, screen, session as electronSession } from 'electron';
import type { Space } from '../shared/data-model';
import type { SessionRecord } from '../shared/session-model';
import { findAllowedSpaceForUrl } from '../shared/website-rules';
import { createLogger } from './logger';
import type { SessionStore } from './session-store';
import { createSiteViewOptions, SITE_PARTITION } from './site-view-options';

const CONTROL_BAR_HEIGHT = 64;
const CONTROL_HOTSPOT_SIZE = 96;
const DEADLINE_CHECK_INTERVAL_MS = 1_000;
const configuredSessions = new WeakSet<object>();

interface FocusRuntimeOptions {
  readonly onNavigationBlocked: (url: string) => void;
  readonly onSiteStateChanged: (state: SiteState) => void;
  readonly onSessionCompleted: () => void;
}

export type SiteState =
  | { readonly status: 'loading' | 'ready'; readonly spaceId: string }
  | { readonly status: 'failed'; readonly spaceId: string; readonly message: string };

export class FocusRuntime {
  private activeSession: SessionRecord | null = null;
  private monotonicDeadline = 0;
  private completionTimer: ReturnType<typeof setTimeout> | null = null;
  private siteView: WebContentsView | null = null;
  private siteControlsVisible = false;
  private loadSequence = 0;
  private readonly logger = createLogger('focus-runtime');
  private readonly blockFocusShortcut = (event: Electron.Event, input: Electron.Input) => {
    if (!this.activeSession || input.type !== 'keyDown') return;
    const key = input.key.toLowerCase();
    if (key === 'f11' || ((input.control || input.meta) && key === 'w')) event.preventDefault();
  };
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
    window.webContents.on('before-input-event', this.blockFocusShortcut);
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
    if (!findAllowedSpaceForUrl(space.startUrl, [space])) {
      throw new Error('This space has an invalid start address');
    }

    this.closeSpace();
    const view = this.createView(space, session.spaces);
    this.siteView = view;
    this.window.contentView.addChildView(view);
    view.setVisible(false);
    this.layoutActiveView();
    await this.load(view, space.id, space.startUrl);
  }

  enterFocus(session: SessionRecord): void {
    if (session.endReason !== null) return;
    this.activeSession = structuredClone(session);
    this.monotonicDeadline =
      performance.now() + Math.max(0, Date.parse(session.endsAt) - Date.now());
    this.scheduleCompletion(session);
    if (this.window.isMinimized()) this.window.restore();
    this.window.show();
    if (!this.window.isFullScreen()) this.window.setFullScreen(true);
    this.window.focus();
    this.window.webContents.focus();
  }

  exitFocus(): void {
    this.clearCompletionTimer();
    this.activeSession = null;
    this.monotonicDeadline = 0;
    if (this.window.isFullScreen()) this.window.setFullScreen(false);
  }

  closeSpace(): void {
    this.siteControlsVisible = false;
    this.disposeSiteView();
    if (!this.window.isDestroyed()) this.window.webContents.focus();
  }

  reset(): void {
    this.closeSpace();
  }

  setSiteControlsVisible(visible: boolean): void {
    if (!this.siteView || this.siteControlsVisible === visible) return;
    this.siteControlsVisible = visible;
    this.layoutActiveView();
  }

  async clearWebsiteData(): Promise<void> {
    this.reset();
    const siteSession = electronSession.fromPartition(SITE_PARTITION);
    await siteSession.clearStorageData();
    await siteSession.clearCache();
  }

  destroy(): void {
    this.clearCompletionTimer();
    this.activeSession = null;
    this.monotonicDeadline = 0;
    this.window.webContents.off('before-input-event', this.blockFocusShortcut);
    this.window.off('resize', this.resize);
    this.window.off('enter-full-screen', this.resize);
    this.window.off('leave-full-screen', this.resize);
    screen.off('display-metrics-changed', this.resize);
    this.reset();
  }

  private scheduleCompletion(session: SessionRecord): void {
    this.clearCompletionTimer();
    const delay = Math.min(
      DEADLINE_CHECK_INTERVAL_MS,
      Math.max(
        0,
        Math.min(
          Date.parse(session.endsAt) - Date.now(),
          this.monotonicDeadline - performance.now(),
        ),
      ),
    );
    this.completionTimer = setTimeout(() => {
      this.completionTimer = null;
      if (Date.now() < Date.parse(session.endsAt) && performance.now() < this.monotonicDeadline) {
        this.scheduleCompletion(session);
      } else {
        void this.completeExpiredSession(session.id);
      }
    }, delay);
  }

  private async completeExpiredSession(sessionId: string): Promise<void> {
    if (this.activeSession?.id !== sessionId) return;
    try {
      const { session } = await this.sessions.complete(sessionId);
      if (!session || session.id !== sessionId) return;

      this.reset();
      this.exitFocus();
      if (session.endReason === 'completed') this.options.onSessionCompleted();
    } catch (error) {
      this.logger.error('Could not complete expired focus session', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      if (this.activeSession?.id === sessionId) {
        this.completionTimer = setTimeout(() => {
          this.completionTimer = null;
          void this.completeExpiredSession(sessionId);
        }, 1_000);
      }
    }
  }

  private clearCompletionTimer(): void {
    if (this.completionTimer !== null) clearTimeout(this.completionTimer);
    this.completionTimer = null;
  }

  private createView(space: Space, allowedSpaces: Space[]): WebContentsView {
    const view = new WebContentsView(createSiteViewOptions());
    view.setBackgroundColor('#ffffff');
    const { webContents } = view;
    webContents.setIgnoreMenuShortcuts(true);
    webContents.on('before-input-event', this.blockFocusShortcut);
    webContents.on('before-mouse-event', (_event, mouse) => {
      if (mouse.type !== 'mouseMove' || this.siteView !== view || this.siteControlsVisible) return;
      const [width = 0] = this.window.getContentSize();
      if (mouse.x >= width - CONTROL_HOTSPOT_SIZE && mouse.y <= CONTROL_HOTSPOT_SIZE) {
        this.setSiteControlsVisible(true);
      }
    });

    const guard = (details: { url: string; isMainFrame: boolean; preventDefault(): void }) => {
      if (!details.isMainFrame || findAllowedSpaceForUrl(details.url, allowedSpaces)) return;
      details.preventDefault();
      this.block(view, details.url);
    };
    webContents.on('will-navigate', (details) => guard(details));
    webContents.on('will-redirect', (details) => guard(details));
    webContents.setWindowOpenHandler(({ url }) => {
      const destination = findAllowedSpaceForUrl(url, allowedSpaces);
      if (destination) void this.load(view, destination.id, url);
      else this.block(view, url);
      return { action: 'deny' };
    });
    webContents.on('will-prevent-unload', (event) => event.preventDefault());
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
    const loadSequence = ++this.loadSequence;
    view.setVisible(false);
    this.options.onSiteStateChanged({ status: 'loading', spaceId });
    try {
      await view.webContents.loadURL(url);
      if (this.siteView !== view || this.loadSequence !== loadSequence) return;
      view.setVisible(true);
      view.webContents.focus();
      this.options.onSiteStateChanged({ status: 'ready', spaceId });
    } catch (error) {
      if (this.siteView !== view || this.loadSequence !== loadSequence) return;
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
    const top = this.siteControlsVisible ? CONTROL_BAR_HEIGHT : 0;
    this.siteView.setBounds({
      x: 0,
      y: top,
      width: Math.max(0, width),
      height: Math.max(0, height - top),
    });
  }

  private block(view: WebContentsView, url: string): void {
    if (this.siteView !== view) return;
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
    this.loadSequence += 1;
    if (!this.window.isDestroyed()) this.window.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close();
  }
}
