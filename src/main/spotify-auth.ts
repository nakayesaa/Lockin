import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';

const tokenResponseSchema = z
  .object({
    access_token: z.string().min(1),
    token_type: z.literal('Bearer'),
    scope: z.string(),
    expires_in: z.number().int().positive(),
    refresh_token: z.string().min(1).optional(),
  })
  .passthrough();

const callbackPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Spotify connected</title></head><body><main><h1>Spotify connected</h1><p>You can close this tab and return to LockIn.</p></main></body></html>`;

export interface SpotifyTokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly expiresInSeconds: number;
  readonly scope: string;
}

interface AuthorizeOptions {
  readonly clientId: string;
  readonly scopes: readonly string[];
  readonly openExternal: (url: string) => Promise<void>;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

function encodeBase64Url(value: Uint8Array): string {
  return Buffer.from(value).toString('base64url');
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = encodeBase64Url(randomBytes(64));
  const challenge = encodeBase64Url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function sameState(actual: string | null, expected: string): boolean {
  if (!actual) return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function spotifyError(status: number, body: string): Error {
  let detail = '';
  try {
    const parsed = JSON.parse(body) as { error_description?: unknown; error?: unknown };
    if (typeof parsed.error_description === 'string') detail = parsed.error_description;
    else if (typeof parsed.error === 'string') detail = parsed.error;
  } catch {
    // Spotify occasionally returns an empty or non-JSON gateway response.
  }
  return new Error(detail || `Spotify authorization failed (${status})`);
}

export async function requestSpotifyAuthorization({
  clientId,
  scopes,
  openExternal,
  fetchImpl = fetch,
  timeoutMs = 5 * 60_000,
}: AuthorizeOptions): Promise<SpotifyTokenResponse> {
  const { verifier, challenge } = createPkcePair();
  const state = encodeBase64Url(randomBytes(32));
  let timeout: NodeJS.Timeout | undefined;

  const authorization = await new Promise<{ code: string; redirectUri: string }>(
    (resolve, reject) => {
      let settled = false;
      const finish = (result: { code: string; redirectUri: string } | Error) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        server.close();
        if (result instanceof Error) reject(result);
        else resolve(result);
      };
      const server = createServer((request, response) => {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');
        if (url.pathname !== '/callback') {
          response.writeHead(404).end();
          return;
        }
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.setHeader(
          'Content-Security-Policy',
          "default-src 'none'; style-src 'unsafe-inline'",
        );
        if (!sameState(url.searchParams.get('state'), state)) {
          response.writeHead(400).end('Invalid authorization state.');
          finish(new Error('Spotify returned an invalid authorization state'));
          return;
        }
        const denied = url.searchParams.get('error');
        const code = url.searchParams.get('code');
        if (denied || !code) {
          response.writeHead(400).end('Spotify connection was cancelled.');
          finish(
            new Error(
              denied === 'access_denied'
                ? 'Spotify connection was cancelled'
                : 'Spotify authorization failed',
            ),
          );
          return;
        }
        const address = server.address() as AddressInfo;
        response.writeHead(200).end(callbackPage);
        finish({ code, redirectUri: `http://127.0.0.1:${address.port}/callback` });
      });

      server.once('error', (error) => finish(error));
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        const redirectUri = `http://127.0.0.1:${address.port}/callback`;
        const url = new URL('https://accounts.spotify.com/authorize');
        url.search = new URLSearchParams({
          client_id: clientId,
          response_type: 'code',
          redirect_uri: redirectUri,
          scope: scopes.join(' '),
          state,
          code_challenge_method: 'S256',
          code_challenge: challenge,
        }).toString();
        timeout = setTimeout(() => finish(new Error('Spotify connection timed out')), timeoutMs);
        void openExternal(url.toString()).catch((error: unknown) =>
          finish(error instanceof Error ? error : new Error('Could not open Spotify login')),
        );
      });
    },
  );

  const response = await fetchImpl('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code: authorization.code,
      redirect_uri: authorization.redirectUri,
      code_verifier: verifier,
    }),
  });
  const body = await response.text();
  if (!response.ok) throw spotifyError(response.status, body);
  const token = tokenResponseSchema.parse(JSON.parse(body));
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    expiresInSeconds: token.expires_in,
    scope: token.scope,
  };
}
