import type { PersistedState } from './data-model';

export function createDefaultWorkspace(): PersistedState {
  return {
    version: 1,
    spaces: [
      {
        id: 'leetcode',
        name: 'LeetCode',
        startUrl: 'https://leetcode.com/',
        hostname: 'leetcode.com',
        includeSubdomains: false,
        iconDataUrl: null,
        accentColor: '#f0b84b',
        symbol: 'L',
      },
      {
        id: 'chatgpt',
        name: 'ChatGPT',
        startUrl: 'https://chatgpt.com/',
        hostname: 'chatgpt.com',
        includeSubdomains: false,
        iconDataUrl: null,
        accentColor: '#20242c',
        symbol: '✦',
      },
      {
        id: 'youtube',
        name: 'YouTube',
        startUrl: 'https://youtube.com/',
        hostname: 'youtube.com',
        includeSubdomains: true,
        iconDataUrl: null,
        accentColor: '#e45a68',
        symbol: '▶',
      },
    ],
    presets: [
      {
        id: 'default',
        name: 'Deep Work',
        durationMinutes: 60,
        spaceIds: ['leetcode', 'chatgpt', 'youtube'],
      },
    ],
    settings: { activePresetId: 'default' },
  };
}
