import { z } from 'zod';
import type { SpotifyPlayback } from '../shared/spotify-model';
import {
  refreshSpotifyAuthorization,
  requestSpotifyAuthorization,
  type SpotifyTokenResponse,
} from './spotify-auth';
import type { SpotifyTokens } from './spotify-token-store';

const imageSchema = z
  .object({ url: z.url(), width: z.number().nullable(), height: z.number().nullable() })
  .passthrough();
const playbackSchema = z
  .object({
    is_playing: z.boolean(),
    progress_ms: z.number().int().nonnegative().nullable(),
    item: z
      .object({
        type: z.enum(['track', 'episode']),
        name: z.string().min(1),
        duration_ms: z.number().int().nonnegative(),
        external_urls: z.object({ spotify: z.url().optional() }).passthrough(),
        artists: z.array(z.object({ name: z.string().min(1) }).passthrough()).optional(),
        album: z
          .object({ images: z.array(imageSchema) })
          .passthrough()
          .optional(),
        show: z
          .object({
            name: z.string().min(1),
            publisher: z.string().min(1),
            images: z.array(imageSchema),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .nullable(),
    context: z
      .object({
        type: z.string(),
        uri: z.string(),
      })
      .passthrough()
      .nullable(),
  })
  .passthrough();

const playlistSchema = z
  .object({
    name: z.string().min(1),
    images: z.array(imageSchema),
  })
  .passthrough();

interface TokenRepository {
  get(): SpotifyTokens | null;
  save(tokens: SpotifyTokens): Promise<void>;
  clear(): Promise<void>;
}

interface SpotifyServiceOptions {
  readonly clientId: string;
  readonly scopes: readonly string[];
  readonly tokens: TokenRepository;
  readonly openExternal: (url: string) => Promise<void>;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
  readonly authorize?: () => Promise<SpotifyTokenResponse>;
}

function apiError(status: number, body: string, retryAfter: string | null): Error {
  if (status === 401) return new Error('Spotify connection expired. Connect it again.');
  if (status === 403) return new Error('Spotify Premium is required for playback control.');
  if (status === 404) return new Error('Open Spotify on a device and start something first.');
  if (status === 429) {
    const wait = retryAfter ? ` Try again in ${retryAfter} seconds.` : '';
    return new Error(`Spotify is receiving too many requests.${wait}`);
  }
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown } };
    if (typeof parsed.error?.message === 'string') return new Error(parsed.error.message);
  } catch {
    // Use the stable fallback for non-JSON gateway failures.
  }
  return new Error(`Spotify request failed (${status})`);
}

function firstImage(images: readonly z.infer<typeof imageSchema>[]): string | null {
  return images[0]?.url ?? null;
}

export class SpotifyService {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly authorize: () => Promise<SpotifyTokenResponse>;
  private connectTask: Promise<SpotifyPlayback> | null = null;
  private refreshTask: Promise<string> | null = null;
  private readonly playlistCache = new Map<string, { name: string; artworkUrl: string | null }>();

  constructor(private readonly options: SpotifyServiceOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.authorize =
      options.authorize ??
      (() =>
        requestSpotifyAuthorization({
          clientId: options.clientId,
          scopes: options.scopes,
          openExternal: options.openExternal,
          fetchImpl: this.fetchImpl,
        }));
  }

  async connect(): Promise<SpotifyPlayback> {
    if (this.connectTask) return this.connectTask;
    this.connectTask = this.connectOnce().finally(() => {
      this.connectTask = null;
    });
    return this.connectTask;
  }

  private async connectOnce(): Promise<SpotifyPlayback> {
    const token = await this.authorize();
    if (!token.refreshToken) throw new Error('Spotify did not return a refresh token');
    await this.options.tokens.save({
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: this.now() + token.expiresInSeconds * 1_000,
      scope: token.scope,
    });
    return this.getPlayback();
  }

  async disconnect(): Promise<void> {
    this.playlistCache.clear();
    await this.options.tokens.clear();
  }

  async getPlayback(): Promise<SpotifyPlayback> {
    if (!this.options.tokens.get()) return { status: 'disconnected' };
    const response = await this.request('/me/player?additional_types=track%2Cepisode');
    if (response.status === 204) return { status: 'idle' };
    const playback = playbackSchema.parse(await response.json());
    if (!playback.item) return { status: 'idle' };

    const item = playback.item;
    const itemImages = item.album?.images ?? item.show?.images ?? [];
    let artworkUrl = firstImage(itemImages);
    let contextName: string | null = null;
    const playlistId =
      playback.context?.type === 'playlist'
        ? /^spotify:playlist:([A-Za-z0-9]+)$/.exec(playback.context.uri)?.[1]
        : undefined;
    if (playlistId) {
      const playlist = await this.getPlaylist(playlistId).catch(() => null);
      if (playlist) {
        artworkUrl = playlist.artworkUrl ?? artworkUrl;
        contextName = playlist.name;
      }
    }

    const artist =
      item.type === 'track'
        ? item.artists?.map(({ name }) => name).join(', ') || 'Spotify'
        : (item.show?.publisher ?? item.show?.name ?? 'Spotify');
    return {
      status: 'active',
      isPlaying: playback.is_playing,
      title: item.name,
      artist,
      artworkUrl,
      spotifyUrl: item.external_urls.spotify ?? null,
      contextName,
      durationMs: item.duration_ms,
      progressMs: Math.min(playback.progress_ms ?? 0, item.duration_ms),
      fetchedAt: this.now(),
    };
  }

  async play(): Promise<void> {
    await this.command('/me/player/play', 'PUT');
  }

  async pause(): Promise<void> {
    await this.command('/me/player/pause', 'PUT');
  }

  async next(): Promise<void> {
    await this.command('/me/player/next', 'POST');
  }

  async open(url: string): Promise<void> {
    const destination = new URL(url);
    if (destination.protocol !== 'https:' || destination.hostname !== 'open.spotify.com') {
      throw new Error('Invalid Spotify destination');
    }
    await this.options.openExternal(destination.toString());
  }

  private async command(path: string, method: 'POST' | 'PUT'): Promise<void> {
    const response = await this.request(path, { method });
    if (response.status !== 204) throw new Error('Spotify did not accept the playback command');
  }

  private async getPlaylist(id: string): Promise<{ name: string; artworkUrl: string | null }> {
    const cached = this.playlistCache.get(id);
    if (cached) return cached;
    const response = await this.request(
      `/playlists/${encodeURIComponent(id)}?fields=name%2Cimages`,
    );
    const playlist = playlistSchema.parse(await response.json());
    const result = { name: playlist.name, artworkUrl: firstImage(playlist.images) };
    this.playlistCache.set(id, result);
    return result;
  }

  private async request(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
    const accessToken = await this.getAccessToken(retried);
    const response = await this.fetchImpl(`https://api.spotify.com/v1${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, ...init.headers },
    });
    if (response.status === 401 && !retried) return this.request(path, init, true);
    if (response.ok) return response;
    const body = await response.text();
    if (response.status === 401) await this.options.tokens.clear();
    throw apiError(response.status, body, response.headers.get('Retry-After'));
  }

  private async getAccessToken(forceRefresh = false): Promise<string> {
    const tokens = this.options.tokens.get();
    if (!tokens) throw new Error('Connect Spotify to use the player.');
    if (!forceRefresh && tokens.expiresAt > this.now() + 60_000) return tokens.accessToken;
    if (!this.refreshTask) {
      this.refreshTask = this.refresh(tokens).finally(() => {
        this.refreshTask = null;
      });
    }
    return this.refreshTask;
  }

  private async refresh(tokens: SpotifyTokens): Promise<string> {
    try {
      const token = await refreshSpotifyAuthorization({
        clientId: this.options.clientId,
        refreshToken: tokens.refreshToken,
        fetchImpl: this.fetchImpl,
      });
      const updated = {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken ?? tokens.refreshToken,
        expiresAt: this.now() + token.expiresInSeconds * 1_000,
        scope: token.scope || tokens.scope,
      };
      await this.options.tokens.save(updated);
      return updated.accessToken;
    } catch (error) {
      await this.options.tokens.clear();
      throw error;
    }
  }
}
