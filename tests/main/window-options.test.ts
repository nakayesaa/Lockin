// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { createWindowOptions } from '../../src/main/window-options';

describe('main-window security options', () => {
  it('isolates and sandboxes the renderer', () => {
    const options = createWindowOptions('C:\\LockIn\\preload.js');

    expect(options.webPreferences).toMatchObject({
      preload: 'C:\\LockIn\\preload.js',
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      devTools: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
    });
  });

  it('enables developer tools only when explicitly requested', () => {
    expect(createWindowOptions('/lockin/preload.js', true).webPreferences?.devTools).toBe(true);
  });

  it('starts hidden so content is ready before display', () => {
    expect(createWindowOptions('/lockin/preload.js').show).toBe(false);
  });
});
