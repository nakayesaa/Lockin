// @vitest-environment node

import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SpotifyTokenStore, type TokenEncryption } from '../../src/main/spotify-token-store';

const encryption: TokenEncryption = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(`encrypted:${value}`),
  decryptString: (value) => value.toString().replace(/^encrypted:/, ''),
};

describe('SpotifyTokenStore', () => {
  it('persists encrypted tokens and restores them', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lockin-spotify-'));
    const file = join(directory, 'spotify.json');
    const tokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() + 3_600_000,
      scope: 'scope',
    };
    const store = new SpotifyTokenStore(file, encryption);
    await store.save(tokens);

    expect(await readFile(file, 'utf8')).not.toContain('access-token');
    const restored = new SpotifyTokenStore(file, encryption);
    await restored.initialize();
    expect(restored.get()).toEqual(tokens);
  });

  it('refuses plaintext fallback when secure storage is unavailable', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lockin-spotify-'));
    const store = new SpotifyTokenStore(join(directory, 'spotify.json'), {
      ...encryption,
      isEncryptionAvailable: () => false,
    });

    await expect(
      store.save({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3_600_000,
        scope: 'scope',
      }),
    ).rejects.toThrow('Secure token storage is unavailable');
  });
});
