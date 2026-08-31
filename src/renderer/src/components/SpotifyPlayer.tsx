import { useState } from 'react';
import playerWallpaperUrl from '../assets/spotify-player-wallpaper.png';
import { PauseIcon, PlayIcon, SkipForwardIcon } from './Icons';

const previewTracks = [
  { title: 'Blue Hour', artist: 'Focus Radio' },
  { title: 'Soft Current', artist: 'Luma' },
  { title: 'After Blue', artist: 'Northline' },
] as const;

export function SpotifyPlayer() {
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const track = previewTracks[trackIndex] ?? previewTracks[0];
  const time = new Date().toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  const nextTrack = () => {
    setTrackIndex((current) => (current + 1) % previewTracks.length);
    setPlaying(true);
  };

  return (
    <aside
      className="spotify-player"
      aria-label="Spotify player preview"
      style={{ backgroundImage: `url(${playerWallpaperUrl})` }}
    >
      <span className="spotify-player__shade" aria-hidden="true" />
      <header className="spotify-player__header">
        <span className="spotify-player__profile" aria-hidden="true">
          ♪
        </span>
        <strong>falling in love</strong>
        <time>{time}</time>
      </header>

      <div className="spotify-player__track">
        <span>Now playing</span>
        <strong>{track.title}</strong>
        <small>{track.artist}</small>
      </div>

      <div className="spotify-player__actions">
        <button
          type="button"
          className="spotify-player__play"
          aria-label={playing ? 'Pause music' : 'Play music'}
          onClick={() => setPlaying((current) => !current)}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
          <span>{playing ? 'Pause' : 'Play'}</span>
        </button>
        <button type="button" aria-label="Next track" onClick={nextTrack}>
          <span>Next</span>
          <SkipForwardIcon />
        </button>
      </div>
    </aside>
  );
}
