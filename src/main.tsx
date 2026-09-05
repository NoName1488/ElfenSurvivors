import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { refreshPlayerTracks } from './data/musicPlaylist';

// Read the player's music folder once at startup, so a saved "My music" selection has a
// list to play from before anyone opens the audio settings. Desktop-only; a no-op in a
// browser, and a failure here must never stop the game from starting.
void refreshPlayerTracks().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
