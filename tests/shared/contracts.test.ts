// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { appInfoSchema, pingRequestSchema } from '../../src/shared/contracts';

describe('shared IPC contracts', () => {
  it('accepts a valid application-info response', () => {
    expect(
      appInfoSchema.parse({
        name: 'LockIn',
        version: '0.1.0',
        platform: 'win32',
        isPackaged: false,
      }),
    ).toEqual({
      name: 'LockIn',
      version: '0.1.0',
      platform: 'win32',
      isPackaged: false,
    });
  });

  it('rejects empty and oversized ping payloads', () => {
    expect(() => pingRequestSchema.parse({ message: '' })).toThrow();
    expect(() => pingRequestSchema.parse({ message: 'x'.repeat(65) })).toThrow();
  });
});
