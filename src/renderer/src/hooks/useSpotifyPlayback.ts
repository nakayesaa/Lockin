import { useCallback, useEffect, useState } from 'react';
import type { SpotifyPlayback } from '../../../shared/contracts';
import { errorMessage } from '../errorMessage';

const previewTracks = [
  { title: 'Blue Hour', artist: 'Focus Radio' },
  { title: 'Soft Current', artist: 'Luma' },
  { title: 'After Blue', artist: 'Northline' },
] as const;

function previewPlayback(index = 0, isPlaying = true): SpotifyPlayback {
  const track = previewTracks[index] ?? previewTracks[0];
  return {
    status: 'active',
    isPlaying,
    title: track.title,
    artist: track.artist,
    artworkUrl: null,
    spotifyUrl: null,
    contextName: null,
    durationMs: 180_000,
    progressMs: 42_000,
    fetchedAt: Date.now(),
  };
}

export interface SpotifyController {
  readonly playback: SpotifyPlayback;
  readonly loading: boolean;
  readonly busy: boolean;
  readonly error: string | null;
  readonly preview: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  toggle(): Promise<void>;
  next(): Promise<void>;
  open(): Promise<void>;
}

export function useSpotifyPlayback(): SpotifyController {
  const api = window.lockIn;
  const preview = !api?.getSpotifyPlayback;
  const [playback, setPlayback] = useState<SpotifyPlayback>(() =>
    preview ? previewPlayback() : { status: 'disconnected' },
  );
  const [previewIndex, setPreviewIndex] = useState(0);
  const [loading, setLoading] = useState(!preview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!api?.getSpotifyPlayback) return;
    try {
      setPlayback(await api.getSpotifyPlayback());
      setError(null);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Spotify could not be reached.'));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (preview) return;
    let active = true;
    let inFlight = false;
    const poll = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      await refresh();
      inFlight = false;
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [preview, refresh]);

  const run = useCallback(
    async (operation: () => Promise<void>, refreshAfter = true) => {
      setBusy(true);
      setError(null);
      try {
        await operation();
        if (refreshAfter) await refresh();
      } catch (requestError) {
        setError(errorMessage(requestError, 'Spotify could not complete that action.'));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const connect = useCallback(async () => {
    if (!api?.connectSpotify) return;
    await run(async () => setPlayback(await api.connectSpotify()), false);
  }, [api, run]);

  const disconnect = useCallback(async () => {
    if (!api?.disconnectSpotify) return;
    await run(async () => {
      await api.disconnectSpotify();
      setPlayback({ status: 'disconnected' });
    }, false);
  }, [api, run]);

  const toggle = useCallback(async () => {
    if (playback.status !== 'active') {
      if (preview) setPlayback(previewPlayback(previewIndex, true));
      else if (api?.playSpotify) await run(api.playSpotify);
      return;
    }
    const nextPlaying = !playback.isPlaying;
    setPlayback({ ...playback, isPlaying: nextPlaying });
    if (preview) return;
    const command = nextPlaying ? api?.playSpotify : api?.pauseSpotify;
    if (command) await run(command);
  }, [api, playback, preview, previewIndex, run]);

  const next = useCallback(async () => {
    if (preview) {
      const index = (previewIndex + 1) % previewTracks.length;
      setPreviewIndex(index);
      setPlayback(previewPlayback(index));
      return;
    }
    if (api?.nextSpotify) await run(api.nextSpotify);
  }, [api, preview, previewIndex, run]);

  const open = useCallback(async () => {
    if (playback.status !== 'active' || !playback.spotifyUrl || !api?.openSpotify) return;
    await run(() => api.openSpotify(playback.spotifyUrl!), false);
  }, [api, playback, run]);

  return { playback, loading, busy, error, preview, connect, disconnect, toggle, next, open };
}
