import { app, BrowserWindow, shell } from 'electron';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from './logger';
import { getPreloadPath } from './preload-path';
import { createWindowOptions } from './window-options';

const logger = createLogger('window-controller');
const allowedExternalProtocols = new Set(['https:']);

export async function createMainWindow(
  beforeLoad?: (window: BrowserWindow) => void,
): Promise<BrowserWindow> {
  const preloadPath = getPreloadPath(__dirname);
  await access(preloadPath);
  const window = new BrowserWindow(createWindowOptions(preloadPath, !app.isPackaged));
  beforeLoad?.(window);

  window.webContents.on('preload-error', (_event, failedPath, error) => {
    logger.error('Preload bridge failed', {
      preloadPath: failedPath,
      message: error.message,
    });
  });
  window.webContents.once('did-finish-load', () => {
    void window.webContents
      .executeJavaScript("typeof window.lockIn === 'object'", true)
      .then((available: boolean) => {
        if (!available) logger.error('Preload bridge is unavailable', { preloadPath });
      })
      .catch((error: unknown) => {
        logger.error('Preload bridge check failed', {
          preloadPath,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      });
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const destination = new URL(url);
      if (allowedExternalProtocols.has(destination.protocol)) {
        void shell.openExternal(destination.toString());
      }
    } catch {
      logger.warn('Blocked malformed external URL');
    }
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    const currentUrl = window.webContents.getURL();
    if (currentUrl && url !== currentUrl) {
      event.preventDefault();
      logger.warn('Blocked renderer navigation');
    }
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());

  window.once('ready-to-show', () => window.show());

  if (process.env['ELECTRON_RENDERER_URL']) {
    await window.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    await window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}
