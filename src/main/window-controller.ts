import { BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { createLogger } from './logger';
import { createWindowOptions } from './window-options';

const logger = createLogger('window-controller');
const allowedExternalProtocols = new Set(['https:']);

export async function createMainWindow(
  beforeLoad?: (window: BrowserWindow) => void,
): Promise<BrowserWindow> {
  const preloadPath = join(__dirname, '../preload/index.js');
  const window = new BrowserWindow(createWindowOptions(preloadPath));
  beforeLoad?.(window);

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

  window.once('ready-to-show', () => window.show());

  if (process.env['ELECTRON_RENDERER_URL']) {
    await window.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    await window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}
