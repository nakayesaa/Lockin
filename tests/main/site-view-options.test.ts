// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { createSiteViewOptions, SITE_PARTITION } from '../../src/main/site-view-options';

describe('site view security options', () => {
  it('uses a persistent but unprivileged sandbox', () => {
    expect(createSiteViewOptions().webPreferences).toEqual({
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
      safeDialogs: true,
      safeDialogsMessage: 'LockIn stopped this website from opening more dialogs.',
    });
  });
});
