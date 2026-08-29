import { useState } from 'react';
import type { CSSProperties } from 'react';
import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from './Icons';

const previewTracks = [
  { title: 'Blue Hour', artist: 'Focus Radio', colors: ['#d9efff', '#247fd8', '#f6fbff'] },
  { title: 'Soft Current', artist: 'Luma', colors: ['#d4c7ff', '#597cd7', '#f3eaff'] },
  { title: 'After Blue', artist: 'Northline', colors: ['#a8d9ff', '#153f7a', '#dff4ff'] },
] as const;

export function SpotifyPlayer() {
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const track = previewTracks[trackIndex] ?? previewTracks[0];

  const changeTrack = (direction: -1 | 1) => {
    setTrackIndex((current) => (current + direction + previewTracks.length) % previewTracks.length);
    setPlaying(true);
  };

  const artworkStyle = {
    '--album-light': track.colors[0],
    '--album-deep': track.colors[1],
    '--album-glow': track.colors[2],
  } as CSSProperties;

  return (
    <aside className="spotify-player" aria-label="Spotify player preview">
      <div
        className={`spotify-disc ${playing ? 'spotify-disc--playing' : ''}`}
        style={artworkStyle}
        aria-hidden="true"
      >
        <span className="spotify-disc__art" />
        <span className="spotify-disc__grooves" />
        <span className="spotify-disc__center" />
      </div>
      <div className="spotify-console">
        <div className="spotify-track">
          <div>
            <strong>{track.title}</strong>
            <span>{track.artist}</span>
          </div>
        </div>
        <div className="spotify-controls">
          <button type="button" aria-label="Previous track" onClick={() => changeTrack(-1)}>
            <SkipBackIcon />
          </button>
          <button
            type="button"
            className="spotify-controls__primary"
            aria-label={playing ? 'Pause music' : 'Play music'}
            onClick={() => setPlaying((current) => !current)}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button type="button" aria-label="Next track" onClick={() => changeTrack(1)}>
            <SkipForwardIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}
