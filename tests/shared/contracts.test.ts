// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  entityRequestSchema,
  presetUpdateRequestSchema,
  sessionEventSchema,
  sessionStartRequestSchema,
  siteControlsRequestSchema,
  siteOpenRequestSchema,
  spaceUpdateRequestSchema,
  workspaceResultSchema,
} from '../../src/shared/contracts';
import { createDefaultWorkspace } from '../../src/shared/default-workspace';

describe('shared IPC contracts', () => {
  it('accepts a validated workspace response', () => {
    expect(
      workspaceResultSchema.parse({ state: createDefaultWorkspace(), notice: null }).state.version,
    ).toBe(1);
  });

  it('rejects malformed entity and mutation payloads', () => {
    expect(() => entityRequestSchema.parse({ id: '../workspace.json' })).toThrow();
    expect(() =>
      spaceUpdateRequestSchema.parse({ id: 'space', input: { name: 'Unsafe', url: '' } }),
    ).toThrow();
    expect(() =>
      presetUpdateRequestSchema.parse({
        id: 'preset',
        input: { name: 'Empty', durationMinutes: 0, spaceIds: [] },
      }),
    ).toThrow();
  });

  it('validates session commands and events', () => {
    expect(sessionStartRequestSchema.parse({ presetId: 'deep-work' })).toEqual({
      presetId: 'deep-work',
    });
    expect(() => sessionStartRequestSchema.parse({ presetId: '../unsafe' })).toThrow();
    expect(siteOpenRequestSchema.parse({ spaceId: 'chatgpt' })).toEqual({ spaceId: 'chatgpt' });
    expect(siteControlsRequestSchema.parse({ visible: false })).toEqual({ visible: false });
    expect(() => siteControlsRequestSchema.parse({ visible: 'yes' })).toThrow();
    expect(() =>
      siteOpenRequestSchema.parse({ spaceId: '../unsafe', url: 'https://evil.test' }),
    ).toThrow();
    expect(
      sessionEventSchema.parse({ type: 'navigation-blocked', destination: 'example.com' }),
    ).toEqual({ type: 'navigation-blocked', destination: 'example.com' });
    expect(sessionEventSchema.parse({ type: 'session-completed' })).toEqual({
      type: 'session-completed',
    });
    expect(
      sessionEventSchema.parse({
        type: 'site-state-changed',
        status: 'failed',
        spaceId: 'chatgpt',
        message: 'The website stopped unexpectedly.',
      }),
    ).toEqual({
      type: 'site-state-changed',
      status: 'failed',
      spaceId: 'chatgpt',
      message: 'The website stopped unexpectedly.',
    });
    expect(() =>
      sessionEventSchema.parse({ type: 'navigation-blocked', destination: '' }),
    ).toThrow();
    expect(() =>
      sessionEventSchema.parse({
        type: 'site-state-changed',
        status: 'failed',
        spaceId: 'chatgpt',
      }),
    ).toThrow();
  });
});
