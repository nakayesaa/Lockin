// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  entityRequestSchema,
  presetUpdateRequestSchema,
  spaceUpdateRequestSchema,
  workspaceResultSchema,
} from '../../src/shared/contracts';
import { createDefaultState } from '../../src/shared/data-model';

describe('shared IPC contracts', () => {
  it('accepts a validated workspace response', () => {
    expect(
      workspaceResultSchema.parse({ state: createDefaultState(), notice: null }).state.version,
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
});
