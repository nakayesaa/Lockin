// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  createDefaultState,
  hostRulesOverlap,
  hostnameMatches,
  normalizeWebsiteUrl,
  persistedStateSchema,
  type Space,
} from '../../src/shared/data-model';

describe('website normalization', () => {
  it('adds HTTPS and preserves a useful start path', () => {
    expect(normalizeWebsiteUrl('Example.COM/tasks?q=next#ignored')).toEqual({
      startUrl: 'https://example.com/tasks?q=next',
      hostname: 'example.com',
    });
  });

  it.each([
    'http://example.com',
    'javascript:alert(1)',
    'https://user:secret@example.com',
    'https://localhost',
    'https://127.0.0.1',
    'https://[::1]',
    'https://example',
    'https://-bad.example',
  ])('rejects unsafe or malformed input: %s', (input) => {
    expect(() => normalizeWebsiteUrl(input)).toThrow();
  });
});

describe('hostname policy helpers', () => {
  it('matches exact hosts and opt-in subdomains with a dot boundary', () => {
    expect(hostnameMatches('example.com', 'example.com', false)).toBe(true);
    expect(hostnameMatches('example.com', 'app.example.com', false)).toBe(false);
    expect(hostnameMatches('example.com', 'app.example.com', true)).toBe(true);
    expect(hostnameMatches('example.com', 'example.com.evil.test', true)).toBe(false);
  });

  it('detects overlapping host rules in either direction', () => {
    const base: Space = {
      id: 'base',
      name: 'Base',
      startUrl: 'https://example.com/',
      hostname: 'example.com',
      includeSubdomains: true,
      iconDataUrl: null,
      accentColor: '#ffffff',
      symbol: null,
    };
    const child: Space = {
      ...base,
      id: 'child',
      name: 'Child',
      startUrl: 'https://app.example.com/',
      hostname: 'app.example.com',
      includeSubdomains: false,
    };

    expect(hostRulesOverlap(base, child)).toBe(true);
  });
});

describe('persisted state', () => {
  it('provides a valid initial preset', () => {
    expect(persistedStateSchema.parse(createDefaultState()).settings.activePresetId).toBe(
      'default',
    );
  });

  it('rejects dangling and duplicate preset references', () => {
    const state = createDefaultState();
    state.presets[0]?.spaceIds.push('missing', 'leetcode');
    expect(() => persistedStateSchema.parse(state)).toThrow();
  });
});
