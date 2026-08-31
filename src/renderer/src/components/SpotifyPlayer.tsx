import { memo, useEffect, useState } from 'react';
import playerWallpaperUrl from '../assets/spotify-player-wallpaper.png';
import { PauseIcon, PlayIcon, SkipForwardIcon } from './Icons';
import { useSpotifyPlayback } from '../hooks/useSpotifyPlayback';

function SpotifyArtwork({
  title,
  url,
  playing,
  disabled,
  onOpen,
}: {
  title: string;
  url: string;
  playing: boolean;
  disabled: boolean;
  onOpen: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <span
        className={`spotify-player__live-cover ${loaded ? 'is-visible' : ''}`}
        style={{ backgroundImage: `url(${JSON.stringify(url)})` }}
        aria-hidden="true"
      />
      <button
        type="button"
        className={`spotify-player__artwork ${loaded ? 'is-visible' : ''} ${
          playing ? 'is-playing' : ''
        }`}
        aria-label={`Open ${title} in Spotify`}
        disabled={disabled}
        onClick={onOpen}
      >
        <img src={url} alt="" onLoad={() => setLoaded(true)} onError={() => setLoaded(false)} />
      </button>
    </>
  );
}

export const SpotifyPlayer = memo(function SpotifyPlayer({
  focusActive,
}: {
  focusActive: boolean;
}) {
  const [now, setNow] = useState(() => new Date());
  const spotify = useSpotifyPlayback();
  const active = spotify.playback.status === 'active' ? spotify.playback : null;
  const connected = spotify.playback.status !== 'disconnected';
  const time = now.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  const detail =
    spotify.error ||
    (active
      ? `${active.artist}${active.contextName ? ` · ${active.contextName}` : ''}`
      : connected
        ? 'Start playback on any Spotify device.'
        : focusActive
          ? 'Connect before your next focus.'
          : null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <aside
      className="spotify-player"
      aria-label={spotify.preview ? 'Spotify player preview' : 'Spotify player'}
      style={{ backgroundImage: `url(${playerWallpaperUrl})` }}
    >
      {active?.artworkUrl ? (
        <SpotifyArtwork
          key={active.artworkUrl}
          title={active.title}
          url={active.artworkUrl}
          playing={active.isPlaying}
          disabled={!active.spotifyUrl || spotify.busy || focusActive}
          onOpen={() => void spotify.open()}
        />
      ) : null}
      <span className="spotify-player__shade" aria-hidden="true" />
      <header className="spotify-player__header">
        <span className="spotify-player__profile" aria-hidden="true">
          ♪
        </span>
        <strong>falling in love</strong>
        <time>{time}</time>
        {connected && !spotify.preview ? (
          <button
            type="button"
            className="spotify-player__disconnect"
            aria-label="Disconnect Spotify"
            disabled={spotify.busy}
            onClick={() => void spotify.disconnect()}
          >
            ×
          </button>
        ) : null}
      </header>

      <div className="spotify-player__track" aria-live="polite">
        <span>{active ? 'Now playing' : connected ? 'Spotify ready' : 'Your music'}</span>
        <strong>
          {spotify.loading
            ? 'Checking Spotify…'
            : active?.title || (connected ? 'Ready when you are.' : 'Connect Spotify')}
        </strong>
        {detail ? <small className={spotify.error ? 'is-error' : ''}>{detail}</small> : null}
      </div>

      <div className="spotify-player__actions">
        {!connected && !spotify.preview ? (
          <button
            type="button"
            className="spotify-player__connect"
            disabled={spotify.busy || spotify.loading || focusActive}
            onClick={() => void spotify.connect()}
          >
            <span>{spotify.busy ? 'Opening Spotify…' : 'Connect Spotify'}</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              className="spotify-player__play"
              aria-label={active?.isPlaying ? 'Pause music' : 'Play music'}
              disabled={spotify.busy}
              onClick={() => void spotify.toggle()}
            >
              {active?.isPlaying ? <PauseIcon /> : <PlayIcon />}
              <span>{active?.isPlaying ? 'Pause' : 'Play'}</span>
            </button>
            <button
              type="button"
              aria-label="Next track"
              disabled={spotify.busy}
              onClick={() => void spotify.next()}
            >
              <span>Next</span>
              <SkipForwardIcon />
            </button>
          </>
        )}
      </div>
    </aside>
  );
});
