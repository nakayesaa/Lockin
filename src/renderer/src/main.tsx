import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SpotifyOverlay } from './components/SpotifyPlayer';
import './styles.css';

const root = document.querySelector<HTMLDivElement>('#root');

if (!root) throw new Error('Missing renderer root element');

const spotifyOverlay = window.location.hash === '#spotify-overlay';
if (spotifyOverlay) document.documentElement.classList.add('spotify-overlay-document');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>{spotifyOverlay ? <SpotifyOverlay /> : <App />}</ErrorBoundary>
  </StrictMode>,
);
