import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { refreshPlayerTracks } from './data/musicPlaylist';

// Read the player's music folder once at startup, so a saved "My music" selection has a
// list to play from before anyone opens the audio settings. Desktop-only; a no-op in a
// browser, and a failure here must never stop the game from starting.
void refreshPlayerTracks().catch(() => {});

/*
 * The boundary wraps everything.
 *
 * Without it a throw anywhere in the tree leaves a blank window: no message, no way for the
 * player to report it, and on a packaged desktop build no console to look at either. That is
 * indistinguishable from the program dying, which is the one failure mode a game handed to
 * playtesters must not have.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary collectDetails={() => (window as any).__elfenRunReport?.() || ''}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
