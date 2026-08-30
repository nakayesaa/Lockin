// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { isDesktopBridgeMissing } from '../../src/renderer/src/runtime-mode';

describe('renderer runtime mode', () => {
  it('never silently enters preview mode when the Electron bridge is missing', () => {
    expect(isDesktopBridgeMissing(undefined, false)).toBe(true);
    expect(isDesktopBridgeMissing(undefined, true)).toBe(false);
    expect(isDesktopBridgeMissing({} as never, false)).toBe(false);
  });
});
