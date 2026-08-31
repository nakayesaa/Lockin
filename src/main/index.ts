import { app, BrowserWindow, dialog, safeStorage, shell } from 'electron';
import { join } from 'node:path';
import { getAppPaths } from './app-paths';
import { registerIpcHandlers } from './ipc';
import { FocusRuntime } from './focus-runtime';
import { createLogger, initializeFileLogging } from './logger';
import { createMainWindow } from './window-controller';
import { WorkspaceStore } from './workspace-store';
import { SessionStore } from './session-store';
import { IPC_CHANNELS } from '../shared/contracts';
import { SpotifyTokenStore } from './spotify-token-store';
import { SpotifyService } from './spotify-service';
import { SPOTIFY_CLIENT_ID, SPOTIFY_SCOPES } from './spotify-config';

const logger = createLogger('main');
const hasSingleInstanceLock = app.requestSingleInstanceLock();

app.setName('LockIn');
app.setAppUserModelId('com.lockin.desktop');

if (!hasSingleInstanceLock) app.quit();

app.on('second-instance', () => {
  const window = BrowserWindow.getAllWindows()[0];
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
});

async function startApplication(): Promise<void> {
  const paths = getAppPaths();
  await initializeFileLogging(paths.logs).catch((error: unknown) => {
    logger.warn('File logging is unavailable', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  });
  logger.info('Application ready', {
    version: app.getVersion(),
    platform: process.platform,
    packaged: app.isPackaged,
    userDataConfigured: Boolean(paths.userData),
  });

  const workspaceStore = new WorkspaceStore(join(paths.userData, 'workspace.json'));
  const sessionStore = new SessionStore(join(paths.userData, 'session.json'));
  const spotifyTokens = new SpotifyTokenStore(join(paths.userData, 'spotify.json'), {
    isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
    encryptString: (value) => safeStorage.encryptString(value),
    decryptString: (value) => safeStorage.decryptString(value),
  });
  await workspaceStore.initialize();
  await sessionStore.initialize();
  await spotifyTokens.initialize();
  const spotify = new SpotifyService({
    clientId: SPOTIFY_CLIENT_ID,
    scopes: SPOTIFY_SCOPES,
    tokens: spotifyTokens,
    openExternal: (url) => shell.openExternal(url),
  });

  const openWindow = () =>
    createMainWindow((window) => {
      const runtime = new FocusRuntime(window, sessionStore, {
        onNavigationBlocked: (url) => {
          let destination = 'Unknown destination';
          try {
            destination = new URL(url).hostname || destination;
          } catch {
            // Keep the safe fallback for malformed navigation attempts.
          }
          window.webContents.send(IPC_CHANNELS.sessionEvent, {
            type: 'navigation-blocked',
            destination,
          });
        },
        onSiteStateChanged: (state) => {
          window.webContents.send(IPC_CHANNELS.sessionEvent, {
            type: 'site-state-changed',
            ...state,
          });
        },
        onSessionCompleted: () => {
          window.webContents.send(IPC_CHANNELS.sessionEvent, {
            type: 'session-completed',
          });
        },
      });
      registerIpcHandlers(workspaceStore, sessionStore, runtime, spotify);
      void sessionStore.peekSession().then((session) => {
        if (session?.endReason === null) runtime.enterFocus(session);
      });
    });

  await openWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void openWindow();
    }
  });
}

if (hasSingleInstanceLock) {
  void app
    .whenReady()
    .then(startApplication)
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown startup error';
      logger.error('Application startup failed', { message });
      dialog.showErrorBox(
        'LockIn couldn’t start',
        `Restart LockIn and try again. If the problem continues, check ${app.getPath('logs')}.`,
      );
      app.quit();
    });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught main-process exception', {
    name: error.name,
    message: error.message,
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled main-process rejection', {
    reason: reason instanceof Error ? reason.message : 'Non-error rejection',
  });
});
