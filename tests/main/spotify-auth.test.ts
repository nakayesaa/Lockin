// @vitest-environment node

import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  createPkcePair,
  requestSpotifyAuthorization,
  SPOTIFY_CALLBACK_PORT,
} from '../../src/main/spotify-auth';

describe('Spotify PKCE authorization', () => {
  it('creates a verifier and its S256 challenge', () => {
    const pair = createPkcePair();
    expect(pair.verifier.length).toBeGreaterThanOrEqual(43);
    expect(pair.challenge).toBe(
      createHash('sha256').update(pair.verifier).digest().toString('base64url'),
    );
  });

  it('validates the callback and exchanges the code without a client secret', async () => {
    let tokenRequest: RequestInit | undefined;
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      tokenRequest = init;
      return new Response(
        JSON.stringify({
          access_token: 'access-token',
          token_type: 'Bearer',
          scope: 'user-read-currently-playing',
          expires_in: 3600,
          refresh_token: 'refresh-token',
        }),
      );
    });
    const openExternal = vi.fn(async (authorizationUrl: string) => {
      const url = new URL(authorizationUrl);
      const callback = new URL(url.searchParams.get('redirect_uri')!);
      callback.searchParams.set('code', 'authorization-code');
      callback.searchParams.set('state', url.searchParams.get('state')!);
      await fetch(callback);
    });

    await expect(
      requestSpotifyAuthorization({
        clientId: 'public-client-id',
        scopes: ['user-read-currently-playing'],
        openExternal,
        fetchImpl: fetchImpl as typeof fetch,
        timeoutMs: 1_000,
      }),
    ).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresInSeconds: 3600,
      scope: 'user-read-currently-playing',
    });

    const authorizationUrl = new URL(openExternal.mock.calls[0]![0]);
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
    const body = new URLSearchParams(tokenRequest?.body as URLSearchParams);
    expect(body.get('client_id')).toBe('public-client-id');
    expect(body.get('client_secret')).toBeNull();
    expect(body.get('redirect_uri')).toBe(`http://127.0.0.1:${SPOTIFY_CALLBACK_PORT}/callback`);
  });
});
