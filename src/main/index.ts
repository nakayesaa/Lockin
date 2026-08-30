import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { getAppPaths } from './app-paths';
import { registerIpcHandlers } from './ipc';
import { FocusRuntime } from './focus-runtime';
import { createLogger } from './logger';
import { createMainWindow } from './window-controller';
import { WorkspaceStore } from './workspace-store';
import { SessionStore } from './session-store';
import { IPC_CHANNELS } from '../shared/contracts';

const logger = createLogger('main');

app.setName('LockIn');
app.setAppUserModelId('com.lockin.desktop');

app.whenReady().then(async () => {
  const paths = getAppPaths();
  logger.info('Application ready', {
    version: app.getVersion(),
    platform: process.platform,
    packaged: app.isPackaged,
    userDataConfigured: Boolean(paths.userData),
  });

  const workspaceStore = new WorkspaceStore(join(paths.userData, 'workspace.json'));
  const sessionStore = new SessionStore(join(paths.userData, 'session.json'));
  await workspaceStore.initialize();
  await sessionStore.initialize();

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
      });
      registerIpcHandlers(workspaceStore, sessionStore, runtime);
      void sessionStore.peekSession().then((session) => {
        if (session?.endReason === null) runtime.enterFocus();
      });
    });

  await openWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void openWindow();
    }
  });
});

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
