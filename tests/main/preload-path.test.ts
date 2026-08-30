// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { getPreloadPath } from '../../src/main/preload-path';

describe('preload path', () => {
  it('targets the ESM preload artifact emitted by electron-vite', () => {
    expect(getPreloadPath('/app/out/main')).toBe('/app/out/preload/index.mjs');
  });
});
