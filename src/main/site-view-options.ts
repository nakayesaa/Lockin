import type { WebContentsViewConstructorOptions } from 'electron';

export const SITE_PARTITION = 'persist:lockin-sites';

export function createSiteViewOptions(): WebContentsViewConstructorOptions {
  return {
    webPreferences: {
      partition: SITE_PARTITION,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      devTools: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
      nodeIntegrationInSubFrames: false,
      nodeIntegrationInWorker: false,
    },
  };
}
