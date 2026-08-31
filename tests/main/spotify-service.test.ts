// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { SpotifyService } from '../../src/main/spotify-service';
import type { SpotifyTokens } from '../../src/main/spotify-token-store';

function tokenRepository(initial: SpotifyTokens | null = null) {
  let tokens = initial;
  return {
    get: () => tokens,
    save: vi.fn(async (next: SpotifyTokens) => {
      tokens = next;
    }),
    clear: vi.fn(async () => {
      tokens = null;
    }),
  };
}

function playbackResponse() {
  return new Response(
    JSON.stringify({
      is_playing: true,
      progress_ms: 12_000,
      item: {
        type: 'track',
        name: 'A Moment Apart',
        duration_ms: 180_000,
        external_urls: { spotify: 'https://open.spotify.com/track/track-id' },
        artists: [{ name: 'ODESZA' }],
        album: { images: [{ url: 'https://i.scdn.co/album.jpg', width: 640, height: 640 }] },
      },
      context: { type: 'playlist', uri: 'spotify:playlist:playlist123' },
    }),
  );
}

describe('SpotifyService', () => {
  it('reports a disconnected player without making an API request', async () => {
    const fetchImpl = vi.fn();
    const service = new SpotifyService({
      clientId: 'client-id',
      scopes: [],
      tokens: tokenRepository(),
      openExternal: vi.fn(),
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(service.getPlayback()).resolves.toEqual({ status: 'disconnected' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('connects, persists tokens, and prefers the current playlist artwork', async () => {
    const tokens = tokenRepository();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(playbackResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: 'Deep Focus',
            images: [{ url: 'https://i.scdn.co/playlist.jpg', width: 640, height: 640 }],
          }),
        ),
      );
    const service = new SpotifyService({
      clientId: 'client-id',
      scopes: ['scope'],
      tokens,
      openExternal: vi.fn(),
      fetchImpl: fetchImpl as typeof fetch,
      now: () => 10_000,
      authorize: vi.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresInSeconds: 3600,
        scope: 'scope',
      }),
    });

    await expect(service.connect()).resolves.toEqual({
      status: 'active',
      isPlaying: true,
      title: 'A Moment Apart',
      artist: 'ODESZA',
      artworkUrl: 'https://i.scdn.co/playlist.jpg',
      spotifyUrl: 'https://open.spotify.com/track/track-id',
      contextName: 'Deep Focus',
      durationMs: 180_000,
      progressMs: 12_000,
      fetchedAt: 10_000,
    });
    expect(tokens.save).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: 'refresh-token', expiresAt: 3_610_000 }),
    );
  });

  it('refreshes an expired access token before controlling playback', async () => {
    const tokens = tokenRepository({
      accessToken: 'expired',
      refreshToken: 'refresh-token',
      expiresAt: 1,
      scope: 'scope',
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'refreshed',
            token_type: 'Bearer',
            scope: 'scope',
            expires_in: 3600,
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const service = new SpotifyService({
      clientId: 'client-id',
      scopes: [],
      tokens,
      openExternal: vi.fn(),
      fetchImpl: fetchImpl as typeof fetch,
      now: () => 10_000,
    });

    await expect(service.next()).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://api.spotify.com/v1/me/player/next',
      expect.objectContaining({ headers: { Authorization: 'Bearer refreshed' } }),
    );
  });

  it('opens only canonical Spotify links', async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const service = new SpotifyService({
      clientId: 'client-id',
      scopes: [],
      tokens: tokenRepository(),
      openExternal,
    });

    await expect(service.open('https://example.com/track/id')).rejects.toThrow(
      'Invalid Spotify destination',
    );
    await service.open('https://open.spotify.com/track/id');
    expect(openExternal).toHaveBeenCalledWith('https://open.spotify.com/track/id');
  });
});
