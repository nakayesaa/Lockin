import { app, BrowserWindow } from 'electron';
import { getAppPaths } from './app-paths';
import { registerIpcHandlers } from './ipc';
import { createLogger } from './logger';
import { createMainWindow } from './window-controller';

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

  registerIpcHandlers();
  await createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
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
