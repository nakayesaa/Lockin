// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { createDefaultWorkspace } from '../../src/shared/default-workspace';
import { persistedStateSchema, type Space } from '../../src/shared/data-model';
import {
  findAllowedSpaceForUrl,
  hostRulesOverlap,
  hostnameMatches,
  normalizeWebsiteUrl,
} from '../../src/shared/website-rules';

describe('website normalization', () => {
  it('adds HTTPS and preserves a useful start path', () => {
    expect(normalizeWebsiteUrl('Example.COM/tasks?q=next#ignored')).toEqual({
      startUrl: 'https://example.com/tasks?q=next',
      hostname: 'example.com',
    });
  });

  it('canonicalizes Unicode, mixed-case, and trailing-dot hostnames', () => {
    expect(normalizeWebsiteUrl('https://BÜCHER.Example./read')).toEqual({
      startUrl: 'https://xn--bcher-kva.example/read',
      hostname: 'xn--bcher-kva.example',
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

  it('resolves only secure top-level destinations allowed by the session', () => {
    const space: Space = {
      id: 'docs',
      name: 'Docs',
      startUrl: 'https://docs.example.com/',
      hostname: 'example.com',
      includeSubdomains: true,
      iconDataUrl: null,
      accentColor: '#ffffff',
      symbol: null,
    };

    expect(findAllowedSpaceForUrl('https://docs.example.com/page', [space])).toBe(space);
    expect(findAllowedSpaceForUrl('https://DOCS.EXAMPLE.COM./page', [space])).toBe(space);
    expect(findAllowedSpaceForUrl('https://example.com.evil.test/', [space])).toBeNull();
    expect(findAllowedSpaceForUrl('https://example.com@evil.test/', [space])).toBeNull();
    expect(findAllowedSpaceForUrl('http://example.com/', [space])).toBeNull();
    expect(findAllowedSpaceForUrl('not a url', [space])).toBeNull();
  });

  it.each([
    'http://example.com/',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'data:text/html,hello',
    'blob:https://example.com/id',
    'mailto:hello@example.com',
    'lockin://example.com/',
  ])('rejects non-HTTPS navigation: %s', (url) => {
    const space = createDefaultWorkspace().spaces[0]!;
    expect(findAllowedSpaceForUrl(url, [space])).toBeNull();
  });
});

describe('persisted state', () => {
  it('provides a valid initial preset', () => {
    expect(persistedStateSchema.parse(createDefaultWorkspace()).settings.activePresetId).toBe(
      'default',
    );
  });

  it('rejects dangling and duplicate preset references', () => {
    const state = createDefaultWorkspace();
    state.presets[0]?.spaceIds.push('missing', 'leetcode');
    expect(() => persistedStateSchema.parse(state)).toThrow();
  });
});
